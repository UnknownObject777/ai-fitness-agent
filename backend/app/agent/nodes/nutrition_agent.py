import re
from typing import Any

from app.agent.state import AgentState


def _extract_number(pattern: str, text: str, default: float | None = None) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return float(match.group(1)) if match else default


async def nutrition_agent_node(state: AgentState) -> AgentState:
    text = state.get("user_message", "")
    meal_type = "meal"
    if "早餐" in text:
        meal_type = "breakfast"
    elif "午餐" in text:
        meal_type = "lunch"
    elif "晚餐" in text:
        meal_type = "dinner"
    elif "加餐" in text:
        meal_type = "snack"

    calories = _extract_number(r"(\d+(?:\.\d+)?)\s*(?:kcal|大卡|卡)", text, 0) or 0
    protein = _extract_number(r"蛋白(?:质)?\s*(\d+(?:\.\d+)?)", text, 0) or 0
    carbs = _extract_number(r"碳水\s*(\d+(?:\.\d+)?)", text, 0) or 0
    fat = _extract_number(r"脂肪\s*(\d+(?:\.\d+)?)", text, 0) or 0
    food_name = re.sub(r".*(吃了|吃|ate)\s*", "", text, flags=re.IGNORECASE).strip() or "food"

    data: dict[str, Any] = {
        "food_name": food_name[:40],
        "meal_type": meal_type,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
    }
    return {
        **state,
        "structured_data": data,
        "ai_response": "已整理成饮食记录；如果热量或宏量营养不确定，可以之后手动修正。",
    }

