import asyncio
import json
import logging
import os
from typing import Any, List

import jwt
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from langchain_core.messages import HumanMessage, ToolMessage
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agent.agent import build_workflow
from agent.utils.helper_functions import format_tool_response, get_checkpointer

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("paceup.chat")

DJANGO_SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not DJANGO_SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY environment variable is required")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
] or ["*"]

security = HTTPBearer()

ALLOWED_UI_TOOLS = {
    "request_runner_profile",
    "request_program_setup",
    "request_availability_preferences",
    "request_plan_confirmation",
}

NOTIFIABLE_BACKEND_TOOLS = {"create_workout_plan"}


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            DJANGO_SECRET_KEY,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return {"user_id": user_id, "token": credentials.credentials}


class StreamChatInput(BaseModel):
    thread_id: str
    messages: List[dict]
    refresh_token: str | None = None


app = FastAPI(title="PaceUp Graph API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            c.get("text", "")
            for c in content
            if isinstance(c, dict) and c.get("type") == "text"
        )
    return str(content)


def extract_tool_calls_safe(output: Any) -> List[dict]:
    try:
        if hasattr(output, "tool_calls") and output.tool_calls:
            return output.tool_calls
        if isinstance(output, dict):
            if "tool_calls" in output:
                return output["tool_calls"]
            if "generations" in output:
                gen = output["generations"][0]
                if isinstance(gen, list):
                    gen = gen[0]
                if isinstance(gen, dict) and "message" in gen:
                    msg = gen["message"]
                    if hasattr(msg, "tool_calls"):
                        return msg.tool_calls
        return []
    except Exception:
        return []


def extract_usage_metadata(output: Any) -> dict | None:
    if hasattr(output, "usage_metadata") and output.usage_metadata:
        return output.usage_metadata
    if isinstance(output, dict):
        if "usage_metadata" in output:
            return output["usage_metadata"]
        if "generations" in output:
            try:
                gen = output["generations"][0]
                if isinstance(gen, list):
                    gen = gen[0]
                if isinstance(gen, dict):
                    msg = gen.get("message")
                    if msg and hasattr(msg, "usage_metadata"):
                        return msg.usage_metadata
                    if isinstance(msg, dict):
                        return msg.get("usage_metadata")
                elif hasattr(gen, "message"):
                    msg = gen.message
                    if hasattr(msg, "usage_metadata"):
                        return msg.usage_metadata
            except Exception as e:
                logger.debug("generations usage parse error: %s", e)
    return None


def normalize_usage(usage_metadata: Any) -> dict:
    if isinstance(usage_metadata, dict):
        input_tokens = usage_metadata.get("input_tokens", 0) or 0
        output_tokens = usage_metadata.get("output_tokens", 0) or 0
        total_tokens = usage_metadata.get("total_tokens", 0) or (
            input_tokens + output_tokens
        )
    else:
        input_tokens = getattr(usage_metadata, "input_tokens", 0) or 0
        output_tokens = getattr(usage_metadata, "output_tokens", 0) or 0
        total_tokens = getattr(usage_metadata, "total_tokens", 0) or (
            input_tokens + output_tokens
        )
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


