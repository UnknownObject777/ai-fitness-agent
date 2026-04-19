from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.schemas import DomainResult
from app.agent.state import AgentState


async def vision_agent_node(state: AgentState) -> AgentState:
    model = get_chat_model()
    if model is not None and state.get("base64_image"):
        try:
            result = await model.with_structured_output(DomainResult).ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Identify foods from the image and return data with meal_type, items, total, "
                            "needs_user_confirmation. Each item should include name, estimated_grams, "
                            "confidence, nutrition_estimate, candidate_foods. Respond in Chinese."
                        )
                    ),
                    HumanMessage(
                        content=[
                            {"type": "text", "text": state.get("user_message") or "识别这张图片中的食物"},
                            {"type": "image_url", "image_url": {"url": state["base64_image"]}},
                        ]
                    ),
                ]
            )
            return {
                **state,
                "structured_data": result.data,
                "ai_response": result.response,
                "profile_update": result.profile_update,
                "entry_date": result.entry_date or state.get("entry_date"),
            }
        except Exception:
            pass

    data = {
        "meal_type": "unknown",
        "items": [
            {
                "name": "待确认食物",
                "estimated_grams": 100,
                "confidence": 0.5,
                "nutrition_estimate": {"kcal": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0},
                "candidate_foods": [],
            }
        ],
        "total": {"kcal": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0},
        "needs_user_confirmation": True,
    }
    return {
        **state,
        "structured_data": data,
        "ai_response": "我已收到图片，但当前本地兜底模式无法精确识别食物，请确认后再记录。",
    }
