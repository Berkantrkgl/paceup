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
    tool_list = [get_runner_context, create_workout_plan, request_program_setup, request_availability_preferences, request_runner_profile] 
    llm_with_tools = llm.bind_tools(tool_list)
except Exception as e:
    logger.critical(f"Araç veya LLM konfigürasyon hatası: {e}")
    raise


def summarizer(state: State):
    messages = state.get('messages', [])
    if not messages:
        return {"messages": []}
    
    # Eşik kontrolü (Örn: 12 mesaj)
    if len(messages) >= MAX_MESSAGES_BEFORE_SUMMARY:
        print(f"\n🧹 [Summarizer] Mesaj sayısı ({len(messages)}) sınırı aştı, özetleniyor...")
        
        # 1. Özeti oluştur (Mevcut helper fonksiyonunu kullan)
        # Dönüş: [SystemMessage, Summary(Human), LastMessage]
        summarized_messages = summarize_message_field(messages, timeout_seconds=15)
        
        if summarized_messages:
            # 2. KRİTİK HAMLE: Listeye "Ben geçmişi silerim" damgası vuruyoruz.
            # İlk mesaj genelde SystemMessage'dır. Onun meta verisine ekliyoruz.
            first_msg = summarized_messages[0]
            
            # additional_kwargs sözlüğünü güncelle (yoksa oluştur)
            if not first_msg.additional_kwargs:
                first_msg.additional_kwargs = {}
            
            first_msg.additional_kwargs["replace_history"] = True
            
            # Damgalanmış listeyi döndür
            return {"messages": summarized_messages}
            
    return {"messages": []} # Değişiklik yok

async def agent(state: State, config, writer: StreamWriter):
    messages = state.get("messages", [])
    
    response = await llm_with_tools.ainvoke(messages, config) 
    if response.tool_calls:
        print("\n\n" + "-"*60)
        print(f"Tool Call: {json.dumps(response.tool_calls[0], ensure_ascii=False)}")
        print("-"*60)
        usage_message = "\nSana yardımcı olmak için elimdeki araçları kullanıyorum..."
        if response.tool_calls[0]['name'] == 'get_runner_context':
            usage_message = "Bilgilerini alıyorum... Bir sn lütfen...\n"
        elif response.tool_calls[0]['name'] == "create_workout_plan":
            usage_message = "Antreman programınız oluşlturuyorum. Biraz sürebilir ama değecek emin ol!\n"
        elif response.tool_calls[0]['name'] == "reschedule_program":
            usage_message = "Programını güncelleiyorum. Biraz sürebilir, sabır pls :)\n"    
        # Notebook ortamında writer şart değil ama yapıyı bozmuyoruz
        writer({"tool_usage_info": usage_message})
        
    return {"messages": [response]}

# Conditional Edge Mantığı
def tool_usage_condition(state: State) -> Literal["END", "tools"]:
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(f"Expected AIMessage, got {type(last_message).__name__}")
    if not last_message.tool_calls:
        return "END"
    return "tools"