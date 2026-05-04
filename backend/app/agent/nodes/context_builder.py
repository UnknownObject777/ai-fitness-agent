from typing import Any

from langchain_core.messages import HumanMessage

from app.agent.state import AgentState
from app.services.memory import build_agent_context, format_context_as_system_prompt


async def context_builder_node(state: AgentState) -> AgentState:
    context = await build_agent_context(
        state.get("user_message", ""),
        state.get("session_id"),
        state.get("chat_history") or [],
    )

    # Build initial messages from chat history
    messages: list = []
    for msg in state.get("chat_history") or []:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        # assistant messages are added by the supervisor agent

    formatted_prompt = format_context_as_system_prompt(context)

    return {
        **state,
        "semantic_memory": context.semantic_memory.model_dump(by_alias=True),
        "episodic_memory": context.recent_episodes,
        "working_memory": context.working_memory.model_dump(by_alias=True),
        "memory_prompt": formatted_prompt,
        "context_sections": getattr(context, "context_sections", {"legacy": formatted_prompt}),
        "messages": messages,
    }
