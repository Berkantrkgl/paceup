from typing_extensions import TypedDict
from typing import Annotated
from langgraph.graph.message import add_messages

def custom_add_messages(left: list, right: list) -> list:
    if len(right) == 2 and right[-1] == 'summarize_command':
        return right[:-1]
    return add_messages(left, right)

class State(TypedDict):
    messages: Annotated[list, custom_add_messages]
    summary: any
    user_preferences: dict  # 👈 YENİ: Kullanıcı tercihlerini burada tutacağız