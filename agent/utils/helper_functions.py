import datetime
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

logger = logging.getLogger(__name__)

# In prod (ECS) env vars are injected by the task definition — no .env file.
# In dev the developer has a local .env. override=False ensures real env vars
# always win over file contents, which matters on ECS if a stray .env gets baked
# into the image.
load_dotenv(".env", override=False)


def get_checkpointer() -> AsyncPostgresSaver:
    db_uri = os.getenv("DB_URI") or os.getenv("DATABASE_URL")
    if not db_uri:
        raise RuntimeError(
            "DB_URI or DATABASE_URL environment variable is required"
        )
    return AsyncPostgresSaver.from_conn_string(db_uri)


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api").rstrip("/")
TOKEN_REFRESH_URL = f"{BACKEND_URL}/token/refresh/"
HTTP_TIMEOUT = float(os.getenv("BACKEND_HTTP_TIMEOUT", "30"))

_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            limits=httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20,
            ),
        )
    return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


async def check_thread_exists(
    checkpointer: AsyncPostgresSaver, thread_id: str
) -> bool:
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = await checkpointer.aget_tuple(config)
        return state is not None
    except Exception as e:
        logger.error("Thread check failed: %s", e)
        return False


def check_token_expiration(token: str, buffer_seconds: int = 60) -> bool:
    try:
        if not token:
            return True
        decoded = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = decoded.get("exp")
        if not exp_timestamp:
            return True
        return time.time() + buffer_seconds > exp_timestamp
    except Exception:
        return True


async def refresh_access_token(refresh_token: str) -> str:
    if not refresh_token:
        raise ValueError("Refresh token missing")

    client = get_http_client()
    try:
        response = await client.post(
            TOKEN_REFRESH_URL,
            json={"refresh": refresh_token},
        )
    except httpx.HTTPError as e:
        raise RuntimeError(f"Token refresh transport error: {e}") from e

    if response.status_code != 200:
        raise RuntimeError(
            f"Token refresh failed ({response.status_code}): {response.text}"
        )

    return response.json().get("access")


async def call_api(
    method: str,
    endpoint: str,
    config: RunnableConfig,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None,
) -> Dict[str, Any]:
    configuration = config.get("configurable", {})
    access_token = configuration.get("user_token")
    refresh_token = configuration.get("refresh_token")

    if not access_token and not refresh_token:
        return {"error": "Authentication Error: no token"}

    url = f"{BACKEND_URL}{endpoint}"

    if check_token_expiration(access_token):
        if refresh_token:
            try:
                logger.info("Proactively refreshing token for %s", endpoint)
                access_token = await refresh_access_token(refresh_token)
            except Exception as e:
                return {"error": f"Session refresh failed: {e}"}
        else:
            return {"error": "Access token expired and no refresh token"}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    client = get_http_client()

    try:
        response = await client.request(
            method, url, headers=headers, json=data, params=params
        )

        if response.status_code == 401 and refresh_token:
            logger.warning("401 from %s, refreshing and retrying", endpoint)
            try:
                new_access_token = await refresh_access_token(refresh_token)
            except Exception:
                return {"error": "Session expired"}
            headers["Authorization"] = f"Bearer {new_access_token}"
            response = await client.request(
                method, url, headers=headers, json=data, params=params
            )

        if not response.is_success:
            try:
                return {"error": f"API error: {response.json()}"}
            except Exception:
                return {
                    "error": f"API error ({response.status_code}): {response.text}"
                }

        return response.json()

    except httpx.HTTPError as e:
        logger.error("HTTP error calling %s: %s", endpoint, e)
        return {"error": f"Connection error: {e}"}


