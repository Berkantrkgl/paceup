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

from agent.utils.helper_functions import call_api, fetch_user_info_for_program_creation
from agent.utils.config import *

logger = logging.getLogger(__name__)

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
# 1. DATA MODELS (Sadeleştirilmiş)
# ============================================================

class CreatePlanInput(BaseModel):
    title: str = Field(..., description="Programın başlığı (Örn: Maraton Yolculuğu)")
    start_date: str = Field(..., description="YYYY-MM-DD formatında başlangıç tarihi")
    duration_weeks: int = Field(..., description="Programın toplam kaç hafta süreceği")
    description: Optional[str] = Field(default="", description="Kullanıcının hedefi veya özel isteği")

# ============================================================
# 2. PYTHON LOGIC (Güncellenmiş Pace ve Slot Mantığı)
# ============================================================

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

# ============================================================
# 3. CREATE WORKOUT PLAN TOOL (Refactored)
# ============================================================

# agent/utils/tools.py içerisindeki tool fonksiyonunu güncelle:

from agent.utils.helper_agents import summarize_messages

# Özetleme için hafif modeli tanımlıyoruz
tool_summarizer_llm = ChatBedrockConverse(
    model=NOVA_LITE_2, # Senin NOVA_LITE_2 değişkenin
    region_name="us-east-1",
    temperature=0.5,
    max_tokens=4096,
)

@tool(args_schema=CreatePlanInput)
def create_workout_plan(
    title: str, 
    start_date: str, 
    duration_weeks: int, 
    description: str,
    config: RunnableConfig,
    state: Annotated[dict, InjectedState] 
) -> str:
    """
    Kullanıcının profil verilerini (pace, mesafe) ve seçtiği günleri 
    kullanarak matematiksel olarak optimize edilmiş bir koşu planı oluşturur.
    """
    logger.info(f"🚀 Spark Planlama Başlatıldı: {title}")

    # --- ADIM 1: USER CONTEXT ÇEKME ---
    try:
        full_context = fetch_user_info_for_program_creation(config)
        if "error" in full_context:
            return f"HATA: Kullanıcı verileri alınamadı: {full_context['error']}"

        profile = full_context.get("user_profile", {})
        
        current_pace = profile.get("current_pace")
        max_dist = profile.get("max_distance", 0.0)
        weight = profile.get("weight")
        height = profile.get("height")
        gender = profile.get("gender")

    except Exception as e:
        logger.error(f"❌ Context Fetch Hatası: {e}")
        return "HATA: Profil verilerine şu an ulaşılamıyor."

    # --- ADIM 2: TERCİHLERİ DOĞRUDAN STATE'TEN AL ---
    user_prefs = state.get("user_preferences", {})
    
    selected_days = user_prefs.get("selected_days", [])
    long_run_day = user_prefs.get("long_run_day")
    goal_from_chat = user_prefs.get("goal")

    print('USER PREF FROM STAT: ', user_prefs)
    if not selected_days:
        return "HATA: Koşu günlerini belirlemeden plan yapamam. Lütfen sistemde bir hata oluştuğunu belirtin ve günleri tekrar sorun."
    
    workouts_per_week = len(selected_days)
    final_goal = goal_from_chat or description

    # --- ADIM 3: SOHBET GEÇMİŞİNİ ÖZETLE (YENİ EKLENEN KISIM) ---
    logger.info("📝 Tool İçinde Sohbet Özeti Çıkarılıyor...")
    messages = state.get("messages", [])
    
    # State içindeki ana özeti al (yoksa boş string)
    existing_summary = state.get("summary", "") 
    
    try:
        chat_context_summary = summarize_messages(tool_summarizer_llm, messages, existing_summary)
        logger.info(f"✅ Tool Özeti Alındı ({len(chat_context_summary)} karakter)")
    except Exception as e:
        logger.error(f"⚠️ Sohbet özetleme hatası (Tool İçi): {e}")
        chat_context_summary = existing_summary # Hata olursa elimizdeki son geçerli özeti kullanalım

    # --- ADIM 4: SLOT HAVUZU ---
    available_slots = generate_available_slots(start_date, duration_weeks, selected_days)
    long_run_weekday = map_day_name_to_int(long_run_day) if long_run_day else -1

    slots_payload = ""
    for i, slot in enumerate(available_slots):
        day_idx = map_day_name_to_int(slot['day_name'])
        lr_tag = " [LONG_RUN_DAY]" if day_idx == long_run_weekday else ""
        slots_payload += f"ID {i}: offset={slot['offset']}, date={slot['date']}, day={slot['day_name']}{lr_tag}, week={slot['week_num']}\n"

    # --- ADIM 5: LLM PROMPT (SOHBET ÖZETİ İLE ZENGİNLEŞTİRİLDİ) ---
    system_prompt = f"""
Uzman Koşu Koçu 'Spark' olarak, kullanıcıya {duration_weeks} haftalık program planla.

KULLANICI VERİLERİ:
- Cinsiyet/Boy/Kilo: {gender}, {height}cm, {weight}kg
- Mevcut Pace: {current_pace if current_pace else 480} sn/km
- Max Koşulan Mesafe: {max_dist}km
- Hedef: {final_goal}

KULLANICIYLA YAPILAN GÖRÜŞMENİN ÖZETİ:
"{chat_context_summary}"
*(Lütfen antrenman başlıklarını ve ilerlemeyi bu bağlama ve kullanıcının ruh haline göre kişiselleştir.)*

KURALLAR:
1. Her hafta için tam olarak {workouts_per_week} adet antrenman seç.
2. [LONG_RUN_DAY] slotunu mutlaka 'long' run tipi için kullan.
3. Workout Tipleri: 'easy', 'tempo', 'interval', 'long'.
4. Mesafeleri haftalık %10 artış kuralına göre, kullanıcının max mesafesi ({max_dist}km) üzerinden kademeli artır.

MÜSAİT SLOTLAR:
{slots_payload}

ÇIKTI SADECE JSON:
{{
  "workouts": [
    {{ "day_offset": 0, "title": "Açılış Koşusu", "workout_type": "easy", "distance_km": 5.0 }},
    ...
  ]
}}
"""

    print('Planner LLM Prompt')
    print(system_prompt)
    # --- ADIM 6: AI ÇAĞRISI ---
    try:
        llm = ChatBedrockConverse(model=SONNET_4, temperature=0, region_name="us-east-1", disable_streaming=True)
        response = llm.invoke(system_prompt)
        content = response.content.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(content)
        raw_workouts = ai_data.get("workouts", [])
    except Exception as e:
        logger.error(f"❌ AI JSON Hatası: {e}")
        return "HATA: AI planı oluştururken bir hata yaptı."

    # --- ADIM 7: MATEMATİK VE BACKEND PAYLOAD ---
    final_workout_objects = []
    valid_offsets = {s['offset'] for s in available_slots}

    for w in raw_workouts:
        offset = w.get("day_offset")
        if offset not in valid_offsets: continue
        
        dist = float(w.get("distance_km", 0))
        w_type = w.get("workout_type", "easy")
        
        math_data = calculate_pace_and_duration(current_pace, w_type, dist)
        
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