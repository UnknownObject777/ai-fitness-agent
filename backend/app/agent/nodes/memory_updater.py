from typing import Any

from app.agent.state import AgentState
from app.services.db import add_chat_message
from app.services.memory import update_semantic_memory


async def memory_updater_node(state: AgentState) -> AgentState:
    session_id = state.get("session_id") or "session_1"
    intent = _infer_intent(state)
    data = state.get("structured_data") or {}
    response = state.get("ai_response") or ""

    await add_chat_message(
        session_id,
        "user",
        state.get("user_message", ""),
        state.get("image_key") or state.get("base64_image"),
    )
    await add_chat_message(session_id, "assistant", response, None, intent, data)

    # Distill strength events into semantic memory
    if intent == "log_strength_workout" and isinstance(data.get("exercises"), list):
        from app.models.memory import SemanticMemory
        from app.services.memory import get_or_init_semantic_memory, save_semantic_memory
        from app.services.semantic_distiller import distill_strength_event

        semantic = SemanticMemory.model_validate(await get_or_init_semantic_memory("user_1"))
        for exercise in data.get("exercises") or []:
            for set_item in exercise.get("sets") or []:
                semantic = distill_strength_event(
                    semantic,
                    {
                        "exerciseName": exercise.get("name") or exercise.get("exercise_name"),
                        "weightKg": set_item.get("weight") or set_item.get("weight_kg"),
                        "reps": set_item.get("reps"),
                        "rpe": set_item.get("rpe"),
                    },
                )
        await save_semantic_memory("user_1", semantic.model_dump(by_alias=True))

    # Try to extract profile updates from tool results
    messages = state.get("messages", [])
    for msg in reversed(messages):
        if hasattr(msg, "content"):
            try:
                import json
                content = msg.content
                if isinstance(content, str):
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "weakPoints" in parsed:
                        await update_semantic_memory(parsed)
                        return state
            except (json.JSONDecodeError, Exception):
                pass

    return state


def _infer_intent(state: AgentState) -> str:
    if state.get("plan_execution"):
        return "generate_workout_plan"
    data = state.get("structured_data", {})
    if not data:
        return "chat"
    if "exercises" in data or "training_volume" in data:
        return "log_strength_workout"
    if "food_name" in data or "calories" in data:
        return "log_food"
    if "weekly_templates" in data or "plan_metadata" in data:
        return "generate_workout_plan"
    if "measurements" in data or "weight_kg" in data:
        return "log_measurement"
    if "items" in data and "total" in data:
        return "log_food_multi"
    if "exercise_name" in data and "duration_minutes" in data:
        return "log_exercise"
    return "chat"
