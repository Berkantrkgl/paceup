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

# Helper fonksiyonlar
from agent.utils.helper_functions import call_api, fetch_user_context_data
from agent.utils.config import *

logger = logging.getLogger(__name__)

# ============================================================
# 1. DATA MODELS
# ============================================================

class WorkoutItemInput(BaseModel):
    day_offset: int = Field(..., description="The ID provided in the slot list.")
    title: str = Field(..., description="Creative, fun title for the workout.")
    workout_type: Literal['tempo', 'easy', 'interval', 'long'] 
    distance_km: float = Field(..., description="Distance in km.")
    
    @field_validator('distance_km')
    def check_distance(cls, v):
        if v < 0: raise ValueError("Distance cannot be negative.")
        return round(v, 2)

class PlannerOutput(BaseModel):
    workouts: List[WorkoutItemInput] = Field(..., description="List of workouts.")

class CreatePlanInput(BaseModel):
    title: str = Field(..., description="Program Title")
    start_date: str = Field(..., description="YYYY-MM-DD")
    duration_weeks: int = Field(..., description="Total weeks")
    workouts_per_week: int = Field(..., description="Workouts per week")
    description: Optional[str] = Field(default="", description="User's Goal/Request (Context)")

# ============================================================
# 2. PYTHON LOGIC (CALENDAR & MATH)
# ============================================================

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

