from langgraph.graph import StateGraph, START, END
from agent.utils.state import State
from langgraph.prebuilt import ToolNode
from agent.utils.nodes import *
from agent.utils.helper_functions import setup_postgres_connection

async def create_workflow():
    workflow = StateGraph(State)

    workflow.add_node("summarizer", summarizer)
    workflow.add_node("agent", agent)
    workflow.add_node("tools", ToolNode(tool_list))

    workflow.add_edge(START, "summarizer")
    workflow.add_edge("summarizer", "agent")
    workflow.add_conditional_edges(
        "agent", 
        tool_usage_condition,
        {"END": END, "tools": "tools"}  # Mapping ekle
    )
    workflow.add_edge("tools", "agent")
    
    try:
        memory, pool = await setup_postgres_connection()
        graph = workflow.compile(checkpointer=memory)
        return graph, pool
    except Exception as e:
        print(f"Bağlantı kurulurken hata oluştu: {e}")
        return None, None