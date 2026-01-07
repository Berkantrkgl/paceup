from typing_extensions import TypedDict
from langchain_core.messages import SystemMessage
from typing import Annotated
from langgraph.graph.message import add_messages

def custom_add_messages(left: list, right: list) -> list:
    # Sağ tarafta SystemMessage varsa, tümünü değiştir
    if right and any(isinstance(msg, SystemMessage) for msg in right):
        return right
    # Yoksa normal add_messages davranışını kullan
    return add_messages(left, right)

class State(TypedDict):
    messages: Annotated[list, custom_add_messages]