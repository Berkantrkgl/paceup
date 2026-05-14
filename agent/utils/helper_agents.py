import json
import logging
import re
from typing import Optional

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from agent.utils.helper_functions import has_tools

logger = logging.getLogger(__name__)

VALID_WORKOUT_TYPES = {"easy", "tempo", "interval", "long"}


def _build_conversation_transcript(messages: list) -> str:
    """Konuşma geçmişini düz metin transkripte çevirir.

    Kullanıcının kendi mesajları + UI tool form cevapları (format_tool_response
    ile zaten temiz metne çevrilmiş) alınır. AI sohbet baloncukları atlanır —
    çıkarım için gürültü, ve LLM'in 'sohbete devam et' sanmasına yol açıyor.
    """
    lines = []
    for m in messages:
        if isinstance(m, HumanMessage):
            text = _extract_text(m.content)
            if text:
                lines.append(f"[KULLANICI]: {text}")
        elif isinstance(m, ToolMessage):
            text = _extract_text(m.content)
            if text:
                lines.append(f"[FORM CEVABI]: {text}")
    return "\n".join(lines)


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


def _parse_constraints_json(text: str) -> dict:
    """extract_planner_context çıktısının sonundaki JSON bloğunu güvenli parse eder.
    Bulamazsa veya bozuksa boş/güvenli bir default döner."""
    default = {"forbidden_types": [], "has_health_constraint": False}
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return default
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return default

    forbidden = data.get("forbidden_types", [])
    if not isinstance(forbidden, list):
        forbidden = []
    forbidden = [
        str(t).lower().strip()
        for t in forbidden
        if str(t).lower().strip() in VALID_WORKOUT_TYPES
    ]
    return {
        "forbidden_types": forbidden,
        "has_health_constraint": bool(data.get("has_health_constraint", False)),
    }


async def extract_planner_context(
    llm: ChatBedrockConverse, messages: list, goal: str = ""
) -> tuple[str, dict]:
    """Sohbetten planlama bağlamını çıkarır.

    Args:
        messages: konuşma geçmişi
        goal: kullanıcının seçtiği hedef (örn "10K", "Sakatlıktan dönüş") — hedefin
              kendisi bir sağlık sinyali taşıyabilir, o yüzden çıkarıma dahil edilir

    Döndürür: (narrative, constraints)
      - narrative: planner LLM'e verilecek serbest metin direktif
      - constraints: kodun karar vermek için kullandığı yapılandırılmış dict
        ({"forbidden_types": [...], "has_health_constraint": bool})
    """
    transcript = _build_conversation_transcript(messages)
    goal_line = (
        f'KULLANICININ SEÇTİĞİ HEDEF: "{goal.strip()}"'
        if goal and goal.strip()
        else "KULLANICININ SEÇTİĞİ HEDEF: belirtilmemiş"
    )

    # Görev tanımı SystemMessage olarak verilir — chat geçmişi mesaj dizisi
    # olarak DEĞİL, HumanMessage içinde düz transkript metni olarak verilir.
    # Böylece LLM bunu "analiz edilecek görev" olarak görür, "devam edilecek
    # sohbet" olarak değil. (Mesaj dizisi verilince LLM son AI mesajını
    # kopyalıyordu — bug buydu.)
    # Not: normal string (f-string DEĞİL) — örnek JSON'daki literal süslü
    # parantezler f-string format specifier sanılıp hata vermesin.
    system_instruction = SystemMessage(
        content="""Sen bir veri çıkarım asistanısın. Görevin: aşağıda verilecek koşu
koçluğu sohbet transkriptinden, antrenman planını etkileyen kullanıcı bilgilerini
çıkarmak. Sohbete DEVAM ETME, kullanıcıya soru SORMA, selamlama YAZMA — sadece
istenen çıkarım formatını üret.

Çıktın bir antrenman planlama modeline DİREKTİF olarak verilecek — gözlem değil,
UYGULANABİLİR KURAL yaz.

EN ÖNEMLİ KURAL — SADIK KAL, UYDURMA:
- forbidden_types'a SADECE kullanıcının AÇIKÇA reddettiği tipi ekle. "interval
  istemiyorum" → SADECE ["interval"]. Söylenmeyeni çıkarımla ekleme — "interval
  istemeyen tempo da istemez" gibi akıl yürütme YASAK.
- Kullanıcı bir tipi istemediğini söylediyse (örn "interval olmasın", "long koyma")
  → o tipi "YASAK" işaretle. Bir tipi tercih ettiyse → "AĞIRLIKLI" yaz.
- Kullanıcı hiçbir tip kısıtlaması belirtmediyse → forbidden_types BOŞ kalsın,
  "Antrenman tipi kısıtlamaları: belirtilmemiş" yaz. Bu tamamen normaldir.
- Sağlık durumu (sakatlık, ağrı, ameliyat, "yeni dönüyorum", fizyoterapi) VARSA →
  interval ve tempo YASAK, long MİNİMAL, easy AĞIRLIKLI olarak işaretle. Sağlık
  durumu yoksa bunu UYDURMA.
- HEDEF'in kendisi de sağlık sinyali olabilir: hedef "sakatlıktan dönüş",
  "iyileşme", "yaralanma sonrası" gibi ifadeler içeriyorsa — sohbette detay
  olmasa bile — bunu sağlık kısıtlaması say. Hedef sıradan bir performans
  hedefiyse (10K, maraton, yarı maraton, kilo verme) bu kural GEÇERSİZ.

ÇIKTI FORMATI — önce şu başlıklar (bilgi yoksa "belirtilmemiş" yaz):
- Antrenman tipi kısıtlamaları: (hangi tipler YASAK / AĞIRLIKLI / MİNİMAL)
- Yoğunluk tercihi: (hafif / orta / zorlayıcı / belirtilmemiş)
- Sağlık durumu: (sakatlık/ağrı/iyileşme varsa açıkça yaz; yoksa "belirtilmemiş")
- Ton/Ruh hali: (motivasyon, endişe varsa belirt; yoksa "belirtilmemiş")
- Diğer özel istekler: (sabah koşusu, belirli gün tercihi vb.; yoksa "belirtilmemiş")

SONRA en sona TEK satır JSON ekle:
{"forbidden_types": ["..."], "has_health_constraint": true/false}
- forbidden_types: sadece "easy"/"tempo"/"interval"/"long" değerleri. SADECE
  açıkça reddedilen veya sağlık durumu nedeniyle imkansız olan tipler. Boş
  olabilir — kullanıcı bir şey demediyse boş bırak.
- has_health_constraint: sakatlık/ağrı/iyileşme varsa true, yoksa false.

JSON dışında, başlıklardan sonra başka hiçbir şey ekleme."""
    )

    user_payload = HumanMessage(
        content=goal_line
        + "\n\n--- SOHBET TRANSKRİPTİ ---\n"
        + (transcript or "(transkript boş)")
        + "\n--- TRANSKRİPT SONU ---\n\nYukarıdaki transkripti analiz et ve "
        "istenen çıkarım formatını üret."
    )

    response = await llm.ainvoke([system_instruction, user_payload])
    full_text = _extract_text(response.content)
    constraints = _parse_constraints_json(full_text)
    return full_text, constraints


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
