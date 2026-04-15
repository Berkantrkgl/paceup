import logging
from typing import Optional

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, HumanMessage

from agent.utils.helper_functions import has_tools

logger = logging.getLogger(__name__)


def _extract_text(raw_content) -> str:
    if isinstance(raw_content, str):
        return raw_content.strip()
    if isinstance(raw_content, list):
        return "".join(
            c.get("text", "")
            for c in raw_content
            if isinstance(c, dict) and c.get("type") == "text"
        ).strip()
    return str(raw_content).strip()


async def extract_planner_context(
    llm: ChatBedrockConverse, messages: list
) -> str:
    trimmed_messages = [
        m
        for m in messages
        if isinstance(m, HumanMessage)
        or (isinstance(m, AIMessage) and not has_tools(m))
    ]

    extraction_prompt = HumanMessage(
        content="""Yukarıdaki sohbetten antrenman planını etkileyen kullanıcı tercihlerini çıkar.

Şu başlıklar altında kısa ve net yaz (bilgi yoksa o başlığı atlayabilirsin):
- Yoğunluk tercihi: (hafif / orta / zorlayıcı / belirtilmemiş)
- Ton/Ruh hali: (kullanıcının motivasyonu, heyecanı, endişesi varsa belirt)
- Özel istekler: (interval ağırlıklı olsun, uzun koşu seviyorum, sabah koşusu vb.)
- Dikkat edilmesi gerekenler: (sakatlık, kısıtlama, özel durum vb.)

Sadece bu çıktıyı döndür, başka bir şey ekleme."""
    )

    response = await llm.ainvoke(trimmed_messages + [extraction_prompt])
    return _extract_text(response.content)


async def summarize_messages(
    llm: ChatBedrockConverse, messages: list, summary: Optional[str] = None
) -> str:
    if summary:
        summary_message = HumanMessage(
            content=f"""
Expand the summary below by incorporating the above conversation while preserving context, key points, and
user intent. Rework the summary if needed. Ensure that no critical information is lost and that the
conversation can continue naturally without gaps. Keep the summary concise yet informative.
Only return the updated summary.

Existing summary:
{summary}
"""
        )
    else:
        summary_message = HumanMessage(
            content="""
Summarize the above conversation while preserving full context, key points, and user intent. Your response
should be concise yet detailed enough to ensure seamless continuation of the discussion.

Only return the summarized content.
"""
        )

    trimmed_messages = [
        m
        for m in messages[:-1]
        if isinstance(m, HumanMessage)
        or (isinstance(m, AIMessage) and not has_tools(m))
    ]

    response = await llm.ainvoke(trimmed_messages + [summary_message])
    return _extract_text(response.content)
