from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field, field_validator
from langchain_aws import ChatBedrockConverse
from langgraph.prebuilt import InjectedState
from typing import List, Optional, Literal, Annotated, Dict
import datetime
import json
import logging
import math
import re

from agent.utils.helper_functions import call_api, fetch_user_info_for_program_creation
from agent.utils.config import *

logger = logging.getLogger(__name__)


from agent.utils.helper_agents import extract_planner_context

# Planner bağlamı çıkarımı için Haiku 4.5 — Nova Lite kullanıcının sözünü
# bozuyordu ("interval istemiyorum" → 3 tip yasak gibi). Haiku daha sadık çıkarır.
tool_summarizer_llm = ChatBedrockConverse(
    model=HAIKU_45,
    region_name=BEDROCK_REGION,
    temperature=0,
    max_tokens=4096,
)

# Plan üretimi için Sonnet — modül load'da bir kez kurulur, her create_workout_plan
# çağrısında yeniden kurmuyoruz (boto3 client + auth chain init'i pahalı).
planner_llm = ChatBedrockConverse(
    model=SONNET_45,
    temperature=0,
    region_name=BEDROCK_REGION,
    disable_streaming=True,
)

def map_day_name_to_int(day_name: str) -> int:
    mapping = {
        'mon': 0, 'monday': 0, 'pzt': 0, 'pazartesi': 0,
        'tue': 1, 'tuesday': 1, 'sal': 1, 'salı': 1,
        'wed': 2, 'wednesday': 2, 'çar': 2, 'çarşamba': 2,
        'thu': 3, 'thursday': 3, 'per': 3, 'perşembe': 3,
        'fri': 4, 'friday': 4, 'cum': 4, 'cuma': 4,
        'sat': 5, 'saturday': 5, 'cmt': 5, 'cumartesi': 5,
        'sun': 6, 'sunday': 6, 'paz': 6, 'pazar': 6
    }
    cleaned = str(day_name).lower().strip()[:3]
    return mapping.get(cleaned, 0)

def generate_available_slots(start_date_str: str, duration_weeks: int, selected_days: List[str]) -> List[Dict]:
    """
    Kullanıcının 'Müsaitim' dediği TÜM günleri listeler.
    Filtreleme yapmaz (Onu LLM yapacak).
    """
    try:
        start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").date()
    except:
        start_date = datetime.date.today() + datetime.timedelta(days=1)

    target_weekdays = {map_day_name_to_int(d) for d in selected_days}
    
    slots = []
    # Tarama limiti (Hafta sayısı * 7 gün + tampon)
    scan_limit = (duration_weeks * 7) + 7 
    current_date = start_date
    
    for _ in range(scan_limit):
        days_diff = (current_date - start_date).days
        week_num = (days_diff // 7) + 1
        
        if week_num > duration_weeks:
            break

        # Sadece kullanıcının müsait olduğu günleri havuza ekle
        if current_date.weekday() in target_weekdays:
            slots.append({
                "offset": days_diff,
                "date": current_date.strftime("%Y-%m-%d"),
                "day_name": current_date.strftime("%A"),
                "week_num": week_num
            })
            
        current_date += datetime.timedelta(days=1)

    return slots


# ============================================================
# 2. PYTHON LOGIC (Güncellenmiş Pace ve Slot Mantığı)
# ============================================================

def extract_json_from_llm_response(content: str) -> dict:
    """
    LLM response'undan JSON'ı güvenli bir şekilde parse eder.
    1. Önce code block içindeki JSON'ı arar (```json ... ```)
    2. Bulamazsa ilk { ... } bloğunu dener
    3. İkisi de başarısız olursa exception fırlatır
    """
    # 1. Code block içindeki JSON'ı dene (büyük/küçük harf fark etmez)
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 2. Ham içeriği dene (LLM direkt JSON döndürdüyse)
    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        pass

    # 3. İlk { ... } bloğunu bul ve dene
    brace_match = re.search(r"\{[\s\S]*\}", content)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"LLM response içinde geçerli JSON bulunamadı. Response: {content[:300]}")


def calculate_duration(pace_seconds: int, distance: float) -> int:
    """
    Pace (sn/km) ve mesafe (km) ile süreyi hesaplar.
    Sonuç 5'in katına yuvarlanır (35, 40, 45 dk gibi).
    """
    if distance <= 0 or pace_seconds <= 0:
        return 0
    raw_minutes = (distance * pace_seconds) / 60
    return int(math.ceil(raw_minutes / 5) * 5)





