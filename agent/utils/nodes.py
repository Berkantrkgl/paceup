# agent/utils/nodes.py
import logging
import json
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import ToolMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
from typing import Literal
from langgraph.types import StreamWriter
from agent.utils.tools import * 
from agent.utils.state import State
from agent.utils.helper_agents import summarize_messages
from agent.utils.config import Colors, HAIKU_35, NOVA_LITE_2
from agent.utils.prompts import AGENT_SYSTEM_PROMPT_TEMPLATE
from agent.utils.helper_functions import fetch_user_context_data

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
load_dotenv(".env", override=True)

SUMMARIZE_THRESHOLD = 15

ui_tool_list = [request_program_setup, request_availability_preferences, request_runner_profile]
backend_tool_list = [create_workout_plan]

summarization_llm = ChatBedrockConverse(
    model=NOVA_LITE_2,
    region_name="us-east-1",
    temperature=0.5,
    max_tokens=4096,
)

def initialize_llm():
    try:
        return ChatBedrockConverse(
            model=HAIKU_35, # Kendi model değişkenini gir
            region_name="us-east-1",
            temperature=0.7,
            max_tokens=4096,
        )
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        raise

llm = initialize_llm()
llm_with_tools = llm.bind_tools(ui_tool_list + backend_tool_list)

async def summarizer(state: State):
    print("\n\n","-"*25, "History Summarizer", "-"*25 )
    messages = state.get('messages', [])
    last_message = messages[-1]
    print(f"LENGTH OF MESSAGES (Before Summarization): {len(messages)}")

    if len(messages) >= SUMMARIZE_THRESHOLD:
        summary = state.get("summary", "")
        new_summary = summarize_messages(summarization_llm, messages, summary)
        new_state = {"messages": [last_message, 'summarize_command'], "summary": new_summary} 
    else: 
        print("No summarization needed")
        new_state = {"messages": messages}
    print("-"*70, "\n\n")
    return new_state

async def agent(state: State, config, writer: StreamWriter):
    messages = state.get("messages", [])
    current_summary = state.get("summary", "")
    
    # Mevcut tercihleri state'den al ve kopyasını oluştur (referans hatalarını önlemek için)
    user_prefs = state.get("user_preferences") or {}
    user_prefs_copy = dict(user_prefs)
    
    # --- YENİ VE GÜVENLİ: TOOL CEVAPLARINDAN TERCİHLERİ AYIKLA ---
    if messages:
        last_msg = messages[-1]
        
        if getattr(last_msg, 'type', '') == 'tool':
            try:
                # İçerik string ise JSON'a çevir, zaten dict ise direkt kullan
                data = json.loads(last_msg.content) if isinstance(last_msg.content, str) else last_msg.content
                
                if isinstance(data, dict):
                    # İçinde 'days' varsa kesinlikle Availability Tool'dur
                    if 'days' in data:
                        user_prefs_copy['selected_days'] = data['days']
                    if 'long_run' in data:
                        user_prefs_copy['long_run_day'] = data['long_run']
                        
                    # İçinde 'goal' varsa kesinlikle Program Setup Tool'dur
                    if 'goal' in data:
                        user_prefs_copy['goal'] = data['goal']
                        
            except (json.JSONDecodeError, TypeError):
                # Düz metin (✅ Program oluşturuldu vs.) geldiyse sessizce atla
                pass
            except Exception as e:
                logger.warning(f"⚠️ Tercihler State'e yazılırken hata oluştu: {e}")

    # --- DİNAMİK SYSTEM PROMPT OLUŞTURMA ---
    user_ctx = fetch_user_context_data(config)
    formatted_sys_prompt = AGENT_SYSTEM_PROMPT_TEMPLATE.format(
        summary=current_summary if current_summary else "Henüz bir özet bulunmuyor.",
        user_info=json.dumps(user_ctx, ensure_ascii=False)
    )
    
    sys_msg = SystemMessage(content=formatted_sys_prompt)
    messages_for_llm = [sys_msg] + messages
    
    # --- 🔍 DEBUG LOG ---
    print(f"\n{Colors.HEADER}{'='*70}")
    print(f"🔄 LANGGRAPH DÖNGÜSÜ (LLM'e Giden Mesaj Sayısı: {len(messages_for_llm)})")
    print(f"{'='*70}{Colors.ENDC}")
    
    for msg in messages_for_llm:
        content_str = str(msg.content).replace("\n", " ").strip()
        content_preview = content_str[:150] + "..." if len(content_str) > 150 else content_str

        if msg.type == "system":
            print(f"{Colors.RED}⚙️  SYSTEM:{Colors.ENDC} {content_preview}")
        elif msg.type == "human":
            print(f"{Colors.BLUE}👤 USER:{Colors.ENDC} {content_preview}")
        elif msg.type == "ai":
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                tool_names = [tc.get("name", "Unknown") for tc in msg.tool_calls]
                print(f"{Colors.YELLOW}🤖 AI (TOOL ÇAĞRISI):{Colors.ENDC} {tool_names} | {content_preview}")
            else:
                print(f"{Colors.GREEN}🤖 AI (TEXT):{Colors.ENDC} {content_preview}")
        elif msg.type == "tool":
            t_name = getattr(msg, 'name', 'Unknown')
            print(f"{Colors.YELLOW}🛠️  TOOL CEVABI ({t_name}):{Colors.ENDC} {content_preview}")

    print(f"{Colors.HEADER}{'='*70}{Colors.ENDC}\n")
    # -------------------
    
    response = await llm_with_tools.ainvoke(messages_for_llm, config)
    
    # Güncellenmiş kopyayı state'e geri dön
    return {"messages": [response], "user_preferences": user_prefs_copy}





def route_tools(state: State) -> Literal["backend_tools", "ui_tools", "END"]:
    messages = state["messages"]
    last_message = messages[-1]
    
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return "END"
    
    tool_name = last_message.tool_calls[0]["name"]
    logger.info(f"{tool_name} çağrıldı!!")
    
    if any(t.name == tool_name for t in ui_tool_list):
        return "ui_tools"
    return "backend_tools"