from langgraph.graph import StateGraph, START, END
from agent.utils.state import State
from langgraph.prebuilt import ToolNode
from agent.utils.nodes import *
from agent.utils.helper_functions import setup_postgres_connection
from langgraph.checkpoint.memory import MemorySaver # Fallback için

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
        {"END": END, "tools": "tools"}
    )
    workflow.add_edge("tools", "agent")

    pool = None
    try:
        # DB Bağlantısı
        memory, pool = await setup_postgres_connection()
        print("✅ PostgreSQL Bağlantısı Başarılı")
            
        # Graph Derleme
        # interrupt_before=["tools"] -> HITL için şart!
        graph = workflow.compile(
            checkpointer=memory,
            interrupt_before=["tools"] 
        )
        
        return graph, pool  # <-- MUTLAKA DÖNMELİ

    except Exception as e:
        print(f"❌ Graph Oluşturma Hatası: {e}")
        if pool:
            await pool.close() # Hata varsa pool'u temizle
        raise e  # <-- MUTLAKA HATAYI FIRLATMALI (Main.py bunu yakalayacak)