def generate_schedule_skeleton(start_date_str: str, duration_weeks: int, selected_days: List[str]) -> List[Dict]:
    """
    Tarihleri Python hesaplar. Seçilen günleri (selected_days) baz alır.
    """
    try:
        start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").date()
    except:
        start_date = datetime.date.today() + datetime.timedelta(days=1)

    # Seçilen günleri sayısal değere çevir (Set içinde tutarız hızlı arama için)
    target_weekdays = {map_day_name_to_int(d) for d in selected_days}
    
    skeleton = []
    # Garanti olsun diye biraz fazla gün tarayalım
    scan_limit = (duration_weeks * 7) + 14 
    current_date = start_date
    
    for _ in range(scan_limit):
        days_diff = (current_date - start_date).days
        week_num = (days_diff // 7) + 1
        
        if week_num > duration_weeks:
            break

        # Eğer o gün kullanıcının seçtiği günlerden biriyse listeye ekle
        if current_date.weekday() in target_weekdays:
            skeleton.append({
                "offset": days_diff,
                "date": current_date.strftime("%Y-%m-%d"),
                "day_name": current_date.strftime("%A"),
                "week_num": week_num
            })
            
        current_date += datetime.timedelta(days=1)

    return skeleton

def calculate_pace_and_duration(base_pace: int, w_type: str, distance: float) -> dict:
    """
    Süre hesabını Python yapar (Deterministik).
    """
    if not base_pace or base_pace < 180: 
        base_pace = 360  # Default 6:00 pace

    # Pace Ayarı (Mantıklı çarpanlar)
    if w_type == 'easy': 
        pace = int(base_pace * 1.20)     # %20 Yavaş
    elif w_type == 'long': 
        pace = int(base_pace * 1.15)     # %15 Yavaş
    elif w_type == 'tempo': 
        pace = int(base_pace * 0.95)     # %5 Hızlı
    elif w_type == 'interval': 
        pace = int(base_pace * 0.85)     # %15 Hızlı
    else: 
        pace = base_pace

    # Süre Ayarı (dk)
    duration = int(math.ceil((distance * pace) / 60)) if distance > 0 else 0
    
    return {"pace": pace, "duration": duration}

# ============================================================
# 3. CREATE WORKOUT PLAN TOOL
# ============================================================

@tool(args_schema=CreatePlanInput)
def create_workout_plan(
    title: str, 
    start_date: str, 
    duration_weeks: int, 
    workouts_per_week: int, 
    description: str,
    config: RunnableConfig,
    state: Annotated[dict, InjectedState] 
) -> str:
    """
    Creates a workout plan with AI-generated exercises.
    Robustly extracts user schedule preferences from chat history.
    """
    
    logger.info("="*60)
    logger.info(f"🚀 CREATE_WORKOUT_PLAN BAŞLADI")
    logger.info(f"📋 Parametreler: {workouts_per_week} gün/hafta, Başlangıç: {start_date}")

    # 1. KULLANICI VERİSİ
    try:
        user_context = fetch_user_context_data(config)
        current_pace = user_context.get("current_pace", 360)
        experience_level = user_context.get("experience_level", "intermediate")
    except Exception as e:
        logger.error(f"❌ Kullanıcı verisi alınamadı: {e}")
        return "HATA: Kullanıcı bilgileri alınamadı."

    # 2. CHAT GEÇMİŞİNDEN GÜNLERİ BUL (DAHA GÜÇLÜ YÖNTEM)
    logger.info("🔍 Chat geçmişinden tercihler aranıyor...")
    messages = state.get("messages", [])
    
    selected_days = []
    frequency = workouts_per_week
    long_run_day = None
    found_preferences = False
    
    # Mesajları tersten tara (en güncel tercihleri bulmak için)
    for msg in reversed(messages):
        if msg.type == "tool":
            try:
                # İçeriği parse etmeye çalış
                content = msg.content
                if isinstance(content, str):
                    try:
                        data = json.loads(content)
                    except:
                        continue # JSON değilse atla
                elif isinstance(content, dict):
                    data = content
                else:
                    continue

                # KONTROL 1: İsimle kontrol (Varsa)
                is_target_tool = hasattr(msg, 'name') and msg.name == "request_availability_preferences"
                
                # KONTROL 2: İçerik yapısıyla kontrol (İsim None gelse bile kurtarır)
                has_target_keys = isinstance(data, dict) and "days" in data and "frequency" in data

                if is_target_tool or has_target_keys:
                    frequency = data.get("frequency", workouts_per_week)
                    selected_days = data.get("days", [])
                    long_run_day = data.get("long_run")
                    
                    found_preferences = True
                    logger.info(f"✅ TERCİHLER BULUNDU: {frequency} gün/hafta, Günler={selected_days}, Uzun={long_run_day}")
                    break # Bulunca döngüden çık
            except Exception as e:
                logger.warning(f"⚠️ Mesaj işlenirken hata: {e}")
                continue
    
    # Hâlâ gün bulunamadıysa Fallback (Ama artık loglardan görüyoruz ki JSON doğru geliyor, yukarıdaki kod yakalayacak)
    if not selected_days:
        logger.warning("⚠️ Tercihler bulunamadı, varsayılanlar kullanılıyor.")
        if frequency >= 4:
            selected_days = ["Tue", "Thu", "Sat", "Sun"]
        elif frequency == 3:
            selected_days = ["Mon", "Wed", "Fri"] # Senin istediğin default bu olabilir
        else:
            selected_days = ["Tue", "Fri"]
        logger.info(f"📅 Fallback Günler: {selected_days}")

    # 3. TAKVİM OLUŞTURMA (PYTHON - KESİN TARİHLER)
    
    # Tarihi parse et
    try:
        start_date_obj = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    except:
        start_date_obj = datetime.date.today() + datetime.timedelta(days=1)
        start_date = start_date_obj.strftime("%Y-%m-%d")

    # Takvim iskeletini oluştur
    workout_slots = generate_schedule_skeleton(start_date, duration_weeks, selected_days)
    
    # Uzun koşu gününü işaretle
    if long_run_day:
        long_run_weekday = map_day_name_to_int(long_run_day)
        for slot in workout_slots:
            slot_date = datetime.datetime.strptime(slot["date"], "%Y-%m-%d").date()
            slot["is_long_run"] = (slot_date.weekday() == long_run_weekday)
    else:
        # Uzun koşu günü seçilmediyse, haftanın son antrenmanını uzun yap
        pass # AI aşağıda halleder veya default bırakırız

    # Frekans Limiti (Eğer seçilen gün sayısı frekanstan fazlaysa kırp)
    # Örn: Kullanıcı 4 gün seçti ama haftada 3 dedi -> Önceliklendirme yap
    final_slots = []
    
    for week in range(1, duration_weeks + 1):
        week_slots = [s for s in workout_slots if s["week_num"] == week]
        
        # Eğer o hafta için bulunan gün sayısı, hedeflenen frekanstan fazlaysa
        if len(week_slots) > frequency:
            # 1. Uzun koşu gününü kesin al
            long_runs = [s for s in week_slots if s.get("is_long_run", False)]
            other_runs = [s for s in week_slots if not s.get("is_long_run", False)]
            
            week_final = []
            if long_runs:
                week_final.extend(long_runs[:1]) # Max 1 uzun
                remaining_needed = frequency - 1
                week_final.extend(other_runs[:remaining_needed])
            else:
                week_final.extend(week_slots[:frequency])
            
            # Tarih sırasına göre dizip ekle
            week_final.sort(key=lambda x: x['offset'])
            final_slots.extend(week_final)
        else:
            final_slots.extend(week_slots)

    workout_slots = final_slots
    logger.info(f"✅ Takvim Hazır: {len(workout_slots)} antrenman slotu oluşturuldu.")

    # 4. AI ANTRENMAN İÇERİĞİ OLUŞTURMA
    
    # Prompt için slotları metne dök
    slots_text = ""
    for i, slot in enumerate(workout_slots):
        day_name = slot.get("day_name", "Unknown")[:3]
        long_tag = " [LONG_RUN_DAY]" if slot.get("is_long_run") else ""
        slots_text += f"Slot {i}: day_offset={slot['offset']}, date={slot['date']}, day={day_name}, week={slot['week_num']}{long_tag}\n"

    system_prompt = f"""You are a professional running coach creating a {duration_weeks}-week training program.

USER PROFILE:
- Goal: {description}
- Experience: {experience_level}
- Current pace: {current_pace//60}:{current_pace%60:02d}/km
- Weekly Schedule: {selected_days}

WORKOUT SLOTS (Fill EXACTLY these slots):
{slots_text}

INSTRUCTIONS:
1. Create exactly one workout for each slot above using the `day_offset`.
2. **Day Matching:** Ensure the workout type fits the day.
   - If slot is marked [LONG_RUN_DAY], you MUST set `workout_type` to "long".
3. **Variety:**
   - Don't just spam "easy".
   - Include "tempo" or "interval" once a week for variety if the user is not a complete beginner.
   - "easy" runs are for recovery between hard days.
4. **Progression:**
   - Start moderate.
   - Build distance gradually.
   - Taper in the last week.

TITLES:
- Use creative, motivating TURKISH titles. (e.g., "Hafta Ortası Ateşi", "Pazar Uzunu", "Toparlanma Koşusu")

Return ONLY valid JSON:
{{"workouts": [
  {{"day_offset": 0, "title": "Başlangıç Koşusu", "workout_type": "easy", "distance_km": 5.0}},
  ...
]}}"""

    try:
        llm_planner = ChatBedrockConverse(
            model=SONNET_45,
            temperature=0.2,
            max_tokens=4096,
            region_name="us-east-1",
            disable_streaming=True
        )
        
        logger.info("🤖 AI antrenmanları planlıyor...")
        response = llm_planner.invoke(system_prompt)
        
        # Yanıtı işle
        response_text = response.content
        if isinstance(response_text, list):
            response_text = "".join([c.get("text", "") for c in response_text if isinstance(c, dict)])
        
        # JSON'ı ayıkla
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            plan_data = json.loads(json_match.group())
            workouts_list = plan_data.get("workouts", [])
        else:
            raise Exception("JSON bulunamadı")
            
        logger.info(f"✅ AI {len(workouts_list)} antrenman oluşturdu.")

    except Exception as e:
        logger.error(f"❌ AI Hatası: {e}")
        return f"HATA: AI planlama hatası - {str(e)}"

    # 5. FORMAT DÖNÜŞÜMÜ & KAYDETME
    final_workouts = []
    
    # Python ile oluşturduğumuz takvim slotlarındaki offsetlerin kümesi (doğrulama için)
    valid_offsets = {s['offset'] for s in workout_slots}

    for workout in workouts_list:
        try:
            day_offset = workout.get("day_offset")
            
            # Eğer AI, bizim takvimimizde olmayan bir offset uydurduysa atla
            if day_offset not in valid_offsets:
                continue

            w_type = workout.get("workout_type", "easy")
            distance = float(workout.get("distance_km", 5.0))
            title = workout.get("title", "Koşu Antrenmanı")
            
            # Python ile süre ve pace hesapla
            pace_info = calculate_pace_and_duration(current_pace, w_type, distance)
            
            workout_data = {
                "day_offset": day_offset,
                "title": title,
                "workout_type": w_type,
                "distance_km": distance,
                "target_pace_seconds": pace_info["pace"],
                "duration_minutes": pace_info["duration"]
            }
            final_workouts.append(workout_data)
            
        except Exception as e:
            continue

    if not final_workouts:
        return "HATA: Antrenman listesi oluşturulamadı."

    # Backend'e gönder
    payload = {
        "title": title,
        "start_date": start_date,
        "duration_weeks": duration_weeks,
        "workouts_per_week": len(final_workouts) // duration_weeks, # Ortalama frekans
        "description": description,
        "workouts": final_workouts
    }

    try:
        response = call_api("POST", "/programs/create_ai_plan/", config, data=payload)
        
        if "error" in response:
            return f"❌ API HATASI: {response['error']}"

        program_id = response.get('program_id', 'Unknown')
        return f"✅ Program başarıyla oluşturuldu!\n📋 ID: {program_id}\n🏃‍♂️ {len(final_workouts)} antrenman planlandı."

    except Exception as e:
        return f"HATA: Backend sorunu - {str(e)}"


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