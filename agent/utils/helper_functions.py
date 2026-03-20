from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv
import boto3
import json
import os
import time
import requests
import datetime
from typing import List, Optional, Literal, Dict, Any
from langchain_core.runnables import RunnableConfig # <-- KRİTİK IMPORT
import jwt  # pip install PyJWT
import logging

logger = logging.getLogger(__name__)

load_dotenv(".env", override=True)

def get_checkpointer() -> AsyncPostgresSaver:
    """AsyncPostgresSaver instance döndürür."""
    DB_URI = os.getenv("DB_URI")
    if not DB_URI:
        raise ValueError("DB_URI environment variable is not set")
    return AsyncPostgresSaver.from_conn_string(DB_URI)

async def check_thread_exists(checkpointer: AsyncPostgresSaver, thread_id: str) -> bool:
    """
    Checkpointer üzerinden thread'in var olup olmadığını kontrol eder.
    """
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = await checkpointer.aget_tuple(config)
        exists = state is not None
        
        if exists:
            logger.info(f"✅ Thread mevcut: {thread_id}")
        else:
            logger.info(f"🆕 Yeni thread: {thread_id}")
            
        return exists
    except Exception as e:
        logger.error(f"❌ Thread kontrol hatası: {e}")
        return False
        
        
# Backend URL Yapılandırması
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api")
TOKEN_REFRESH_URL = f"{BACKEND_URL}/token/refresh/"

# --- YARDIMCI FONKSİYONLAR ---
def check_token_expiration(token: str, buffer_seconds: int = 60) -> bool:
    """
    Token'ın süresinin dolup dolmadığını kontrol eder.
    """
    try:
        if not token: 
            return True
        decoded = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = decoded.get('exp')
        
        if not exp_timestamp:
            return True
            
        current_timestamp = time.time()
        if current_timestamp + buffer_seconds > exp_timestamp:
            return True
        return False
    except Exception:
        return True

def refresh_access_token_logic(refresh_token: str) -> str:
    """
    Refresh token kullanarak backend'den yeni bir access token alır.
    """
    if not refresh_token:
        raise ValueError("Refresh Token eksik, oturum yenilenemiyor.")

    try:
        response = requests.post(TOKEN_REFRESH_URL, json={"refresh": refresh_token}, timeout=10)
        
        if response.status_code == 200:
            new_data = response.json()
            return new_data.get("access")
        else:
            raise Exception(f"Token yenileme başarısız ({response.status_code}): {response.text}")
            
    except Exception as e:
        raise Exception(f"Token yenileme servisine ulaşılamadı: {str(e)}")

# --- ANA API ISTEMCISI ---

