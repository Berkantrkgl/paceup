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
from agent.utils.helper_functions import call_api, fetch_user_info_for_program_creation
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
    workouts: List[WorkoutItemInput] = Field(..., description="List of selected workouts.")

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

def calculate_pace_and_duration(base_pace: int, w_type: str, distance: float) -> dict:
    """
    Süre hesabını Python yapar.
    """
    if not base_pace or base_pace < 180: base_pace = 360 

    # Pace Ayarı (Mantıklı çarpanlar)
    if w_type == 'easy': pace = int(base_pace * 1.20)
    elif w_type == 'long': pace = int(base_pace * 1.15)
    elif w_type == 'tempo': pace = int(base_pace * 0.95)
    elif w_type == 'interval': pace = int(base_pace * 0.85)
    else: pace = base_pace

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
    Bir antreman planı oluşturmak için kullanılır.

    Args:
        title (str): Programın adı/başlığı.
        start_date (str): Programın başlangıç tarihi (Format: YYYY-AA-GG).
        duration_weeks (int): Programın kaç hafta süreceği.
        workouts_per_week (int): Haftalık antrenman sayısı.
        description (str): Programın amacı veya kısa açıklaması.

    Returns:
        str: Programın oluşturulduğuna dair onay mesajı.
    """
    
    logger.info("="*60)
    logger.info(f"🚀 CREATE_WORKOUT_PLAN BAŞLADI")

    # --- 1. YENİ FONKSİYON İLE VERİ ÇEKME ---
    try:
        # Yeni yazdığımız özelleştirilmiş fonksiyonu çağırıyoruz
        full_context = fetch_user_info_for_program_creation(config)
        
        if "error" in full_context:
            return f"HATA: {full_context['error']}"

        # Verileri Ayrıştır
        profile = full_context.get("user_profile", {})
        history = full_context.get("history", {})

        # Profil Verileri
        current_pace = profile.get("current_pace", 360)
        experience_level = profile.get("experience_level", "beginner")
        weight = profile.get("weight", "Unknown")
        height = profile.get("height", "Unknown")
        gender = profile.get("gender", "Unknown")
        max_dist = profile.get("max_distance", 0)
        
        # Geçmiş Verileri
        total_workouts = history.get("total_workouts", 0)
        total_distance = history.get("total_distance", 0)

        logger.info(f"👤 USER CONTEXT LOADED: {gender}, {height}cm, {weight}kg, MaxDist: {max_dist}km")

    except Exception as e:
        logger.error(f"❌ Veri işleme hatası: {e}", exc_info=True)
        return "HATA: Kullanıcı verileri işlenirken sorun oluştu."

    # --- 2. CHAT GEÇMİŞİNDEN TERCİHLERİ VE HEDEFİ BUL ---
    logger.info("🔍 Chat geçmişinden detaylı tercihler aranıyor...")
    messages = state.get("messages", [])
    
    # Hedef Değişkenler
    selected_days = []
    long_run_day = None
    
    goal_from_chat = None
    difficulty_from_chat = None
    
    # Mesajları tersten tara (en güncelden eskiye)
    for msg in reversed(messages):
        if msg.type == "tool":
            try:
                content = msg.content
                data = json.loads(content) if isinstance(content, str) else content
                if not isinstance(data, dict): continue

                # A) SETUP BİLGİLERİ (Goal, Difficulty)
                # Tool ismi 'request_program_setup' ise VEYA 'goal'/'difficulty' keyleri varsa
                is_setup_tool = hasattr(msg, 'name') and msg.name == "request_program_setup"
                has_setup_keys = "goal" in data or "difficulty" in data
                
                if (is_setup_tool or has_setup_keys) and goal_from_chat is None:
                    goal_from_chat = data.get("goal")
                    difficulty_from_chat = data.get("difficulty")
                    logger.info(f"🎯 Hedef Bulundu: {goal_from_chat} ({difficulty_from_chat})")

                # B) AVAILABILITY BİLGİLERİ (Günler)
                # Tool ismi 'request_availability_preferences' ise VEYA 'days' keyi varsa
                is_pref_tool = hasattr(msg, 'name') and msg.name == "request_availability_preferences"
                has_days_key = "days" in data
                
                if (is_pref_tool or has_days_key) and not selected_days:
                    selected_days = data.get("days", [])
                    long_run_day = data.get("long_run")
                    logger.info(f"📅 Günler Bulundu: {selected_days}")
                    
                # C) ÇIKIŞ KOŞULU
                # Hem günleri hem hedefi bulduysak döngüyü bitir.
                if selected_days and goal_from_chat:
                    logger.info("✅ Gerekli tüm context verileri toplandı.")
                    break
                    
            except Exception as e:
                continue

    # --- FALLBACK (Eksik veri varsa tamamla) ---
    if not selected_days:
        selected_days = ["Mon", "Wed", "Fri", "Sun"] # Varsayılan
        
    if not goal_from_chat:
        goal_from_chat = description # Tool argümanından gelen
        
    if not difficulty_from_chat:
        difficulty_from_chat = experience_level # Kullanıcı profilinden gelen

    # --- 3. SLOT HAVUZU OLUŞTUR (FİLTRESİZ) ---
    # Python burada karar vermiyor, sadece seçenekleri sunuyor.
    available_slots = generate_available_slots(start_date, duration_weeks, selected_days)
    
    # Uzun koşu gününü işaretle
    long_run_weekday = map_day_name_to_int(long_run_day) if long_run_day else -1
    
    for slot in available_slots:
        slot_date = datetime.datetime.strptime(slot["date"], "%Y-%m-%d").date()
        if slot_date.weekday() == long_run_weekday:
            slot["is_long_run"] = True
        else:
            slot["is_long_run"] = False

    logger.info(f"✅ Müsait Gün Havuzu: {len(available_slots)} adet slot sunuluyor.")

    # --- 4. SYSTEM PROMPT (VERİLERİ EKSİKSİZ VERİYORUZ) ---
    slots_text = ""
    for i, slot in enumerate(available_slots):
        day_name = slot.get("day_name", "Unknown")[:3]
        long_tag = " [LONG_RUN_DAY]" if slot.get("is_long_run") else ""
        slots_text += f"Slot {i}: day_offset={slot['offset']}, date={slot['date']}, day={day_name}, week={slot['week_num']}{long_tag}\n"

    system_prompt = f"""
