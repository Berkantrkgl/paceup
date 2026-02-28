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

# Özetleme için hafif modeli tanımlıyoruz
tool_summarizer_llm = ChatBedrockConverse(
    model=NOVA_LITE_2, # Senin NOVA_LITE_2 değişkenin
    region_name="us-east-1",
    temperature=0.5,
    max_tokens=4096,
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


def calculate_pace_and_duration(base_pace: Optional[int], w_type: str, distance: float) -> dict:
    """
    Süre ve Pace hesabını Python katmanında yaparak halüsinasyonu önler.
    Kullanıcının hızı yoksa 480sn (8:00 dk/km) baz alınır.
    """
    # Fallback: Pace yoksa veya çok düşükse 8:00 (480sn) al
    actual_base = base_pace if (base_pace and base_pace >= 180) else 480 

    # Antrenman tipine göre pace çarpanları
    multipliers = {
        'easy': 1.20,      # Daha yavaş
        'long': 1.15,      # Orta-yavaş
        'tempo': 0.95,     # Hızlı
        'interval': 0.85   # Çok hızlı
    }
    
    pace = int(actual_base * multipliers.get(w_type, 1.0))
    duration = int(math.ceil((distance * pace) / 60)) if distance > 0 else 0
    return {"pace": pace, "duration": duration}





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
def create_workout_plan(
    title: str, 
    start_date: str, 
    duration_weeks: int, 
    description: str,
    selected_days: List[str],  # YENİ
    long_run_day: Optional[str],  # YENİ
    goal: str,  # YENİ
    config: RunnableConfig,
    state: Annotated[dict, InjectedState] 
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
        full_context = fetch_user_info_for_program_creation(config)
        if "error" in full_context:
            return f"HATA: Kullanıcı verileri alınamadı: {full_context['error']}"

        profile = full_context.get("user_profile", {})
        
        current_pace = profile.get("current_pace")

        if not current_pace:
            pace_info = "BİLİNMİYOR (Kullanıcı hızını bilmiyor, koşuya YENİ BAŞLAYAN/ACEMİ seviyesinde.)"
            beginner_warning = "- DİKKAT: Kullanıcı acemi! İlk haftalarda mesafeleri çok kısa tut (Örn: 2-3km) ve antrenmanlara yürüyüş molaları ('easy' günlerde) ekleyebileceğini belirten başlıklar kullan."
            actual_pace_for_math = 480
        else:
            pace_info = f"{current_pace} sn/km"
            beginner_warning = ""
            actual_pace_for_math = current_pace

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

    try:
        chat_context_summary = extract_planner_context(tool_summarizer_llm, messages)
        logger.info(f"✅ Planner Bağlamı Alındı ({len(chat_context_summary)} karakter)")
    except Exception as e:
        logger.error(f"⚠️ Planner bağlamı çıkarma hatası: {e}")
        chat_context_summary = state.get("summary", "")

    # --- ADIM 4: SLOT HAVUZU ---
    available_slots = generate_available_slots(start_date, duration_weeks, selected_days)
    long_run_weekday = map_day_name_to_int(long_run_day) if long_run_day else -1

    slots_payload = ""
    for i, slot in enumerate(available_slots):
        day_idx = map_day_name_to_int(slot['day_name'])
        lr_tag = " [LONG_RUN_DAY]" if day_idx == long_run_weekday else ""
        slots_payload += f"ID {i}: offset={slot['offset']}, date={slot['date']}, day={slot['day_name']}{lr_tag}, week={slot['week_num']}\n"

    # --- ADIM 5: LLM PROMPT ---
    system_prompt = f"""Koşu koçu olarak {duration_weeks} haftalık antrenman programı oluştur.

KULLANICI: {gender}, {height}cm, {weight}kg | Pace: {pace_info} | Max mesafe: {max_dist}km | Hedef: {final_goal}
BAĞLAM: {chat_context_summary}
{beginner_warning}
KURALLAR:
1. Haftalık iskelet: 1 kaliteli (interval/tempo) + 1 uzun (long) + geri kalanı easy
2. Arka arkaya zorlu antrenman (interval/tempo/long) yasak — aralarına mutlaka easy gir
3. Easy mesafesi her zaman long/interval/tempo mesafesinden kısa olmalı (80/20)
4. [LONG_RUN_DAY] slotu → her zaman "long" tipi; hemen sonraki slot → her zaman "easy"
5. Haftalık mesafe artışı max %10 ({max_dist}km baz al)
6. Antrenman başlıkları yaratıcı ve motive edici olsun

MÜSAİT SLOTLAR:
{slots_payload}
ÇIKTI — Yalnızca aşağıdaki JSON, başka metin yok. Her hafta tam {workouts_per_week} antrenman:
{{
  "workouts": [
    {{
      "day_offset": <integer, yukarıdaki offset değerlerinden biri>,
      "title": <string, yaratıcı Türkçe başlık>,
      "workout_type": <"easy" | "tempo" | "interval" | "long">,
      "distance_km": <float, örn: 5.0>
    }}
  ]
}}"""

    print('Planner LLM Prompt')
    print(system_prompt)
    
    # --- ADIM 6: AI ÇAĞRISI ---
    try:
        llm = ChatBedrockConverse(model=SONNET_4, temperature=0, region_name="us-east-1", disable_streaming=True)
        response = llm.invoke(system_prompt)
        ai_data = extract_json_from_llm_response(response.content)
        raw_workouts = ai_data.get("workouts", [])
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
        
        math_data = calculate_pace_and_duration(actual_pace_for_math, w_type, dist)
        
        final_workout_objects.append({
            "day_offset": offset,
            "title": w.get("title", "Spark Koşusu"),
            "workout_type": w_type,
            "distance_km": dist,
            "target_pace_seconds": math_data["pace"],
            "duration_minutes": math_data["duration"]
        })

    api_payload = {
        "title": title,
        "start_date": start_date,
        "duration_weeks": duration_weeks,
        "description": final_goal,
        "running_days": [map_day_name_to_int(d) for d in selected_days],
        "workouts": final_workout_objects
    }

    res = call_api("POST", "/programs/create_ai_plan/", config, data=api_payload)
    
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