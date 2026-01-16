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

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

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
    
    # --- 🔍 DEBUG LOG: KONUŞMA GEÇMİŞİ BAŞLANGIÇ ---
    print(f"\n{Colors.HEADER}{'='*60}")
    print(f"🔄 LANGGRAPH DÖNGÜSÜ (Mesaj Sayısı: {len(messages)})")
    print(f"{'='*60}{Colors.ENDC}")

    for msg in messages:
        if msg.type == "system":
            # System prompt çok uzunsa sadece başını gösterelim
            content_preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            print(f"{Colors.RED}⚙️  SYSTEM:{Colors.ENDC} {content_preview}")
            
        elif msg.type == "human":
            print(f"{Colors.BLUE}👤 USER:{Colors.ENDC} {msg.content}")
            
        elif msg.type == "ai":
            # Eğer tool çağrısı varsa onu göster, yoksa metni göster
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                print(f"{Colors.YELLOW}🤖 AI (TOOL CALL):{Colors.ENDC} {msg.content} -- {msg.tool_calls}")
            else:
                print(f"{Colors.GREEN}🤖 AI (TEXT):{Colors.ENDC} {msg.content}")
                
        elif msg.type == "tool":
            print(f"{Colors.YELLOW}🛠️  TOOL RESULT ({msg.name}):{Colors.ENDC} {msg.content}")

    print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")
    # --- 🔍 DEBUG LOG BİTİŞ ---

    response = await llm_with_tools.ainvoke(messages, config)
    return {"messages": [response]}

# 3. ROUTER (YÖNLENDİRİCİ)
def route_tools(state: State) -> Literal["backend_tools", "ui_tools", "END"]:
    messages = state["messages"]
    last_message = messages[-1]
    
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return "END"
    
    tool_name = last_message.tool_calls[0]["name"]
    args = last_message.tool_calls[0]["args"]
    print(f'Tool Args: {args}')

    logger.info(f"{tool_name} çağrıldı!!")
    # İsim UI Listesinde varsa oraya git
    if any(t.name == tool_name for t in ui_tool_list):
        return "ui_tools"
    
    return "backend_tools"