from langgraph.graph import StateGraph, START, END
from agent.utils.state import State
from langgraph.prebuilt import ToolNode
from agent.utils.nodes import (
    agent, summarizer, route_tools, 
    ui_tool_list, backend_tool_list
)

def build_workflow() -> StateGraph:
    """Graph workflow'u oluşturur (compile etmeden döndürür)."""
    workflow = StateGraph(State)

    workflow.add_node("summarizer", summarizer)
    workflow.add_node("agent", agent)
    
    # İki Ayrı Node
    workflow.add_node("ui_tools", ToolNode(ui_tool_list))
    workflow.add_node("backend_tools", ToolNode(backend_tool_list))

    workflow.add_edge(START, "summarizer")
    workflow.add_edge("summarizer", "agent")

    workflow.add_conditional_edges(
        "agent", 
        route_tools,
        {"END": END, "ui_tools": "ui_tools", "backend_tools": "backend_tools"}
    )

    workflow.add_edge("backend_tools", "agent")
    workflow.add_edge("ui_tools", "agent")

    # DB bağlantısı ve compile adımları kaldırıldı. Direkt workflow dönüyor.
    return workflow