class CreatePlanInput(BaseModel):
    title: str = Field(..., description="Programın başlığı (Örn: Maraton Yolculuğu)")
    start_date: str = Field(..., description="YYYY-MM-DD formatında başlangıç tarihi")
    duration_weeks: int = Field(..., description="Programın toplam kaç hafta süreceği")
    description: Optional[str] = Field(default="", description="Kullanıcının hedefi veya özel isteği")
    
    # YENİ PARAMETRELER - LLM bunları chat'ten anlayarak dolduracak
    selected_days: List[str] = Field(
        ..., 
        description="Kullanıcının koşmak istediği günler. Örn: ['Mon', 'Wed', 'Fri']. MUTLAKA chat geçmişinden al."
    )
    long_run_day: Optional[str] = Field(
        default=None,
        description="Kullanıcının uzun koşu için tercih ettiği gün (Örn: 'Sun'). Eğer kullanıcı belirtmediyse null gönder."
    )
    goal: str = Field(
        ...,
        description="Kullanıcının koşu hedefi (Örn: '10K', 'Maraton', 'Kilo Verme'). Chat geçmişinden al."
    )

@tool(args_schema=CreatePlanInput)
async def create_workout_plan(
    title: str,
    start_date: str,
    duration_weeks: int,
    description: str,
    selected_days: List[str],
    long_run_day: Optional[str],
    goal: str,
    config: RunnableConfig,
    state: Annotated[dict, InjectedState],
) -> str:
    """
    Kullanıcının profiline ve koşu bilimi kurallarına (80/20 kuralı, toparlanma dengesi) uygun antrenman programı oluşturur.
    Not: Bu araç sadece kullanıcı hedef, başlangıç tarihi, koşu günleri ve süreyi netleştirdiğinde çağrılmalıdır.

    Args:
        title (str): Programın yaratıcı başlığı (Örn: "Berkan'ın maraton hazırlık programı").
        start_date (str): Başlangıç tarihi (YYYY-MM-DD formatında).
        duration_weeks (int): Programın hafta olarak süresi.
        description (str): Programın açıklaması.
        selected_days (List[str]): Kullanıcının koşmak istediği günler (Örn: ['Mon', 'Wed', 'Fri']).
        long_run_day (Optional[str]): Uzun koşu günü tercihi (Örn: 'Sun' veya null).
        goal (str): Kullanıcının hedefi (Örn: '10K', 'Maraton').

    Returns:
        str: İşlem sonucunu (başarı/hata) belirten durum mesajı.
    """
    logger.info(f"🚀 Spark Planlama Başlatıldı: {title}")
    logger.info(f"📅 Seçilen Günler (LLM'den): {selected_days}")
    logger.info(f"🔥 Uzun Koşu Günü (LLM'den): {long_run_day}")
    logger.info(f"🎯 Hedef (LLM'den): {goal}")

    # --- ADIM 1: USER CONTEXT ÇEKME ---
    try:
        full_context = await fetch_user_info_for_program_creation(config)
        if "error" in full_context:
            return f"HATA: Kullanıcı verileri alınamadı: {full_context['error']}"

        profile = full_context.get("user_profile", {})
        
        current_pace = profile.get("current_pace")

        if not current_pace:
            pace_info = "BİLİNMİYOR (Kullanıcı hızını bilmiyor, koşuya YENİ BAŞLAYAN/ACEMİ seviyesinde.)"
            beginner_warning = "- DİKKAT: Kullanıcı acemi! İlk haftalarda mesafeleri çok kısa tut (Örn: 2-3km) ve antrenmanlara yürüyüş molaları ('easy' günlerde) ekleyebileceğini belirten başlıklar kullan."
        else:
            pace_info = f"{current_pace} sn/km"
            beginner_warning = ""

        max_dist = profile.get("max_distance", 0.0)
        weight = profile.get("weight")
        height = profile.get("height")
        gender = profile.get("gender")

    except Exception as e:
        logger.error(f"❌ Context Fetch Hatası: {e}")
        return "HATA: Profil verilerine şu an ulaşılamıyor."

    # --- ADIM 2: ARTIK STATE YERİNE DOĞRUDAN PARAMETRELERDEN ALIYORUZ ---
    if not selected_days or len(selected_days) == 0:
        return "HATA: Koşu günleri parametresi boş geldi. LLM chat geçmişinden 'selected_days' bilgisini çıkarmalı."
    
    workouts_per_week = len(selected_days)
    final_goal = goal or description

    # --- ADIM 3: PLANNER BAĞLAMI ÇIKAR ---
    logger.info("📝 Planner için kullanıcı tercihleri çıkarılıyor...")
    messages = state.get("messages", [])

    constraints = {"forbidden_types": [], "has_health_constraint": False}
    try:
        chat_context_summary, constraints = await extract_planner_context(
            tool_summarizer_llm, messages, goal=final_goal
        )
        logger.info(
            f"✅ Planner Bağlamı Alındı ({len(chat_context_summary)} karakter) "
            f"| kısıtlamalar={constraints}"
        )
    except Exception as e:
        logger.error(f"⚠️ Planner bağlamı çıkarma hatası: {e}")
        chat_context_summary = state.get("summary", "")

    # --- ADIM 4: SLOT HAVUZU ---
    available_slots = generate_available_slots(start_date, duration_weeks, selected_days)

    # [LONG_RUN_DAY] etiketi sadece long gerçekten plana girecekse anlamlı.
    # long YASAK ise etiketi hiç basmıyoruz — modelin "yok saymasını" beklemek
    # yerine kısıtlamayı kodda uyguluyoruz.
    long_is_forbidden = "long" in constraints.get("forbidden_types", [])
    if long_is_forbidden:
        long_run_weekday = -1
        logger.info("🚫 long YASAK — [LONG_RUN_DAY] etiketi slot'lara basılmıyor")
    else:
        long_run_weekday = map_day_name_to_int(long_run_day) if long_run_day else -1

    slots_payload = ""
    for slot in available_slots:
        day_idx = map_day_name_to_int(slot['day_name'])
        lr_tag = " [LONG_RUN_DAY]" if day_idx == long_run_weekday else ""
        slots_payload += f"day_offset={slot['offset']}, date={slot['date']}, day={slot['day_name']}{lr_tag}, week={slot['week_num']}\n"

    # --- ADIM 5: LLM PROMPT ---
    system_prompt = f"""Koşu koçu olarak {duration_weeks} haftalık antrenman programı oluştur.

KULLANICI: {gender}, {height}cm, {weight}kg | Pace: {pace_info} | Max mesafe: {max_dist}km | Hedef: {final_goal}
{beginner_warning}

BAĞLAM — KULLANICI KISITLAMALARI VE TERCİHLERİ:
{chat_context_summary}

ÖNCELİK SIRASI:
1. BAĞLAM en yüksek önceliklidir. "YASAK" işaretli tipi ASLA koyma. "AĞIRLIKLI"/"MİNİMAL" tercihlerine uy. BAĞLAM bir tipi yasaklasa bile koşu bilimine sadık, dolu bir program kur — kalan tiplerle çeşitlilik sağla.
2. Güvenlik kuralları (aşağıda) — esnetilemez.
3. BAĞLAM'da hiç kısıtlama/tercih yoksa varsayılan iskeleti uygula.

GÜVENLİK KURALLARI (esnetilemez):
- BAĞLAM'da veya "Hedef" satırında sakatlık / iyileşme / "yeni dönüyorum" geçiyorsa: interval ve tempo koyma, long'u minimal ve kısa tut, easy ağırlıklı git, mesafe artışını çok yavaş yap.
- Haftalık toplam mesafe artışı max %10 (baz: {max_dist}km).
- Acemi kullanıcı: ilk 2 hafta hiçbir antrenman 5km'yi geçmesin, interval/tempo koyma.
- Her slot tek antrenman. Arka arkaya zorlu antrenman (interval/tempo/long) koyma — aralarına easy gir.

VARSAYILAN İSKELET (sadece BAĞLAM boşsa):
- Haftada 1 kaliteli (interval/tempo) + 1 long + geri kalanı easy. 80/20: easy mesafesi long/tempo/interval'den kısa.
- [LONG_RUN_DAY] etiketli slot → "long" tipi.

BAŞLIK VE AÇIKLAMA:
- Başlıklar yaratıcı ve motive edici olsun.
- "description": interval → zorunlu detay (tekrar/mesafe/dinlenme). tempo → opsiyonel yapı. easy/long → boş string.

MÜSAİT SLOTLAR:
{slots_payload}
ÇIKTI — Yalnızca aşağıdaki JSON, başka metin yok. Her hafta tam {workouts_per_week} antrenman:
{{
  "workouts": [
    {{
      "day_offset": <integer, yukarıdaki offset değerlerinden biri>,
      "title": <string, yaratıcı Türkçe başlık>,
      "workout_type": <"easy" | "tempo" | "interval" | "long">,
      "distance_km": <float, örn: 5.0>,
      "target_pace_seconds": <integer, sn/km cinsinden hedef pace. Kullanıcının mevcut pace'i {pace_info}. Antrenman tipine göre ayarla: easy daha yavaş, tempo biraz hızlı, interval en hızlı, long orta-yavaş>,
      "description": <string, interval/tempo detayı veya boş string>
    }}
  ]
}}"""

    logger.info(f"📋 Planner Prompt:\n{system_prompt}")

    # --- ADIM 6: AI ÇAĞRISI ---
    try:
        response = await planner_llm.ainvoke(system_prompt)
        ai_data = extract_json_from_llm_response(response.content)
        raw_workouts = ai_data.get("workouts", [])
        logger.info(f"🤖 Planner LLM Çıktısı ({len(raw_workouts)} antrenman): {json.dumps(raw_workouts, ensure_ascii=False, indent=2)}")
    except ValueError as e:
        logger.error(f"❌ AI JSON Parse Hatası: {e}")
        return "HATA: AI planı geçerli bir formatta oluşturamadı."
    except Exception as e:
        logger.error(f"❌ AI Çağrı Hatası: {e}")
        return "HATA: AI planı oluştururken bir hata yaptı."

    # --- ADIM 7: MATEMATİK VE BACKEND PAYLOAD ---
    final_workout_objects = []
    valid_offsets = {s['offset'] for s in available_slots}

    for w in raw_workouts:
        offset = w.get("day_offset")
        if offset not in valid_offsets: continue

        dist = float(w.get("distance_km", 0))
        w_type = w.get("workout_type", "easy")
        pace = int(w.get("target_pace_seconds", 480))
        duration = calculate_duration(pace, dist)

        final_workout_objects.append({
            "day_offset": offset,
            "title": w.get("title", "Spark Koşusu"),
            "description": w.get("description", ""),
            "workout_type": w_type,
            "distance_km": dist,
            "target_pace_seconds": pace,
            "duration_minutes": duration
        })

    api_payload = {
        "title": title,
        "start_date": start_date,
        "duration_weeks": duration_weeks,
        "description": final_goal,
        "running_days": [map_day_name_to_int(d) for d in selected_days],
        "workouts": final_workout_objects
    }

    res = await call_api("POST", "/programs/create_ai_plan/", config, data=api_payload)
    
    if "error" in res: return f"API HATASI: {res['error']}"

    return f"✅ '{title}' programın oluşturuldu! Haftada {workouts_per_week} gün beraber koşuyoruz. İlk antrenmanın takvimine işlendi."



