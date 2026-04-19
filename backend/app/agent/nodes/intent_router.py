import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.schemas import IntentResult
from app.agent.state import AgentState


def _date_hint(text: str) -> str | None:
    lowered = text.lower()
    if "昨天" in text or "yesterday" in lowered:
        return "yesterday"
    if "今天" in text or "today" in lowered:
        return "today"
    match = re.search(r"\b(20\d{2}-\d{1,2}-\d{1,2})\b", text)
    return match.group(1) if match else None


async def intent_router_node(state: AgentState) -> AgentState:
    text = state.get("user_message", "")
    lowered = text.lower()

    model = get_chat_model()
    if model is not None:
        try:
            structured = model.with_structured_output(IntentResult)
            result = await structured.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Classify the user message into one Sparky intent. "
                            "Use log_food_multi when an image is present. "
                            "Return entryDate as today, yesterday, YYYY-MM-DD, or null."
                        )
                    ),
                    HumanMessage(
                        content=f"Image present: {bool(state.get('base64_image'))}\nMessage: {text}"
                    ),
                ]
            )
            return {
                **state,
                "detected_intent": result.intent,
                "intent_confidence": result.confidence,
                "entry_date": result.entry_date or _date_hint(text),
            }
        except Exception:
            pass

    if state.get("base64_image"):
        intent = "log_food_multi"
        confidence = 0.95
    elif any(token in text for token in ["计划", "安排", "训练方案"]) or "plan" in lowered:
        intent = "update_workout_plan" if any(token in text for token in ["调整", "修改", "更新"]) else "generate_workout_plan"
        confidence = 0.82
    elif any(token in lowered for token in ["bench", "squat", "deadlift", "press", "row"]) or any(
        token in text for token in ["卧推", "深蹲", "硬拉", "划船", "力量", "组"]
    ):
        intent = "log_strength_workout"
        confidence = 0.82
    elif any(token in text for token in ["跑步", "骑车", "游泳", "有氧", "运动"]) or any(
        token in lowered for token in ["run", "cardio", "swim"]
    ):
        intent = "log_exercise"
        confidence = 0.78
    elif any(token in text for token in ["吃", "早餐", "午餐", "晚餐", "加餐"]) or any(
        token in lowered for token in ["eat", "food", "meal", "kcal", "calorie"]
    ):
        intent = "log_food"
        confidence = 0.78
    elif any(token in text for token in ["体重", "体脂", "腰围", "胸围"]) or any(
        token in lowered for token in ["weight", "body fat", "waist"]
    ):
        intent = "log_measurement"
        confidence = 0.78
    else:
        intent = "chat"
        confidence = 0.5

    return {
        **state,
        "detected_intent": intent,
        "intent_confidence": confidence,
        "entry_date": _date_hint(text),
    }


def route_by_intent(state: AgentState) -> str:
    intent = state.get("detected_intent", "chat")
    if intent in {"log_strength_workout", "log_exercise", "log_measurement"}:
        return "workout"
    if intent == "log_food_multi":
        return "vision"
    if intent == "log_food":
        return "nutrition"
    if intent in {"generate_workout_plan", "update_workout_plan"}:
        return "planner"
    return "chat"
