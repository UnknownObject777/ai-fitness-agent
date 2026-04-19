from app.agent.state import AgentState
from app.services.db import add_chat_message
from app.services.memory import update_semantic_memory


async def memory_updater_node(state: AgentState) -> AgentState:
    session_id = state.get("session_id") or "session_1"
    intent = state.get("detected_intent") or "chat"
    data = state.get("structured_data") or {}
    response = state.get("ai_response") or ""

    await add_chat_message(
        session_id,
        "user",
        state.get("user_message", ""),
        state.get("image_key") or state.get("base64_image"),
    )
    await add_chat_message(session_id, "assistant", response, None, intent, data)

    profile_update = state.get("profile_update")
    if profile_update:
        await update_semantic_memory(profile_update)

    return state

