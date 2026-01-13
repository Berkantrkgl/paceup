import logging
import jwt 
import asyncio
import json
import os
import uvicorn
from typing import List, Any
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from sse_starlette.sse import EventSourceResponse
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from agent.utils.prompts import AGENT_SYSTEM_PROMPT_TEMPLATE
from agent.utils.helper_functions import fetch_user_context_data
from agent.agent import create_workflow

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DJANGO_SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-xxxx")
security = HTTPBearer()

ALLOWED_UI_TOOLS = [
    "request_runner_profile",
    "request_program_setup",
    "request_availability_preferences"
]

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, DJANGO_SECRET_KEY, algorithms=["HS256"])
        return {"user_id": payload.get("user_id"), "token": credentials.credentials}
    except:
        raise HTTPException(status_code=401, detail="Invalid Token")

class StreamChatInput(BaseModel):
    thread_id: str
    messages: List[dict]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph, pool
    graph, pool = await create_workflow()
    yield
    if pool: await pool.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- GÜVENLİ İÇERİK AYIKLAMA ---
def extract_text_content(content: Any) -> str:
    if isinstance(content, str): return content
    elif isinstance(content, list):
        return "".join([c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"])
    return str(content)

# --- GÜVENLİ TOOL AYIKLAMA ---
def extract_tool_calls_safe(output: Any) -> List[dict]:
    try:
        if hasattr(output, "tool_calls") and output.tool_calls: return output.tool_calls
        if isinstance(output, dict):
            if "tool_calls" in output: return output["tool_calls"]
            # Bedrock Raw Output Handling
            if "generations" in output:
                gen = output["generations"][0]
                if isinstance(gen, list): gen = gen[0]
                if isinstance(gen, dict) and "message" in gen:
                    msg = gen["message"]
                    if hasattr(msg, "tool_calls"): return msg.tool_calls
        return []
    except: return []

@app.post("/chat-stream")
async def stream_chat(req: Request, inp: StreamChatInput, user: dict = Depends(verify_token)):
    global graph
    config = {"configurable": {"thread_id": inp.thread_id, "user_token": user["token"], "user_id": user["user_id"]}}
    
    async def event_generator():
        try:
            last_msg = inp.messages[-1]
            role = last_msg.get("role", "user")
            inputs = None

            # --- 1. TOOL CEVABI GELDİYSE (RESUME) ---
            if role == "tool":
                logger.info(f"🛠️ Tool Response: {inp.thread_id}")
                
                content_raw = last_msg["content"]
                content_str = json.dumps(content_raw) if not isinstance(content_raw, str) else content_raw
                
                state = await graph.aget_state(config)
                tid = last_msg.get("tool_call_id")
                
                # Duplicate Check
                msgs = state.values.get("messages", [])
                if not any(isinstance(m, ToolMessage) and m.tool_call_id == tid for m in msgs):
                    msg = ToolMessage(content=content_str, tool_call_id=tid)
                    await graph.aupdate_state(config, {"messages": [msg]}, as_node="ui_tools")
                
                inputs = None # Resume logic (None input means proceed from current state)

            # --- 2. KULLANICI MESAJI GELDİYSE ---
            else:
                logger.info(f"👤 User Message: {inp.thread_id}")
                user_ctx = fetch_user_context_data(config)
                sys_prompt = f"{AGENT_SYSTEM_PROMPT_TEMPLATE}\n### DATA ###\n{json.dumps(user_ctx)}"
                
                user_text = extract_text_content(last_msg["content"])
                inputs = {"messages": [SystemMessage(content=sys_prompt), HumanMessage(content=user_text)]}

            # --- STREAMING ---
            async for chunk in graph.astream_events(inputs, config=config, version="v1"):
                if await req.is_disconnected(): break
                
                kind = chunk["event"]
                
                # A) TEXT AKIŞI -> Event: "token"
                if kind == "on_chat_model_stream":
                    data_chunk = chunk["data"]["chunk"]
                    content = ""
                    if hasattr(data_chunk, "content"): content = data_chunk.content
                    elif isinstance(data_chunk, dict): content = data_chunk.get("content", "")
                    
                    if isinstance(content, list):
                        content = "".join([c.get("text", "") for c in content if isinstance(c, dict)])

                    if content:
                        yield {"event": "token", "data": json.dumps({"content": content}, ensure_ascii=False)}
                        await asyncio.sleep(0.01)

                # B) TOOL CALL -> Event: "tool_use" (DEĞİŞİKLİK BURADA)
                elif kind == "on_chat_model_end":
                    output = chunk["data"]["output"]
                    tool_calls = extract_tool_calls_safe(output)

                    if tool_calls:
                        for tc in tool_calls:
                            raw_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "")
                            t_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", "")
                            t_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
                            
                            t_name_lower = raw_name.lower()
                            
                            if t_name_lower in ALLOWED_UI_TOOLS:
                                logger.info(f"🚀 LLM YENİ UI TOOL ÇAĞIRDI: {t_name_lower}")
                                payload = {
                                    "type": "tool_use",
                                    "name": t_name_lower, 
                                    "id": t_id,
                                    "input": t_args
                                }
                                # BURASI ARTIK 'token' DEĞİL 'tool_use' OLARAK GİDİYOR
                                yield {"event": "tool_use", "data": json.dumps(payload)}
                                await asyncio.sleep(0.1)

            yield {"event": "status", "data": json.dumps({"status": "finished"})}

        except Exception as e:
            logger.error(f"Stream Error: {e}", exc_info=True)
            yield {"event": "error", "data": json.dumps({"content": str(e)})}

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    uvicorn.run(app, port=8001, host="0.0.0.0")