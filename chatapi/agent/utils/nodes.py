import json
import logging
from typing import Literal

from dotenv import load_dotenv
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.types import StreamWriter

from agent.utils.helper_agents import summarize_messages
from agent.utils.helper_functions import fetch_user_context_data
from agent.utils.config import BEDROCK_REGION, HAIKU_45, NOVA_LITE_2
from agent.utils.prompts import AGENT_SYSTEM_PROMPT_TEMPLATE
from agent.utils.state import State
from agent.utils.tools import (
    create_workout_plan,
    request_availability_preferences,
    request_plan_confirmation,
    request_program_setup,
    request_runner_profile,
)

logger = logging.getLogger(__name__)
load_dotenv(".env", override=False)

SUMMARIZE_THRESHOLD = 50

ui_tool_list = [
    request_program_setup,
    request_availability_preferences,
    request_runner_profile,
    request_plan_confirmation,
]
backend_tool_list = [create_workout_plan]

summarization_llm = ChatBedrockConverse(
    model=NOVA_LITE_2,
    region_name=BEDROCK_REGION,
    temperature=0.5,
    max_tokens=4096,
)


def initialize_llm() -> ChatBedrockConverse:
    try:
        return ChatBedrockConverse(
            model=HAIKU_45,
            region_name=BEDROCK_REGION,
            temperature=0.7,
            max_tokens=4096,
        )
    except Exception as e:
        logger.error("LLM init failed: %s", e)
        raise


llm = initialize_llm()
llm_with_tools = llm.bind_tools(ui_tool_list + backend_tool_list)


async def summarizer(state: State):
    messages = state.get("messages", [])
    last_message = messages[-1]

    if len(messages) >= SUMMARIZE_THRESHOLD:
        logger.info("Summarizing %d messages", len(messages))
        summary = state.get("summary", "")
        new_summary = await summarize_messages(
            summarization_llm, messages, summary
        )
        logger.info("Summary updated (%d chars)", len(new_summary))
        return {
            "messages": [last_message, "summarize_command"],
            "summary": new_summary,
        }

    return {"messages": messages}


async def agent(state: State, config, writer: StreamWriter):
    messages = state.get("messages", [])
    current_summary = state.get("summary", "")

    user_prefs = state.get("user_preferences") or {}
    user_prefs_copy = dict(user_prefs)

    if messages:
        last_msg = messages[-1]
        if getattr(last_msg, "type", "") == "tool":
            try:
                data = (
                    json.loads(last_msg.content)
                    if isinstance(last_msg.content, str)
                    else last_msg.content
                )
                if isinstance(data, dict):
                    if "days" in data:
                        user_prefs_copy["selected_days"] = data["days"]
                    if "long_run" in data:
                        user_prefs_copy["long_run_day"] = data["long_run"]
                    if "goal" in data:
                        user_prefs_copy["goal"] = data["goal"]
                    if "mode" in data:
                        user_prefs_copy["program_mode"] = data["mode"]
                    if "value" in data:
                        user_prefs_copy["program_value"] = data["value"]
                    if "start_date" in data:
                        user_prefs_copy["start_date"] = data["start_date"]
            except (json.JSONDecodeError, TypeError):
                pass
            except Exception as e:
                logger.warning("Failed to extract prefs from tool msg: %s", e)

    user_ctx = await fetch_user_context_data(config)
    formatted_sys_prompt = AGENT_SYSTEM_PROMPT_TEMPLATE.format(
        summary=current_summary or "Henüz bir özet bulunmuyor.",
        user_info=json.dumps(user_ctx, ensure_ascii=False),
    )

    if user_prefs_copy.get("program_mode") == "ai_decide":
        formatted_sys_prompt += (
            "\n\n[GİZLİ SİSTEM NOTU]: Kullanıcı program süresini (hafta sayısını) "
            "SENİN belirlemeni istedi ('ai_decide'). Lütfen kullanıcının seçtiği "
            "hedefe (goal), profiline ve mevcut pace'ine bakarak en ideal program "
            "süresini KENDİN belirle (Örn: 5K için 4-6 hafta, Maraton için 16-20 "
            "hafta vb.). Planlama yaparken ve 'create_workout_plan' aracını "
            "çağırırken 'duration_weeks' argümanına hesapladığın bu sayıyı gönder."
        )

    sys_msg = SystemMessage(content=formatted_sys_prompt)
    messages_for_llm = [sys_msg] + messages

    logger.debug("Agent loop: %d messages", len(messages_for_llm))

    response = await llm_with_tools.ainvoke(messages_for_llm, config)
    return {"messages": [response], "user_preferences": user_prefs_copy}


def route_tools(state: State) -> Literal["backend_tools", "ui_tools", "END"]:
    messages = state["messages"]
    last_message = messages[-1]

    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return "END"

    tool_name = last_message.tool_calls[0]["name"]

    if any(t.name == tool_name for t in ui_tool_list):
        return "ui_tools"
    return "backend_tools"
