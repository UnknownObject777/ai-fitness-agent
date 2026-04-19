from app.agent.state import AgentState
from app.services.memory import build_agent_context, format_context_as_system_prompt


async def context_builder_node(state: AgentState) -> AgentState:
    context = await build_agent_context(
        state.get("user_message", ""),
        state.get("session_id"),
        state.get("chat_history") or [],
    )
    return {
        **state,
        "semantic_memory": context.semantic_memory.model_dump(by_alias=True),
        "episodic_memory": context.recent_episodes,
        "working_memory": context.working_memory.model_dump(by_alias=True),
        "memory_prompt": format_context_as_system_prompt(context),
    }

