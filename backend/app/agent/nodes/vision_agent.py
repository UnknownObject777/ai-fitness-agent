from app.agent.state import AgentState


async def vision_agent_node(state: AgentState) -> AgentState:
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

