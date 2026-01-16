from typing import List, Optional, Literal
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field, field_validator, model_validator
import datetime
import json
from agent.utils.helper_functions import call_api, fetch_user_context_data


# ============================================================
# 🏗️ BACKEND TOOLS (GERÇEK İŞLEM YAPANLAR)
# ============================================================

# Agent manuel yenilemek isterse diye wrapper tool
@tool
def get_runner_context(config: RunnableConfig) -> dict:
    """Refreshes user data manually."""
    return fetch_user_context_data(config)

# --- Create Plan Input Models ---
class WorkoutItemInput(BaseModel):
    day_offset: int = Field(..., description="Başlangıçtan kaç gün sonra? (0=İlk gün)")
    title: str = Field(..., description="Antrenman başlığı")
    workout_type: Literal['tempo', 'easy', 'interval', 'long']
    distance_km: float = Field(..., description="Mesafe (km). Rest ise 0.")
    target_pace_seconds: int = Field(default=0, description="Hedef tempo (sn/km)")

    @field_validator('distance_km')
    def check_distance(cls, v):
        if v < 0: raise ValueError("Mesafe negatif olamaz.")
        return v

class CreatePlanInput(BaseModel):
    title: str = Field(..., description="Program Başlığı")
    start_date: str = Field(..., description="YYYY-MM-DD formatında başlangıç tarihi")
    duration_weeks: int = Field(..., description="Program süresi (hafta)")
    workouts_per_week: int = Field(default=3, description="Haftalık antrenman sayısı")
    description: Optional[str] = Field(default="", description="Program açıklaması")
    workouts: List[WorkoutItemInput]

    @field_validator('start_date')
    def validate_date_format(cls, v):
        try:
            datetime.datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError("Tarih formatı YANLIŞ. 'YYYY-MM-DD' olmalı.")

    @model_validator(mode='after')
    def check_schedule_logic(self):
        max_days = self.duration_weeks * 7
        for w in self.workouts:
            if w.day_offset >= max_days:
                raise ValueError(f"Hata: {w.day_offset}. gün, {self.duration_weeks} haftalık süreyi aşıyor.")
        if not self.workouts:
             raise ValueError("Hata: Program boş olamaz.")
        return self

@tool(args_schema=CreatePlanInput)
def create_workout_plan(
    title: str, start_date: str, duration_weeks: int, 
    workouts: List[WorkoutItemInput], workouts_per_week: int, 
    description: str, config: RunnableConfig
) -> str:
    """
    Creates a new workout program. 
    Duration is calculated automatically by Python (Distance * Pace).
    """
    workouts_data = []
    for w in workouts:
        w_dict = w.dict()
        dist = w_dict.get('distance_km', 0)
        pace = w_dict.get('target_pace_seconds', 0)
        
        if dist > 0 and pace > 0:
            total_seconds = dist * pace
            w_dict['duration_minutes'] = int(total_seconds / 60)
        else:
            w_dict['duration_minutes'] = 0
        workouts_data.append(w_dict)
    
    payload = {
        "title": title, "start_date": start_date, "duration_weeks": duration_weeks, 
        "workouts_per_week": workouts_per_week, "description": description, 
        "workouts": workouts_data
    }

    response = call_api("POST", "/programs/create_ai_plan/", config, data=payload)
    if "error" in response:
        return f"HATA (Backend): {response['error']}"

    return f"BAŞARILI: '{title}' programı oluşturuldu (ID: {response.get('program_id')}). Takvime işlendi."


# ============================================================
# 📱 DUMMY UI TOOLS (FRONTEND TETİKLEYİCİLER)
# ============================================================
@tool
def request_runner_profile():
    """
    Call this tool FIRST when starting a new plan flow.
    It triggers the 'Profile Confirmation Modal' on the Frontend.
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

