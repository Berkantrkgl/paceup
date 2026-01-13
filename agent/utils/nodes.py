# agent/utils/nodes.py
import logging
import json
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import ToolMessage, AIMessage
from dotenv import load_dotenv
from typing import Literal
from langgraph.types import StreamWriter

from agent.utils.tools import * # create_workout_plan vb. buradan geliyor
from agent.utils.state import State
from agent.utils.helper_agents import summarize_message_field

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
load_dotenv(".env", override=True)

SONNET_37 = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
NOVA_LITE_2 = "eu.amazon.nova-2-lite-v1:0"

MAX_MESSAGES_BEFORE_SUMMARY = 12

# 1. TOOL LİSTELERİ (Kesin Ayrım)
ui_tool_list = [request_program_setup, request_availability_preferences, request_runner_profile]
backend_tool_list = [get_runner_context, create_workout_plan]

def initialize_llm():
    try:
        return ChatBedrockConverse(
            model=SONNET_37,
            region_name="us-east-1",
            temperature=0.5,
            max_tokens=4096,
        )
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        raise

llm = initialize_llm()
# LLM hepsini bilsin
llm_with_tools = llm.bind_tools(ui_tool_list + backend_tool_list)

# 2. NODE FONKSİYONLARI
def summarizer(state: State):
    messages = state.get('messages', [])
    if not messages: return {"messages": []}
    
    if len(messages) >= MAX_MESSAGES_BEFORE_SUMMARY:
        print(f"\n🧹 Özetleniyor... ({len(messages)} mesaj)")
        summary = summarize_message_field(messages, timeout_seconds=15)
        if summary:
            first = summary[0]
            if not first.additional_kwargs: first.additional_kwargs = {}
            first.additional_kwargs["replace_history"] = True
            return {"messages": summary}
    return {"messages": []}

async def agent(state: State, config, writer: StreamWriter):
    messages = state.get("messages", [])
    response = await llm_with_tools.ainvoke(messages, config)
    return {"messages": [response]}

# 3. ROUTER (YÖNLENDİRİCİ)
def route_tools(state: State) -> Literal["backend_tools", "ui_tools", "END"]:
    messages = state["messages"]
    last_message = messages[-1]
    
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return "END"
    
    tool_name = last_message.tool_calls[0]["name"]
    
    logger.info(f"{tool_name} çağrıldı!!")
    # İsim UI Listesinde varsa oraya git
    if any(t.name == tool_name for t in ui_tool_list):
        return "ui_tools"
    
    return "backend_tools"