async def fetch_user_context_data(config: RunnableConfig) -> dict:
    user_data = await call_api("GET", "/users/me/", config)
    if "error" in user_data:
        return {"error": "Could not fetch user data", "details": user_data}

    stats_data = await call_api("GET", "/stats/summary/", config)
    program_data = await call_api("GET", "/stats/program/", config)

    now = datetime.datetime.now()
    remaining_reschedules = user_data.get("remaining_reschedules", 0)
    is_premium = user_data.get("is_premium", False)

    context = {
        "meta": {
            "current_date": now.strftime("%Y-%m-%d"),
            "tomorrow_date": (now + datetime.timedelta(days=1)).strftime(
                "%Y-%m-%d"
            ),
            "current_day": now.strftime("%A"),
        },
        "user_profile": {
            "name": user_data.get("first_name") or user_data.get("email"),
            "weight": user_data.get("weight"),
            "current_pace_seconds": user_data.get("current_pace", 480),
            "is_premium": is_premium,
            "remaining_reschedules": remaining_reschedules,
        },
        "stats": {
            "total_distance_km": stats_data.get("total_distance"),
            "weekly_progress": f"{stats_data.get('weekly_progress', 0)}/{stats_data.get('weekly_goal', 0)}",
            "current_streak": stats_data.get("current_streak"),
        },
        "active_program": None,
    }

    if program_data.get("has_active_program"):
        prog_info = {
            "title": program_data.get("title"),
            "progress": f"Hafta {program_data.get('current_week')}/{program_data.get('total_weeks')}",
            "status": "Active",
        }
        if program_data.get("next_workout"):
            nw = program_data["next_workout"]
            prog_info["next_workout"] = {
                "day": nw.get("day_name"),
                "date": nw.get("date"),
                "type": nw.get("type"),
                "title": nw.get("title"),
            }
        context["active_program"] = prog_info

    return context


async def fetch_user_info_for_program_creation(config: RunnableConfig) -> dict:
    logger.info("Fetching user data for program creation")

    user_res = await call_api("GET", "/users/me/", config)
    if "error" in user_res:
        logger.error("User fetch failed: %s", user_res)
        return {"error": "User data fetch failed"}

    stats_res = await call_api("GET", "/stats/summary/", config)

    profile = {
        "name": user_res.get("first_name") or user_res.get("email", "Runner"),
        "weight": user_res.get("weight", "Unknown"),
        "height": user_res.get("height", "Unknown"),
        "gender": user_res.get("gender", "Unknown"),
        "current_pace": user_res.get("current_pace", 480),
        "max_distance": user_res.get("max_runned_distance", 0.0),
    }

    history = {
        "total_workouts": stats_res.get("total_workouts", 0),
        "total_distance": stats_res.get("total_distance", 0.0),
        "current_streak": stats_res.get("current_streak", 0),
    }

    logger.info(
        "User data ready gender=%s height=%s max_distance=%s",
        profile["gender"],
        profile["height"],
        profile["max_distance"],
    )
    return {"user_profile": profile, "history": history}


def has_tools(message) -> bool:
    return bool(getattr(message, "tool_calls", None))


def format_tool_response(tool_name: str, content_raw) -> str:
    try:
        data = (
            json.loads(content_raw) if isinstance(content_raw, str) else content_raw
        )
    except (json.JSONDecodeError, TypeError):
        return str(content_raw)

    if not isinstance(data, dict):
        return str(data)

    name = (tool_name or "").lower().strip()

    if name == "request_runner_profile":
        status = data.get("status", "confirmed")
        parts = [
            f"Kullanıcı profil bilgilerini "
            f"{'onayladı' if status == 'confirmed' else 'güncelledi'}:"
        ]
        if data.get("weight"):
            parts.append(f"- Kilo: {data['weight']} kg")
        if data.get("height"):
            parts.append(f"- Boy: {data['height']} cm")
        if data.get("gender"):
            parts.append(f"- Cinsiyet: {data['gender']}")
        if data.get("pace"):
            parts.append(f"- Pace: {data['pace']} dk/km")
        if data.get("is_beginner"):
            parts.append("- Seviye: Yeni başlayan")
        return "\n".join(parts)

    if name == "request_program_setup":
        parts = ["Kullanıcı program bilgilerini belirledi:"]
        if data.get("goal"):
            parts.append(f"- Hedef: {data['goal']}")
        if data.get("mode"):
            parts.append(f"- Mod: {data['mode']}")
        if data.get("value"):
            parts.append(f"- Süre: {data['value']} hafta")
        if data.get("start_date"):
            parts.append(f"- Başlangıç: {data['start_date']}")
        return "\n".join(parts)

    if name == "request_availability_preferences":
        parts = ["Kullanıcı müsaitlik bilgilerini belirledi:"]
        if data.get("days"):
            parts.append(f"- Koşu günleri: {', '.join(data['days'])}")
        if data.get("long_run"):
            parts.append(f"- Uzun koşu günü: {data['long_run']}")
        return "\n".join(parts)

    if name == "request_plan_confirmation":
        confirmed = data.get("confirmed")
        if confirmed:
            return "Kullanıcı programın oluşturulmasını ONAYLADI."
        feedback = data.get("feedback", "")
        if feedback:
            return f"Kullanıcı programı onaylamadı. Geri bildirim: {feedback}"
        return "Kullanıcı programın oluşturulmasını REDDETTİ."

    return json.dumps(data, ensure_ascii=False)
