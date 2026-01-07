from langchain_core.messages import ToolMessage, AIMessage
from agent.utils.tools import *
from agent.utils.helper_functions import *
from agent.utils.helper_agents import *
from agent.utils.state import State
from langchain_aws import ChatBedrockConverse
from dotenv import load_dotenv
import logging
from langgraph.types import Literal
from langgraph.types import StreamWriter


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv(".env", override=True)

## ÇALIŞAN MODELLER
NOVA_PREMIER = "us.amazon.nova-premier-v1:0"
NOVA_LITE = "amazon.nova-lite-v1:0"
HAIKU_35 = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
SONNET_37 = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
SONNET_35_V2 = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
MAX_MESSAGES_BEFORE_SUMMARY = 12


def initialize_llm() -> ChatBedrock:
    try:
        return ChatBedrockConverse(
            model=SONNET_37,
            region_name="us-east-1",
            temperature=1,
            max_tokens=4096,  # Daha net kontrol
            verbose=True
        )
    except Exception as e:
        logger.error(f"LLM başlatma hatası: {e}")
        raise

try:
    llm = initialize_llm()
    tool_list = [get_user_profile, get_workout_stats, create_comprehensive_plan]
    llm_with_tools = llm.bind_tools(tool_list)
except Exception as e:
    logger.critical(f"Araç veya LLM konfigürasyon hatası: {e}")
    raise



def summarizer(state: State):
    messages = state.get('messages', [])
    if not messages:
        return {"messages": []}
    if len(messages) >= MAX_MESSAGES_BEFORE_SUMMARY:
        print("Mesaj sayısı fazla, özet alınıyor...")
        summarized_messages = summarize_message_field(messages, timeout_seconds=15)
        print("Summarized messages: ", summarized_messages)
        return {"messages": summarized_messages}
    return {"messages": messages}


async def agent(state: State, config, writer: StreamWriter):
    messages = state.get("messages", [])
    last_message = messages[-1]
    if isinstance(last_message, ToolMessage): 
        print("Tool Message: ", last_message)
        
    response = await llm_with_tools.ainvoke(messages, config)
    if response.tool_calls:
        print("\n","-"*20)
        print("Tool Call: ", response.tool_calls)
        writer({"new_line": "\n\n"})
        print("-"*20)
    return {"messages": [response]}



# 🔥 DÜZELTME: Conditional function
def tool_usage_condition(state: State) -> Literal["END", "tools"]:
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(f"Expected AIMessage, got {type(last_message).__name__}")
    if not last_message.tool_calls:
        return "END"  # "__end__" yerine "END"
    return "tools"