# helper_agents.py
from langchain_core.messages import HumanMessage, AIMessage
from langchain_aws import ChatBedrockConverse
from agent.utils.helper_functions import has_tools

def extract_planner_context(llm: ChatBedrockConverse, messages: list) -> str:
    """
    Planner LLM için sohbetten kullanıcı tercihlerini ve tonunu çıkarır.
    Narrative özet değil, antrenman planını etkileyen bilgileri structured formatta döner.
    """
    trimmed_messages = []
    for m in messages:
        if isinstance(m, HumanMessage):
            trimmed_messages.append(m)
        elif isinstance(m, AIMessage) and not has_tools(m):
            trimmed_messages.append(m)

    extraction_prompt = HumanMessage(content="""Yukarıdaki sohbetten antrenman planını etkileyen kullanıcı tercihlerini çıkar.

Şu başlıklar altında kısa ve net yaz (bilgi yoksa o başlığı atlayabilirsin):
- Yoğunluk tercihi: (hafif / orta / zorlayıcı / belirtilmemiş)
- Ton/Ruh hali: (kullanıcının motivasyonu, heyecanı, endişesi varsa belirt)
- Özel istekler: (interval ağırlıklı olsun, uzun koşu seviyorum, sabah koşusu vb.)
- Dikkat edilmesi gerekenler: (sakatlık, kısıtlama, özel durum vb.)

Sadece bu çıktıyı döndür, başka bir şey ekleme.""")

    response = llm.invoke(trimmed_messages + [extraction_prompt])

    raw_content = response.content
    if isinstance(raw_content, str):
        return raw_content.strip()
    elif isinstance(raw_content, list):
        return "".join([
            c.get("text", "") for c in raw_content
            if isinstance(c, dict) and c.get("type") == "text"
        ]).strip()
    return str(raw_content).strip()


def summarize_messages(llm: ChatBedrockConverse, messages: list, summary: str = None):
    last_human_message = messages[-1]
    
    if summary:
        summary_message = HumanMessage(content=f"""
Expand the summary below by incorporating the above conversation while preserving context, key points, and
user intent. Rework the summary if needed. Ensure that no critical information is lost and that the
conversation can continue naturally without gaps. Keep the summary concise yet informative.
Only return the updated summary.

Existing summary:
{summary}
""")
    else:
        summary_message = HumanMessage(content="""
Summarize the above conversation while preserving full context, key points, and user intent. Your response
should be concise yet detailed enough to ensure seamless continuation of the discussion.

Only return the summarized content.
""")
    
    trimmed_messages = []
    for m in messages[:-1]:  
        if isinstance(m, HumanMessage):
            trimmed_messages.append(m)
        elif isinstance(m, AIMessage) and not has_tools(m):
            trimmed_messages.append(m)
    
    messages_to_summary = trimmed_messages + [summary_message]
    print(trimmed_messages)
    
    response = llm.invoke(messages_to_summary)
    
    # 👇 YENİ: BEDROCK YANITINI GÜVENLİ ŞEKİLDE AYIKLA 👇
    raw_content = response.content
    if isinstance(raw_content, str):
        new_summary = raw_content.strip()
    elif isinstance(raw_content, list):
        new_summary = "".join([
            c.get("text", "") for c in raw_content 
            if isinstance(c, dict) and c.get("type") == "text"
        ]).strip()
    else:
        new_summary = str(raw_content).strip()
    return new_summary