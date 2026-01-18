from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from dotenv import load_dotenv
import boto3
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

async def setup_postgres_connection():
    DB_URI = os.getenv("DB_URI")
    if not DB_URI:
        raise ValueError("DB_URI environment variable is not set")

    try:
        # Create the pool with more explicit error handling
        pool = AsyncConnectionPool(
            conninfo=DB_URI,
            max_size=20,
            kwargs={"autocommit": True, "prepare_threshold": 0},
            open=False,
        )

        # Open the pool with error handling
        try:
            await pool.open()
        except Exception as e:
            print(f"❌ DB Bağlantı Hatası: {e}")
            raise e  # <--- BU SATIR ÇOK ÖNEMLİ! Hatayı yukarı fırlatmalı.

        # Create the saver
        memory = AsyncPostgresSaver(pool)

        # Setup with error handling
        try:
            await memory.setup()
        except Exception as e:
            if "already exists" in str(e):
                # If tables exist, we can continue
                pass
            else:
                raise Exception(f"Failed to setup PostgreSQL tables: {str(e)}")

        return memory, pool

    except Exception as e:
        raise Exception(f"Database initialization failed: {str(e)}")

async def check_thread_exists(pool, thread_id: str) -> bool:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT EXISTS(
                    SELECT 1 
                    FROM checkpoints 
                    WHERE thread_id = %s
                    LIMIT 1
                )
                """,
                (thread_id,),
            )
            result = await cur.fetchone()
            return result[0] if result else False
        
        
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
    doldurmak için çağrılır.
    """
    user_data = call_api("GET", "/users/me/", config)
    # Hata durumunda boş context dön ki sistem patlamasın
    if "error" in user_data: 
        return {"error": "Could not fetch user data", "details": user_data}

    stats_data = call_api("GET", "/stats/summary/", config)
    program_data = call_api("GET", "/stats/program/", config)

    now = datetime.datetime.now()
    
    context = {
        "meta": {
            "current_date": now.strftime("%Y-%m-%d"),
            "tomorrow_date": (now + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "current_day": now.strftime("%A"),
        },
        "user_profile": {
            "name": user_data.get("first_name") or user_data.get("email"),
            "weight": user_data.get("weight"),
            "experience": user_data.get("experience_level"),
            "current_pace_seconds": user_data.get("current_pace"),
        },
        "stats": {
            "total_distance_km": stats_data.get("total_distance"),
            "weekly_progress": f"{stats_data.get('weekly_progress')}/{stats_data.get('weekly_goal')}",
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
    # Backend Serializer: height, weight, gender, current_max_distance, total_workouts vb. döner.
    user_res = call_api("GET", "/users/me/", config)
    
    if "error" in user_res:
        logger.error(f"❌ API ERROR (/users/me/): {user_res}")
        return {"error": "User data fetch failed"}

    # 2. STATS SUMMARY (/stats/summary/)
    # Hesaplanan güncel toplamları (total_distance, weekly_progress) buradan alırız.
    stats_res = call_api("GET", "/stats/summary/", config)
    
    # Veriyi Güvenli Çekme (None gelirse varsayılan değer ata)
    profile = {
        "name": user_res.get("first_name") or user_res.get("email", "Runner"),
        "weight": user_res.get("weight", "Unknown"),
        "height": user_res.get("height", "Unknown"),
        "gender": user_res.get("gender", "Unknown"), # male/female
        "experience_level": user_res.get("experience_level", "beginner"),
        "current_pace": user_res.get("current_pace", 360), # saniye/km
        "max_distance": user_res.get("current_max_distance", 0.0), # km
    }

    # İstatistikler (Stats endpointi daha güncel hesaplama yapar)
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