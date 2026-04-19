from app.agent.state import AgentState


async def response_formatter_node(state: AgentState) -> AgentState:
    intent = state.get("detected_intent") or "chat"
    data = state.get("structured_data") or {}
    payload = {
        "success": True,
        "response": state.get("ai_response") or "",
        "intent": intent,
        "data": data,
    }
    if state.get("entry_date"):
        payload["entryDate"] = state["entry_date"]
    if state.get("profile_update"):
        payload["profile_update"] = state["profile_update"]

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

