import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.schemas import DomainResult
from app.agent.state import AgentState


def _extract_number(pattern: str, text: str, default: float | None = None) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return float(match.group(1)) if match else default


async def nutrition_agent_node(state: AgentState) -> AgentState:
    text = state.get("user_message", "")

    model = get_chat_model()
    if model is not None:
        try:
            result = await model.with_structured_output(DomainResult).ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Extract a food log. Respond in Chinese. "
                            "Use data keys food_name, meal_type, calories, protein, carbs, fat."
                        )
                    ),
                    HumanMessage(content=f"Memory:\n{state.get('memory_prompt', '')}\nMessage: {text}"),
                ]
            )
            if not result.data.get("food_name"):
                raise ValueError("structured nutrition data missing food_name")
            return {
                **state,
                "structured_data": result.data,
                "ai_response": result.response,
                "profile_update": result.profile_update,
                "entry_date": result.entry_date or state.get("entry_date"),
            }
        except Exception:
            pass

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