def call_api(
    method: str, 
    endpoint: str, 
    config: RunnableConfig,  # <-- TİP DÜZELTİLDİ
    data: Optional[Dict] = None, 
    params: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Akıllı API İstemcisi. Token yenileme ve istek atma işlemlerini yönetir.
    """
    
    # 1. Config'den Tokenları Al
    configuration = config.get("configurable", {})
    access_token = configuration.get("user_token")
    refresh_token = configuration.get("refresh_token")
    
    if not access_token and not refresh_token:
         return {"error": "Authentication Error: Token bulunamadı."}

    # URL Hazırla
    url = f"{BACKEND_URL}{endpoint}"

    # --- ADIM 2: PROAKTİF KONTROL ---
    if check_token_expiration(access_token):
        if refresh_token:
            try:
                print(f"🔄 Token süresi dolmak üzere, yenileniyor... ({endpoint})")
                access_token = refresh_access_token_logic(refresh_token)
            except Exception as e:
                return {"error": f"Oturum yenilenemedi: {str(e)}"}
        else:
             return {"error": "Access token süresi dolmuş ve Refresh token yok."}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    try:
        # --- ADIM 3: İLK İSTEK ---
        response = requests.request(method, url, headers=headers, json=data, params=params, timeout=10)
        
        # --- ADIM 4: REAKTİF KONTROL (401 Gelirse) ---
        if response.status_code == 401 and refresh_token:
            print(f"⚠️ 401 Alındı, token yenilenip tekrar deneniyor...")
            
            try:
                new_access_token = refresh_access_token_logic(refresh_token)
            except Exception:
                return {"error": "Oturum süresi doldu."}
            
            headers["Authorization"] = f"Bearer {new_access_token}"
            response = requests.request(method, url, headers=headers, json=data, params=params, timeout=10)

        if not response.ok:
            try:
                return {"error": f"API Hatası: {response.json()}"}
            except:
                return {"error": f"API Hatası ({response.status_code}): {response.text}"}

        return response.json()

    except requests.exceptions.RequestException as e:
        return {"error": f"Bağlantı Hatası: {str(e)}"}



# ============================================================
# 🧠 HELPER FUNCTION (PYTHON TARAFINDAN ÇAĞRILIR)
# ============================================================
def fetch_user_context_data(config: RunnableConfig) -> dict:
    """
    Bu fonksiyon Tool değildir. Main Loop içinde system prompt'u 
    doldurmak için çağrılır. Chatbot'a o anki kullanıcının "durumunu" fısıldar.
    """
    user_data = call_api("GET", "/users/me/", config)
    # Hata durumunda boş context dön ki sistem patlamasın
    if "error" in user_data: 
        return {"error": "Could not fetch user data", "details": user_data}

    stats_data = call_api("GET", "/stats/summary/", config)
    program_data = call_api("GET", "/stats/program/", config)

    now = datetime.datetime.now()
    
    # Kalan erteleme hakkını güvenli şekilde çek
    # (Backend UserSerializer'dan get_remaining_reschedules() methodunu 'remaining_reschedules' olarak döndürdüğünü varsayıyoruz)
    remaining_reschedules = user_data.get("remaining_reschedules", 0)
    is_premium = user_data.get("is_premium", False)

    context = {
        "meta": {
            "current_date": now.strftime("%Y-%m-%d"),
            "tomorrow_date": (now + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "current_day": now.strftime("%A"),
        },
        "user_profile": {
            "name": user_data.get("first_name") or user_data.get("email"),
            "weight": user_data.get("weight"),
            "current_pace_seconds": user_data.get("current_pace", 480), # Default 480 eklendi
            "is_premium": is_premium,
            "remaining_reschedules": remaining_reschedules
        },
        "stats": {
            "total_distance_km": stats_data.get("total_distance"),
            "weekly_progress": f"{stats_data.get('weekly_progress', 0)}/{stats_data.get('weekly_goal', 0)}",
            "current_streak": stats_data.get("current_streak")
        },
        "active_program": None
    }

    if program_data.get("has_active_program"):
        prog_info = {
            "title": program_data.get('title'),
            "progress": f"Hafta {program_data.get('current_week')}/{program_data.get('total_weeks')}",
            "status": "Active"
        }
        if program_data.get("next_workout"):
            nw = program_data["next_workout"]
            prog_info["next_workout"] = {
                "day": nw.get('day_name'),
                "date": nw.get('date'),
                "type": nw.get('type'),
                "title": nw.get('title')
            }
        context["active_program"] = prog_info

    return context


def fetch_user_info_for_program_creation(config: RunnableConfig) -> dict:
    """
    ÖZEL FONKSİYON: Program oluşturulurken LLM'e zengin kullanıcı profili sunar.
    Backend'deki UserSerializer ve StatsSummaryView verilerini birleştirir.
    """
    logger.info("🔍 DATA FETCH: Program oluşturma için kullanıcı verisi çekiliyor...")
    
    # 1. USER PROFILE (/users/me/)
    user_res = call_api("GET", "/users/me/", config)
    
    if "error" in user_res:
        logger.error(f"❌ API ERROR (/users/me/): {user_res}")
        return {"error": "User data fetch failed"}

    # 2. STATS SUMMARY (/stats/summary/)
    stats_res = call_api("GET", "/stats/summary/", config)
    
    # Veriyi Güvenli Çekme (Experience Level kaldırıldı, model adları eşitlendi)
    profile = {
        "name": user_res.get("first_name") or user_res.get("email", "Runner"),
        "weight": user_res.get("weight", "Unknown"),
        "height": user_res.get("height", "Unknown"),
        "gender": user_res.get("gender", "Unknown"), # male/female
        "current_pace": user_res.get("current_pace", 480), # 480 Fallback
        "max_distance": user_res.get("max_runned_distance", 0.0), # DİKKAT: DB'deki adı max_runned_distance
    }

    # İstatistikler
    history = {
        "total_workouts": stats_res.get("total_workouts", 0),
        "total_distance": stats_res.get("total_distance", 0.0),
        "current_streak": stats_res.get("current_streak", 0)
    }

    final_context = {
        "user_profile": profile,
        "history": history
    }
    
    logger.info(f"✅ USER DATA READY: Gender={profile['gender']}, Height={profile['height']}, MaxDist={profile['max_distance']}")
    return final_context



def has_tools(message):
    if message.tool_calls and len(message.tool_calls) > 0:
        return True
    return False


def format_tool_response(tool_name: str, content_raw) -> str:
    """
    UI tool response'unu LLM için okunabilir context'e çevirir.
    Ham JSON yerine anlamlı metin döner.
    """
    try:
        data = json.loads(content_raw) if isinstance(content_raw, str) else content_raw
    except (json.JSONDecodeError, TypeError):
        return str(content_raw)

    if not isinstance(data, dict):
        return str(data)

    name = (tool_name or "").lower().strip()

    if name == "request_runner_profile":
        status = data.get("status", "confirmed")
        parts = [f"Kullanıcı profil bilgilerini {'onayladı' if status == 'confirmed' else 'güncelledi'}:"]
        if data.get("weight"): parts.append(f"- Kilo: {data['weight']} kg")
        if data.get("height"): parts.append(f"- Boy: {data['height']} cm")
        if data.get("gender"): parts.append(f"- Cinsiyet: {data['gender']}")
        if data.get("pace"): parts.append(f"- Pace: {data['pace']} dk/km")
        if data.get("is_beginner"): parts.append("- Seviye: Yeni başlayan")
        return "\n".join(parts)

    elif name == "request_program_setup":
        parts = ["Kullanıcı program bilgilerini belirledi:"]
        if data.get("goal"): parts.append(f"- Hedef: {data['goal']}")
        if data.get("mode"): parts.append(f"- Mod: {data['mode']}")
        if data.get("value"): parts.append(f"- Süre: {data['value']} hafta")
        if data.get("start_date"): parts.append(f"- Başlangıç: {data['start_date']}")
        return "\n".join(parts)

    elif name == "request_availability_preferences":
        parts = ["Kullanıcı müsaitlik bilgilerini belirledi:"]
        if data.get("days"): parts.append(f"- Koşu günleri: {', '.join(data['days'])}")
        if data.get("long_run"): parts.append(f"- Uzun koşu günü: {data['long_run']}")
        return "\n".join(parts)

    elif name == "request_plan_confirmation":
        confirmed = data.get("confirmed")
        if confirmed:
            return "Kullanıcı programın oluşturulmasını ONAYLADI."
        else:
            feedback = data.get("feedback", "")
            if feedback:
                return f"Kullanıcı programı onaylamadı. Geri bildirim: {feedback}"
            return "Kullanıcı programın oluşturulmasını REDDETTİ."

    return json.dumps(data, ensure_ascii=False)
