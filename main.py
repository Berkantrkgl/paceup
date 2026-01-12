import logging
import jwt 
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from sse_starlette.sse import EventSourceResponse # pip install sse-starlette
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uuid
import os
import uvicorn
import json

# --- PROJE İMPORTLARI ---
# Prompt şablonunu alıyoruz
from agent.utils.prompts import AGENT_SYSTEM_PROMPT_TEMPLATE
# Helper fonksiyonları alıyoruz
from agent.utils.helper_functions import check_thread_exists, fetch_user_context_data
from agent.agent import create_workflow

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- CONFIG ---
DJANGO_SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-xxxx")
ALGORITHM = "HS256"

security = HTTPBearer()

# --- Auth Dependency ---
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # verify_signature=False sadece debug içindir, prod'da True olmalı veya secret key ile decode edilmeli
        payload = jwt.decode(token, DJANGO_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token payload geçersiz: user_id eksik")
            
        return {
            "user_id": user_id,
            "token": token 
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi dolmuş.")
    except jwt.PyJWTError as e:
        logger.error(f"JWT Verification Error: {e}")
        raise HTTPException(status_code=401, detail="Geçersiz token.")

# --- Pydantic Models ---
class StreamChatInput(BaseModel):
    thread_id: str
    messages: List[dict]

# --- Application Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph, pool
    pool = None
    try:
        print("🚀 Başlatılıyor: Workflow ve DB Bağlantısı...")
        # create_workflow artık hata fırlatıyor, None dönmüyor
        result = await create_workflow()
        
        if result is None:
             raise RuntimeError("Workflow oluşturulamadı (None döndü). agent.py'yi kontrol et.")
             
        graph, pool = result
        print("✅ Workflow ve DB Bağlantısı Başarılı!")
        yield
    except Exception as e:
        print(f"💀 CRITICAL STARTUP ERROR: {e}")
        raise e
    finally:
        if pool:
            print("🛑 Kapatılıyor: DB Bağlantı Havuzu...")
            await pool.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---
@app.post("/chat-stream")
async def stream_chat(
    request: Request,
    chat_input: StreamChatInput,
    user_data: dict = Depends(verify_token)
):
    global graph, pool
    thread_id = chat_input.thread_id
    input_data = chat_input.messages
    
    access_token = user_data["token"]
    user_id = user_data["user_id"]
    
    # LangGraph Config (Helper fonksiyonlar token'ı buradan alacak)
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_token": access_token,
            "user_id": user_id
        }
    }
    
    async def event_generator():
        try:
            # 1. Thread Kontrolü
            # (Pool lifespan'den geldiği için global kullanıyoruz)
            if not pool:
                yield {"event": "error", "data": json.dumps({"content": "DB Bağlantısı yok"})}
                return

            # check_thread_exists fonksiyonu helper_functions.py'den geliyor
            # thread_exists = await check_thread_exists(pool, thread_id) 
            # Not: Context Injection kullandığımız için 'thread_exists' kontrolü kritik değil,
            # LangGraph zaten thread yoksa oluşturur.
            
            # 2. Mesaj Tipi Analizi
            last_msg_data = input_data[-1]
            role = last_msg_data.get("role", "user")
            
            inputs = None

            # ====================================================
            # SENARYO A: TOOL RESPONSE (FRONTEND MODAL CEVABI)
            # ====================================================
            if role == "tool":
                logger.info(f"🛠️ Tool Response -> Thread: {thread_id}")
                
                # Frontend'den gelen cevabı ToolMessage objesine çevir
                tool_msg = ToolMessage(
                    content=last_msg_data["content"],          # JSON string
                    tool_call_id=last_msg_data["tool_call_id"] # ID Eşleşmesi Şart!
                )
                
                # Hafızayı güncelle (Sanki tool çalışmış gibi)
                # as_node="tools" diyerek ToolNode'un çıktısıymış gibi davranıyoruz
                await graph.aupdate_state(config, {"messages": [tool_msg]}, as_node="tools")
                
                # Resume moduna geç (Input yok, sadece kaldığı yerden devam et)
                inputs = None 

            # ====================================================
            # SENARYO B: NORMAL USER MESAJI (CONTEXT INJECTION)
            # ====================================================
            else:
                logger.info(f"👤 User Message -> Thread: {thread_id}")
                
                # 1. Context Injection (Kullanıcı Verisini Çek)
                # fetch_user_context_data, config içindeki token'ı kullanarak API'ye gider.
                user_context = fetch_user_context_data(config)
                
                # 2. System Prompt'u Hazırla
                filled_system_prompt = f"""{AGENT_SYSTEM_PROMPT_TEMPLATE}
                
                ### GÜNCEL KULLANICI VERİSİ ###
                {json.dumps(user_context, indent=2, ensure_ascii=False)}
                ##############################
                """
                
                # 3. Mesaj İçeriğini Al
                content_text = ""
                content_obj = last_msg_data.get("content", "")
                if isinstance(content_obj, list):
                    content_text = content_obj[0].get("text", "") if content_obj else ""
                else:
                    content_text = str(content_obj)
                
                # 4. Input Listesi (Taze System Prompt + Yeni Mesaj)
                inputs = {
                    "messages": [
                        SystemMessage(content=filled_system_prompt),
                        HumanMessage(content=content_text, id=str(uuid.uuid4()))
                    ]
                }

            # ====================================================
            # 3. STREAMING LOOP
            # ====================================================
            async for chunk in graph.astream_events(
                inputs,
                config=config,
                version="v1" # astream_events v1 API
            ):
                # Client koptu mu?
                if await request.is_disconnected():
                    logger.warning("Client disconnected.")
                    break

                kind = chunk["event"]
                
                # --- A. METİN AKIŞI (TOKEN) ---
                if kind == "on_chat_model_stream":
                    content = chunk["data"]["chunk"].content
                    if content:
                        yield {
                            "event": "token", 
                            "data": json.dumps({"content": content}, ensure_ascii=False)
                        }

                # --- B. TOOL CALL TESPİTİ (MODAL SİNYALİ) ---
                elif kind == "on_chat_model_end":
                    output = chunk["data"]["output"]
                    if hasattr(output, "tool_calls") and output.tool_calls:
                        for tc in output.tool_calls:
                            logger.info(f"Tool Call Triggered: {tc['name']}")
                            
                            # Frontend'e "Modal Aç" sinyali
                            yield {
                                "event": "tool_call",
                                "data": json.dumps({
                                    "tool_name": tc["name"],
                                    "tool_id": tc["id"],
                                    "args": tc.get("args", {})
                                }, ensure_ascii=False)
                            }

            # Bitiş Sinyali
            yield {"event": "status", "data": json.dumps({"status": "finished"})}

        except Exception as e:
            logger.error(f"Stream Error: {e}", exc_info=True)
            yield {"event": "error", "data": json.dumps({"content": str(e)})}

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    uvicorn.run(app, port=8001, host="0.0.0.0")