@app.post("/chat-stream")
async def stream_chat(
    req: Request,
    inp: StreamChatInput,
    user: dict = Depends(verify_token),
):
    config = {
        "configurable": {
            "thread_id": inp.thread_id,
            "user_token": user["token"],
            "user_id": user["user_id"],
            "refresh_token": inp.refresh_token,
        }
    }

    async def event_generator():
        async with get_checkpointer() as cp:
            await cp.setup()
            workflow = build_workflow()
            graph = workflow.compile(
                checkpointer=cp,
                interrupt_before=["ui_tools"],
            )

            try:
                last_msg = inp.messages[-1]
                role = last_msg.get("role", "user")
                inputs = None

                if role == "tool":
                    logger.info("Tool response received: thread=%s", inp.thread_id)
                    content_raw = last_msg["content"]
                    tool_name = last_msg.get("tool_name", "")
                    content_str = format_tool_response(tool_name, content_raw)

                    state = await graph.aget_state(config)
                    tid = last_msg.get("tool_call_id")

                    msgs = state.values.get("messages", [])
                    already_handled = any(
                        isinstance(m, ToolMessage) and m.tool_call_id == tid
                        for m in msgs
                    )
                    if not already_handled:
                        msg = ToolMessage(content=content_str, tool_call_id=tid)
                        await graph.aupdate_state(
                            config,
                            {"messages": [msg]},
                            as_node="ui_tools",
                        )
                    inputs = None
                else:
                    logger.info("User message received: thread=%s", inp.thread_id)

                    # Kullanıcı, açık bir UI tool widget'ını doldurmadan düz
                    # mesaj gönderdiyse state'te cevapsız tool_use kalır.
                    # Anthropic her tool_use'un hemen ardından tool_result
                    # bekler — aksi halde ValidationException. Cevapsız tool
                    # çağrılarına "iptal edildi" ToolMessage'ı ekleyip history'yi
                    # tutarlı hale getiriyoruz.
                    state = await graph.aget_state(config)
                    state_msgs = state.values.get("messages", [])
                    answered_ids = {
                        m.tool_call_id
                        for m in state_msgs
                        if isinstance(m, ToolMessage)
                    }
                    pending_tool_calls = []
                    for m in state_msgs:
                        for tc in getattr(m, "tool_calls", None) or []:
                            tc_id = tc.get("id") if isinstance(tc, dict) else None
                            if tc_id and tc_id not in answered_ids:
                                pending_tool_calls.append(tc_id)

                    if pending_tool_calls:
                        logger.warning(
                            "Cancelling %d unanswered tool call(s) before user "
                            "message: thread=%s ids=%s",
                            len(pending_tool_calls),
                            inp.thread_id,
                            pending_tool_calls,
                        )
                        cancel_msgs = [
                            ToolMessage(
                                content="Kullanıcı bu adımı atladı ve sohbete "
                                "düz mesajla devam etti.",
                                tool_call_id=tc_id,
                            )
                            for tc_id in pending_tool_calls
                        ]
                        await graph.aupdate_state(
                            config,
                            {"messages": cancel_msgs},
                            as_node="ui_tools",
                        )

                    user_text = extract_text_content(last_msg["content"])
                    inputs = {"messages": [HumanMessage(content=user_text)]}

                async for chunk in graph.astream_events(
                    inputs, config=config, version="v1"
                ):
                    if await req.is_disconnected():
                        break

                    kind = chunk["event"]

                    if kind == "on_chat_model_stream":
                        data_chunk = chunk["data"]["chunk"]
                        langgraph_node = chunk["metadata"]["langgraph_node"]

                        if langgraph_node == "agent":
                            content = ""
                            if hasattr(data_chunk, "content"):
                                content = data_chunk.content
                            elif isinstance(data_chunk, dict):
                                content = data_chunk.get("content", "")

                            if isinstance(content, list):
                                content = "".join(
                                    c.get("text", "")
                                    for c in content
                                    if isinstance(c, dict)
                                )

                            if content:
                                yield {
                                    "event": "token",
                                    "data": json.dumps(
                                        {"content": content}, ensure_ascii=False
                                    ),
                                }

                    elif kind == "on_chat_model_end":
                        output = chunk["data"]["output"]
                        tool_calls = extract_tool_calls_safe(output)

                        usage_metadata = extract_usage_metadata(output)
                        if usage_metadata:
                            usage = normalize_usage(usage_metadata)
                            logger.info(
                                "token_usage input=%d output=%d total=%d",
                                usage["input_tokens"],
                                usage["output_tokens"],
                                usage["total_tokens"],
                            )
                            yield {
                                "event": "token_usage",
                                "data": json.dumps(usage),
                            }
                        else:
                            logger.debug(
                                "usage_metadata not found for output type=%s",
                                type(output).__name__,
                            )

                        for tc in tool_calls:
                            raw_name = (
                                tc.get("name")
                                if isinstance(tc, dict)
                                else getattr(tc, "name", "")
                            )
                            t_id = (
                                tc.get("id")
                                if isinstance(tc, dict)
                                else getattr(tc, "id", "")
                            )
                            t_args = (
                                tc.get("args")
                                if isinstance(tc, dict)
                                else getattr(tc, "args", {})
                            )

                            t_name_lower = (raw_name or "").lower()

                            if t_name_lower in ALLOWED_UI_TOOLS:
                                logger.info("UI tool invoked: %s", t_name_lower)
                                yield {
                                    "event": "ask_user",
                                    "data": json.dumps(
                                        {
                                            "name": t_name_lower,
                                            "id": t_id,
                                            "input": t_args,
                                        }
                                    ),
                                }
                            elif t_name_lower in NOTIFIABLE_BACKEND_TOOLS:
                                logger.info(
                                    "Backend tool invoked: %s", t_name_lower
                                )
                                yield {
                                    "event": "tool_use_notification",
                                    "data": json.dumps(
                                        {
                                            "name": t_name_lower,
                                            "message": "Antrenman programın oluşturuluyor...",
                                            "id": t_id,
                                        }
                                    ),
                                }

                yield {"event": "status", "data": json.dumps({"status": "finished"})}

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.exception("Stream error: thread=%s", inp.thread_id)
                yield {"event": "error", "data": json.dumps({"content": str(e)})}

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
