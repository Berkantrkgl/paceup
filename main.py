import logging
import jwt 
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import SystemMessage, HumanMessage
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uuid
import os
import uvicorn
import json

# Agent importları
from agent.utils.prompts import AGENT_SYSTEM_PROMPT
from agent.utils.helper_functions import check_thread_exists
from agent.agent import create_workflow

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- CONFIG ---
DJANGO_SECRET_KEY = 'django-insecure-%qmwkt-awo0q+r=p(cza0)&5y!_+5+8(+6@ju22k@)gn!c+yqq'
ALGORITHM = "HS256"

security = HTTPBearer()

# --- Auth Dependency ---
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, DJANGO_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token payload geçersiz: user_id eksik")
            
        return {
            "user_id": user_id,
            "token": token 
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi dolmuş. Lütfen tekrar giriş yapın.")
    except jwt.PyJWTError as e:
        logger.error(f"JWT Verification Error: {e}")
        raise HTTPException(status_code=401, detail="Geçersiz kimlik doğrulama tokenı.")

# --- Pydantic Models ---
class StreamChatInput(BaseModel):
    thread_id: str
    messages: List[dict]

# --- Application Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph, pool
    try:
        graph, pool = await create_workflow()
        yield
    finally:
        if pool:
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
    chat_input: StreamChatInput,
    user_data: dict = Depends(verify_token)
):
    global graph, pool
    thread_id = chat_input.thread_id
    input_data = chat_input.messages
    
    access_token = user_data["token"]
    user_id = user_data["user_id"]

    logger.info(f"Chat request from User ID: {user_id} - Thread ID: {thread_id}")

    # LangGraph Config
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_token": access_token,
            "user_id": user_id
        }
    }
    
    async def generate_stream():
        try:
            # 1. Thread Kontrolü (PostgreSQL)
            thread_exists = await check_thread_exists(pool, thread_id)
            
            # Gelen son kullanıcı mesajını hazırla
            last_user_content = ""
            if input_data and "content" in input_data[-1]:
                    content_obj = input_data[-1]["content"]
                    if isinstance(content_obj, list) and len(content_obj) > 0:
                        last_user_content = content_obj[0].get("text", "")
                    elif isinstance(content_obj, str):
                        last_user_content = content_obj

            current_human_message = HumanMessage(content=last_user_content, id=str(uuid.uuid4()))

            # --- DÜZELTME BURADA ---
            input_messages = []

            if not thread_exists:
                # EĞER YENİ THREAD İSE: System Prompt + İlk Mesaj
                logger.info(f"Yeni Thread Başlatılıyor: {thread_id}")
                input_messages = [
                    SystemMessage(content=AGENT_SYSTEM_PROMPT),
                    current_human_message
                ]
            else:
                # EĞER ESKİ THREAD İSE: Sadece Yeni Mesaj
                # LangGraph, config'deki thread_id sayesinde geçmişi veritabanından kendi çeker.
                # Bizim 'aget_state' yapıp geçmişi elle vermemize GEREK YOKTUR.
                logger.info(f"Mevcut Thread Devam Ediyor: {thread_id}")
                input_messages = [
                    current_human_message
                ]

            # 2. Streaming Başlıyor
            async for stream_mode, chunk in graph.astream(
                {"messages": input_messages}, # Düzeltilmiş liste
                config=config,
                stream_mode=["messages", "custom"]
            ):
                # ... (Buradan sonrası aynı) ...
                if stream_mode == "messages":
                    message_chunk, metadata = chunk
                    if metadata.get('langgraph_node') == 'agent':
                        content_to_stream = ""
                        if hasattr(message_chunk, 'content'):
                            if isinstance(message_chunk.content, str):
                                content_to_stream = message_chunk.content
                            elif isinstance(message_chunk.content, list):
                                for item in message_chunk.content:
                                    if isinstance(item, dict) and item.get('type') == 'text':
                                        content_to_stream += item.get('text', '')

                        if content_to_stream:
                            data = {
                                'type': 'token',
                                'content': content_to_stream
                            }
                            yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                
                elif stream_mode == "custom":
                     pass

            # Bitiş sinyali
            yield f"data: {json.dumps({'type': 'complete'}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, port=8001, host="0.0.0.0")