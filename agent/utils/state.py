from typing_extensions import TypedDict
from typing import Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import SystemMessage

def custom_add_messages(left: list, right: list) -> list:
    """
    Akıllı Mesaj Birleştirici:
    1. Summarizer'dan gelen "Tarihi Sil" emri varsa -> Tüm geçmişi siler, yenisini yazar.
    2. Context Injection ise -> Sadece SystemMessage'ı günceller, sohbeti korur.
    3. Diğer durumlar -> Standart ekleme (append).
    """
    if not right:
        return left

    # 1. KONTROL: Summarizer'dan gelen özel "replace_history" bayrağı var mı?
    # (Genelde SystemMessage veya SummaryMessage üzerinde olur)
    is_replacement_mode = any(
        msg.additional_kwargs.get("replace_history") is True 
        for msg in right
    )

    if is_replacement_mode:
        # SUMMARIZER MODU: Eski hafızayı tamamen çöpe at, gelen yeni (özet) listeyi koy.
        return right

    # 2. KONTROL: Context Injection (Yeni System Message var mı?)
    new_system_message = next((msg for msg in right if isinstance(msg, SystemMessage)), None)

    if new_system_message:
        # CONTEXT MODE: 
        # A. Eski listedeki SystemMessage HARİÇ her şeyi al (Sohbeti Koru)
        history = [msg for msg in left if not isinstance(msg, SystemMessage)]
        
        # B. Yeni listedeki SystemMessage HARİÇ her şeyi al (Yeni User Input)
        new_msgs = [msg for msg in right if not isinstance(msg, SystemMessage)]
        
        # C. Birleştir: [Yeni Context] + [Eski Sohbet] + [Yeni Mesaj]
        return [new_system_message] + history + new_msgs

    # 3. STANDART MOD: Ekle gitsin
    return add_messages(left, right)

class State(TypedDict):
    messages: Annotated[list, custom_add_messages]