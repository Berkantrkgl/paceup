import logging
import jwt 
import asyncio
import json
import os
import uvicorn
from typing import List, Any
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from sse_starlette.sse import EventSourceResponse
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from agent.utils.prompts import AGENT_SYSTEM_PROMPT_TEMPLATE
from agent.utils.helper_functions import fetch_user_context_data, get_checkpointer
from agent.agent import build_workflow

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DJANGO_SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-xxxx")
security = HTTPBearer()

ALLOWED_UI_TOOLS = [
    "request_runner_profile",
    "request_program_setup",
    "request_availability_preferences",
    "request_plan_confirmation"
]

NOTIFIABLE_BACKEND_TOOLS = [
    "create_workout_plan"
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

# Lifespan kaldırıldı, uygulama yalın başlatılıyor
app = FastAPI()
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
    config = {"configurable": {"thread_id": inp.thread_id, "user_token": user["token"], "user_id": user["user_id"]}}
    
    async def event_generator():
        # --- YENİ YAPI: CHECKPOINTER CONTEXT MANAGER İLE YÖNETİLİYOR ---
        async with get_checkpointer() as cp:
            await cp.setup()
            workflow = build_workflow()
            # Önceki kodundaki gibi ui_tools'dan önce interrupt ediyoruz
            graph = workflow.compile(checkpointer=cp, interrupt_before=["ui_tools"])

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
                    
                    inputs = None 

                # --- 2. KULLANICI MESAJI GELDİYSE ---
                else:
                    logger.info(f"👤 User Message: {inp.thread_id}")
                    user_text = extract_text_content(last_msg["content"])
                    inputs = {"messages": [HumanMessage(content=user_text)]}

                # --- STREAMING ---
                async for chunk in graph.astream_events(inputs, config=config, version="v1"):
                    if await req.is_disconnected(): break
                    
                    kind = chunk["event"]
                    
                    if kind == "on_chat_model_stream":
                        data_chunk = chunk["data"]["chunk"]
                        langgraph_node = chunk["metadata"]['langgraph_node']

                        if langgraph_node in ['agent']:
                            content = ""
                            if hasattr(data_chunk, "content"): content = data_chunk.content
                            elif isinstance(data_chunk, dict): content = data_chunk.get("content", "")
                            
                            if isinstance(content, list):
                                content = "".join([c.get("text", "") for c in content if isinstance(c, dict)])

                            if content:
                                yield {"event": "token", "data": json.dumps({"content": content}, ensure_ascii=False)}
                                await asyncio.sleep(0.01)

                    elif kind == "on_chat_model_end":
                        output = chunk["data"]["output"]
                        tool_calls = extract_tool_calls_safe(output)

                        # Bedrock generations formatından usage_metadata çıkar
                        usage_metadata = None

                        # 1. Direkt attribute
                        if hasattr(output, "usage_metadata") and output.usage_metadata:
                            usage_metadata = output.usage_metadata

                        # 2. Dict — direkt key
                        elif isinstance(output, dict) and "usage_metadata" in output:
                            usage_metadata = output["usage_metadata"]

                        # 3. Bedrock generations formatı
                        elif isinstance(output, dict) and "generations" in output:
                            try:
                                gen = output["generations"][0]
                                if isinstance(gen, list):
                                    gen = gen[0]
                                # gen bir dict ise
                                if isinstance(gen, dict):
                                    msg = gen.get("message")
                                    if msg and hasattr(msg, "usage_metadata"):
                                        usage_metadata = msg.usage_metadata
                                    elif msg and isinstance(msg, dict):
                                        usage_metadata = msg.get("usage_metadata")
                                # gen bir obje ise
                                elif hasattr(gen, "message"):
                                    msg = gen.message
                                    if hasattr(msg, "usage_metadata"):
                                        usage_metadata = msg.usage_metadata
                            except Exception as e:
                                logger.warning(f"generations parse error: {e}")

                        # 4. llm_output içinde token kullanımı (Bedrock alternatif konum)
                        if not usage_metadata and isinstance(output, dict) and "llm_output" in output:
                            llm_output = output["llm_output"]
                            usage = llm_output.get("usage", {})
                            if usage:
                                usage_metadata = {
                                    "input_tokens": usage.get("prompt_tokens") or usage.get("inputTokens") or usage.get("input_tokens", 0),
                                    "output_tokens": usage.get("completion_tokens") or usage.get("outputTokens") or usage.get("output_tokens", 0),
                                    "total_tokens": usage.get("total_tokens") or usage.get("totalTokens", 0),
                                }

                        if not usage_metadata:
                            logger.warning(f"❌ usage_metadata bulunamadı. output keys: {list(output.keys()) if isinstance(output, dict) else type(output)}")
                            # Tüm output'u logla (kısa tutarak)
                            if isinstance(output, dict):
                                for k, v in output.items():
                                    if k != "generations":
                                        logger.info(f"   output['{k}']: {str(v)[:200]}")

                        if usage_metadata:
                            if isinstance(usage_metadata, dict):
                                input_tokens = usage_metadata.get("input_tokens", 0)
                                output_tokens = usage_metadata.get("output_tokens", 0)
                                total_tokens = usage_metadata.get("total_tokens", 0) or (input_tokens + output_tokens)
                            else:
                                input_tokens = getattr(usage_metadata, "input_tokens", 0) or 0
                                output_tokens = getattr(usage_metadata, "output_tokens", 0) or 0
                                total_tokens = getattr(usage_metadata, "total_tokens", 0) or (input_tokens + output_tokens)

                            logger.info(f"📊 Token usage: input={input_tokens}, output={output_tokens}, total={total_tokens}")

                            yield {
                                "event": "token_usage",
                                "data": json.dumps({
                                    "input_tokens": input_tokens,
                                    "output_tokens": output_tokens,
                                    "total_tokens": total_tokens
                                })
                            }

                        if tool_calls:
                            for tc in tool_calls:
                                raw_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "")
                                t_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", "")
                                t_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
                                
                                t_name_lower = raw_name.lower()
                                
                                if t_name_lower in ALLOWED_UI_TOOLS:
                                    logger.info(f"🚀 LLM UI TOOL ÇAĞIRDI: {t_name_lower}")
                                    payload = {
                                        "name": t_name_lower, 
                                        "id": t_id,
                                        "input": t_args
                                    }
                                    yield {"event": "ask_user", "data": json.dumps(payload)}
                                    await asyncio.sleep(0.1)

                                elif t_name_lower in NOTIFIABLE_BACKEND_TOOLS:
                                    logger.info(f"⚙️ BACKEND TOOL ÇALIŞIYOR: {t_name_lower}")
                                    payload = {
                                        "name": t_name_lower,
                                        "message": "Antrenman programın oluşturuluyor...",
                                        "id": t_id
                                    }
                                    yield {"event": "tool_use_notification", "data": json.dumps(payload)}
                                    await asyncio.sleep(0.1)

                yield {"event": "status", "data": json.dumps({"status": "finished"})}

            except Exception as e:
                logger.error(f"Stream Error: {e}", exc_info=True)
                yield {"event": "error", "data": json.dumps({"content": str(e)})}

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    uvicorn.run(app, port=8001, host="0.0.0.0")