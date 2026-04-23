from typing import Any

from app.agent.state import AgentState


async def response_formatter_node(state: AgentState) -> AgentState:
    data = state.get("structured_data") or {}
    intent = _infer_intent(data)
    payload: dict[str, Any] = {
        "success": True,
        "response": state.get("ai_response") or "",
        "intent": intent,
        "data": data,
    }
    if state.get("entry_date"):
        payload["entryDate"] = state["entry_date"]

    if intent == "log_food_multi":
        payload.update(
            {
                "meal_type": data.get("meal_type"),
                "items": data.get("items") or [],
                "total": data.get("total") or {},
                "needs_user_confirmation": data.get("needs_user_confirmation", True),
            }
        )

    return {**state, "response_payload": payload}


def _infer_intent(data: dict[str, Any]) -> str:
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
