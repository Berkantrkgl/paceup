from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
import requests
import json
import datetime

# Django Backend Adresi
API_BASE_URL = "http://localhost:8000/api"

def get_headers(config: RunnableConfig):
    """
    LangGraph config içinden 'user_token'ı çeker.
    """
    configuration = config.get("configurable", {})
    token = configuration.get("user_token")
    
    if not token:
        raise ValueError("Authentication token is missing in configuration.")
        
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

# --- TARİH HESAPLAMA YARDIMCISI ---
def calculate_date_from_week_day(start_date: datetime.date, week_num: int, day_name: str) -> datetime.date:
    """
    Belirtilen başlangıç tarihine göre, '1. Hafta Cuma' gibi ifadeleri gerçek tarihe çevirir.
    Mantık: Plan her zaman 'start_date'in bulunduğu haftanın Pazartesi günü başlar gibi hesaplanır
    ancak geçmiş tarihler backend'de 'Missed' olarak işaretlenir.
    """
    # 1. Gün isimlerini indekse çevir
    days_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, 
        "friday": 4, "saturday": 5, "sunday": 6
    }
    
    target_day_idx = days_map.get(day_name.lower())
    if target_day_idx is None:
        return start_date # Fallback: Bugün
    
    # 2. Bu haftanın Pazartesi gününü bul
    # (start_date.weekday(): Pzt=0 ... Paz=6)
    monday_of_start_week = start_date - datetime.timedelta(days=start_date.weekday())
    
    # 3. Hedef haftanın Pazartesisini bul (week_num 1'den başlar varsayıyoruz)
    # week_num=1 -> 0 hafta ekle, week_num=2 -> 1 hafta ekle
    target_week_monday = monday_of_start_week + datetime.timedelta(weeks=(week_num - 1))
    
    # 4. O haftadaki hedef günü bul
    target_date = target_week_monday + datetime.timedelta(days=target_day_idx)
    
    return target_date

# --- TOOLS ---

@tool
def get_user_profile(config: RunnableConfig) -> str:
    """
    Fetches the user's profile. 
    CRITICAL: Also provides the CURRENT DATE and DAY NAME to help you schedule workouts.
    """
    try:
        headers = get_headers(config)
        response = requests.get(f"{API_BASE_URL}/users/me/", headers=headers)
        
        # Bugünün tarihi ve günü (LLM'in takvim bilinci olması için)
        today = datetime.date.today()
        day_name = today.strftime("%A") # "Monday", "Tuesday" etc.
        
        if response.status_code == 200:
            data = response.json()
            summary = {
                "current_date": str(today), # ÖNEMLİ: LLM'e bugünü söylüyoruz
                "current_day_name": day_name, # ÖNEMLİ: Bugünün ismini söylüyoruz
                "name": f"{data.get('first_name', '')} {data.get('last_name', '')}",
                "experience": data.get('experience_level'),
                "current_pace": data.get('pace_display'),
                "weekly_goal": data.get('weekly_goal')
            }
            return json.dumps(summary, ensure_ascii=False)
        else:
            return f"Error: {response.status_code}"
    except Exception as e:
        return f"Connection error: {str(e)}"

@tool
def get_workout_stats(config: RunnableConfig) -> str:
    """
    Retrieves the user's aggregate running statistics.
    """
    try:
        headers = get_headers(config)
        response = requests.get(f"{API_BASE_URL}/stats/summary/", headers=headers)
        if response.status_code == 200:
            return json.dumps(response.json(), ensure_ascii=False)
        else:
            return f"Error: {response.status_code}"
    except Exception as e:
        return f"Connection error: {str(e)}"

@tool
def create_comprehensive_plan(
    title: str,
    goal: str,
    duration_weeks: int,
    difficulty: str,
    description: str,
    workouts: list[dict],
    config: RunnableConfig
) -> str:
    """
    Creates a FULL running program.
    
    'workouts' list items can define the date in TWO ways:
    
    OPTION 1 (Preferred for specific days):
    {
      "week": 1,              # Which week of the plan (1, 2, 3...)
      "day_name": "Friday",   # "Monday", "Wednesday", etc.
      "title": "Tempo Run",
      "workout_type": "tempo",
      "planned_distance": 5.0,
      "planned_duration": 30
    }
    
    OPTION 2 (Manual offset):
    {
      "day_offset": 0,        # 0 = Start Date, 1 = Tomorrow...
      "title": "Easy Run",
      ...
    }
    """
    try:
        headers = get_headers(config)
        start_date = datetime.date.today()
        end_date = start_date + datetime.timedelta(weeks=duration_weeks)
        
        # 1. Programı Oluştur
        program_payload = {
            "title": title,
            "goal": goal,
            "description": description,
            "duration_weeks": duration_weeks,
            "difficulty": difficulty,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "status": "active",
            "workouts_per_week": 3,
            "ai_generated": True
        }
        
        prog_response = requests.post(f"{API_BASE_URL}/programs/", json=program_payload, headers=headers)
        
        if prog_response.status_code != 201:
            return f"Error creating program: {prog_response.text}"
            
        program_id = prog_response.json().get("id")
        created_count = 0
        errors = []
        
        # 2. Antrenmanları Oluştur
        for w in workouts:
            try:
                # --- TARİH BELİRLEME MANTIĞI ---
                scheduled_date = None
                
                # A) LLM "Hafta 1, Cuma" dediyse:
                if "week" in w and "day_name" in w:
                    scheduled_date = calculate_date_from_week_day(
                        start_date, 
                        int(w["week"]), 
                        str(w["day_name"])
                    )
                
                # B) LLM "Bugünden 2 gün sonra" (Offset) dediyse:
                elif "day_offset" in w:
                    scheduled_date = start_date + datetime.timedelta(days=int(w["day_offset"]))
                
                # C) Fallback (Bugün)
                else:
                    scheduled_date = start_date

                # Payload hazırla
                workout_payload = {
                    "program": program_id,
                    "title": w.get("title", "Run"),
                    "workout_type": w.get("workout_type", "easy"),
                    "scheduled_date": str(scheduled_date),
                    "planned_distance": w.get("planned_distance", 0.0),
                    "planned_duration": w.get("planned_duration", 0),
                    "target_pace_seconds": w.get("target_pace_seconds", 0),
                    "status": "scheduled"
                }
                
                # İsteği Gönder
                w_res = requests.post(f"{API_BASE_URL}/workouts/", json=workout_payload, headers=headers)
                
                if w_res.status_code == 201:
                    created_count += 1
                else:
                    errors.append(f"Workout failed: {w_res.text}")
                    
            except Exception as e:
                errors.append(f"Error processing workout: {str(e)}")

        return json.dumps({
            "status": "success",
            "program_id": program_id,
            "message": f"Program created with {created_count} workouts.",
            "errors": errors if errors else None
        }, ensure_ascii=False)

    except Exception as e:
        return f"Connection error: {str(e)}"