# ============================================================
# 📱 UI TOOLS (Frontend Triggers)
# ============================================================

@tool
def request_runner_profile():
    """
    Call this tool FIRST when starting a new plan flow.
    Triggers the 'Profile Confirmation Modal' on the Frontend.
    Used to verify: Weight, Current Pace, Experience Level.
    No arguments needed (Frontend pre-fills data).
    """
    return "UI_TRIGGER: PROFILE_UPDATE_MODAL"

@tool
def request_program_setup():
    """
    CONDITIONAL STEP 2: Call this ONLY IF the user hasn't specified ALL FOUR essential program details:
    1. A Goal (e.g., 'Marathon', '5K').
    2. Difficulty Level (e.g., 'Beginner', 'Advanced').
    3. Start Date (e.g., 'Tomorrow', 'Next Monday').
    4. Duration/End Date (e.g., '12 weeks', 'Until April').
    
    Triggers the Comprehensive Setup Modal.
    """
    return "UI_TRIGGER: PROGRAM_SETUP_MODAL"

@tool
def request_availability_preferences():
    """
    CONDITIONAL STEP 3: Call this tool to set the WEEKLY SCHEDULE logic.
    Triggers a Modal that asks for:
    1. Frequency: How many days per week the user wants to run.
    2. Availability: Which specific days they are available (Must be >= Frequency).
    3. Long Run: Preferred day for the long run (Optional, selected from available days).
    """
    return "UI_TRIGGER: AVAILABILITY_MODAL"

@tool
def request_plan_confirmation(message: str) -> str:
    """
    FINAL STEP before creating a workout plan. Call this tool RIGHT BEFORE calling create_workout_plan.
    Triggers a confirmation widget on the Frontend with the given message.
    The user can respond with 'Yes', 'No', or a custom input (e.g., feedback/adjustment request).

    Args:
        message: The confirmation question to display to the user (e.g., 'Programını oluşturmaya hazır mısın?')
    """
    return "UI_TRIGGER: PLAN_CONFIRMATION_MODAL"