You are an expert Running Coach named 'Spark'. create a {duration_weeks}-week training program.

USER PROFILE:
- **Physical:** Weight: {weight}kg, Height: {height}cm, Gender: {gender}
- **Performance:** Current Pace: {current_pace//60}:{current_pace%60:02d}/km, Max Distance Run: {max_dist}km
- **History:** Total Workouts: {total_workouts}, Total Distance: {total_distance}km
- **Level:** {experience_level}

PROGRAM REQUIREMENTS:
- **Goal:** {goal_from_chat}
- **Program Difficulty:** {difficulty_from_chat} 
- **Target Frequency:** {workouts_per_week} workouts per week.
- **Weekly Schedule:** User is available on {selected_days}.

AVAILABLE WORKOUT SLOTS (Pool of options):
{slots_text}    

INSTRUCTIONS:
1. **Selection Strategy:** - You MUST select exactly **{workouts_per_week}** slots for each week from the list above.
2. **Mandatory Long Run:** - If a week has a slot marked **[LONG_RUN_DAY]**, you MUST select it.
3. **Workout Design:**
   - **Long Run:** Must be on [LONG_RUN_DAY]. Increase distance gradually based on user's Max Distance ({max_dist}km).
   - **Variety:** Include Interval/Tempo runs if frequency > 2.
   - **Rest:** Ensure recovery between hard sessions.
   - **Workout Types:** You have 4 option in tota (tempo, easy, interval, long)
4. **Output:** Return ONLY valid JSON for the selected slots.
    OUTPUT SCHEMA (YOU MUST FOLLOW IT):
    {{
    "workouts": [
        {{
        "day_offset": 5, 
        "title": "Hafta Sonu Uzunu", 
        "workout_type": "long", 
        "distance_km": 10.0
        }},
        ...
    ]
    }}

TITLES:
- Use motivating TURKISH titles.
"""

    # --- 5. LLM CALL ---
    try:
        llm_planner = ChatBedrockConverse(
            model=SONNET_4,
            temperature=0.7, # Yaratıcılık için biraz pay bırak ama yapı bozulmasın
            max_tokens=20000,
            region_name="us-east-1",
            disable_streaming=True
        )
        logger.info(f"SYSTEM PROMTP: {system_prompt}")
        logger.info("🤖 AI antrenmanları seçiyor ve planlıyor...")
        response = llm_planner.invoke(system_prompt)
        
        # JSON Parse
        response_text = response.content
        logger.info(f"LLM RESPONSE: {response_text}")
        if isinstance(response_text, list):
            response_text = "".join([c.get("text", "") for c in response_text if isinstance(c, dict)])
        
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        
        workouts_list = []
        if json_match:
            plan_data = json.loads(json_match.group())
            
            # SENARYO A: Düzgün format
            if "workouts" in plan_data and isinstance(plan_data["workouts"], list):
                workouts_list = plan_data["workouts"]
                
            # SENARYO B: 'weeks' içine gömülmüş format (Kurtarma Operasyonu)
            elif "weeks" in plan_data:
                logger.info("⚠️ LLM 'weeks' yapısı döndü, düzleştiriliyor...")
                for week in plan_data["weeks"]:
                    if "workouts" in week:
                        workouts_list.extend(week["workouts"])
            
            else:
                logger.error(f"❌ JSON yapısı tanınamadı: {plan_data.keys()}")
        else:
            raise Exception("JSON bulunamadı")

        logger.info(f"✅ AI {len(workouts_list)} antrenman seçti.")

    except Exception as e:
        logger.error(f"❌ AI Hatası: {e}")
        return f"HATA: AI planlama hatası - {str(e)}"

    # --- 6. FORMATLAMA VE KAYDETME ---
    final_workouts = []
    valid_offsets = {s['offset'] for s in available_slots}

    for workout in workouts_list:
        try:
            day_offset = workout.get("day_offset")
            if day_offset not in valid_offsets: continue # Hallucination check

            w_type = workout.get("workout_type", "easy")
            distance = float(workout.get("distance_km", 5.0))
            title = workout.get("title", "Koşu")
            
            # Python Math
            pace_info = calculate_pace_and_duration(current_pace, w_type, distance)
            
            final_workouts.append({
                "day_offset": day_offset,
                "title": title,
                "workout_type": w_type,
                "distance_km": distance,
                "target_pace_seconds": pace_info["pace"],
                "duration_minutes": pace_info["duration"]
            })
        except: continue

    if not final_workouts:
        return "HATA: Antrenman listesi boş."

    # Backend Kayıt
    payload = {
        "title": title,
        "start_date": start_date,
        "duration_weeks": duration_weeks,
        "workouts_per_week": len(final_workouts) // duration_weeks,
        "description": description,
        "workouts": final_workouts
    }

    try:
        response = call_api("POST", "/programs/create_ai_plan/", config, data=payload)
        if "error" in response: return f"API HATASI: {response['error']}"
        
        return f"✅ Program Oluşturuldu! ID: {response.get('program_id')}\n🎯 {len(final_workouts)} antrenman planlandı."
    except Exception as e:
        return f"Backend Hatası: {str(e)}"
    


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