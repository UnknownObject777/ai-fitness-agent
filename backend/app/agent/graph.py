from functools import lru_cache

from langgraph.graph import END, StateGraph

from app.agent.nodes.chat_agent import chat_agent_node
from app.agent.nodes.context_builder import context_builder_node
from app.agent.nodes.intent_router import intent_router_node, route_by_intent
from app.agent.nodes.memory_updater import memory_updater_node
from app.agent.nodes.nutrition_agent import nutrition_agent_node
from app.agent.nodes.planner_agent import planner_agent_node
from app.agent.nodes.response_formatter import response_formatter_node
from app.agent.nodes.vision_agent import vision_agent_node
from app.agent.nodes.workout_agent import workout_agent_node
from app.agent.state import AgentState


def build_agent_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("context_builder", context_builder_node)
    workflow.add_node("intent_router", intent_router_node)
    workflow.add_node("workout_agent", workout_agent_node)
    workflow.add_node("nutrition_agent", nutrition_agent_node)
    workflow.add_node("planner_agent", planner_agent_node)
    workflow.add_node("vision_agent", vision_agent_node)
    workflow.add_node("chat_agent", chat_agent_node)
    workflow.add_node("memory_updater", memory_updater_node)
    workflow.add_node("response_formatter", response_formatter_node)

    workflow.set_entry_point("context_builder")
    workflow.add_edge("context_builder", "intent_router")
    workflow.add_conditional_edges(
        "intent_router",
        route_by_intent,
        {
            "workout": "workout_agent",
            "nutrition": "nutrition_agent",
            "planner": "planner_agent",
            "vision": "vision_agent",
            "chat": "chat_agent",
        },
    )

    for node in ["workout_agent", "nutrition_agent", "planner_agent", "vision_agent", "chat_agent"]:
        workflow.add_edge(node, "memory_updater")
    workflow.add_edge("memory_updater", "response_formatter")
    workflow.add_edge("response_formatter", END)
    return workflow.compile()


@lru_cache
def get_agent_graph():
    return build_agent_graph()

