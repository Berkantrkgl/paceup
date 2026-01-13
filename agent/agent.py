# agent/agent.py
from langgraph.graph import StateGraph, START, END
from agent.utils.state import State
from langgraph.prebuilt import ToolNode
from agent.utils.helper_functions import setup_postgres_connection
from agent.utils.nodes import (
    agent, summarizer, route_tools, 
    ui_tool_list, backend_tool_list
)

async def create_workflow():
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

    pool = None
    try:
        memory, pool = await setup_postgres_connection()
        print("✅ DB Bağlantısı OK")
        
        # SADECE UI TOOLS için durakla
        graph = workflow.compile(
            checkpointer=memory,
            interrupt_before=["ui_tools"] 
        )
        return graph, pool
    except Exception as e:
        if pool: await pool.close()
        raise e