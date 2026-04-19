import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.schemas import DomainResult
from app.agent.state import AgentState


def _number(pattern: str, text: str, default: float | None = None) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return float(match.group(1)) if match else default


def _parse_strength(text: str) -> dict[str, Any]:
    weight = _number(r"(\d+(?:\.\d+)?)\s*(?:kg|公斤)", text, 0) or 0
    sets_reps = re.search(r"(\d+)\s*[xX*×]\s*(\d+)", text)
    sets = int(sets_reps.group(1)) if sets_reps else int(_number(r"(\d+)\s*组", text, 3) or 3)
    reps = int(sets_reps.group(2)) if sets_reps else int(_number(r"(\d+)\s*(?:次|reps?)", text, 8) or 8)

    name = "Strength workout"
    exercise_name = "Exercise"
    for key, label in {
        "卧推": "卧推",
        "深蹲": "深蹲",
        "硬拉": "硬拉",
        "划船": "划船",
        "bench": "bench press",
        "squat": "squat",
        "deadlift": "deadlift",
        "row": "row",
    }.items():
        if key.lower() in text.lower():
            exercise_name = label
            name = f"{label} training"
            break

    return {
        "workout_name": name,
        "duration_minutes": int(_number(r"(\d+)\s*(?:分钟|min)", text, 45) or 45),
        "exercises": [
            {
                "name": exercise_name,
                "sets": [
                    {"weight": weight, "reps": reps, "rpe": None, "failure": False}
                    for _ in range(max(sets, 1))
                ],
            }
        ],
        "training_volume": {
            "total_sets": sets,
            "total_reps": sets * reps,
            "total_volume_load": weight * sets * reps,
        },
    }


async def workout_agent_node(state: AgentState) -> AgentState:
    intent = state.get("detected_intent", "log_exercise")
    text = state.get("user_message", "")

    model = get_chat_model()
    if model is not None:
        try:
            result = await model.with_structured_output(DomainResult).ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Extract structured fitness data for the requested intent. "
                            "Respond in Chinese. Keep data keys compatible with the existing frontend: "
                            "log_strength_workout uses workout_name, duration_minutes, exercises, training_volume; "
                            "log_exercise uses exercise_name and duration_minutes; "
                            "log_measurement uses measurements and metric fields."
                        )
                    ),
                    HumanMessage(content=f"Intent: {intent}\nMemory:\n{state.get('memory_prompt', '')}\nMessage: {text}"),
                ]
            )
            if intent == "log_strength_workout" and not result.data.get("exercises"):
                raise ValueError("structured workout data missing exercises")
            if intent == "log_exercise" and not result.data.get("exercise_name"):
                raise ValueError("structured exercise data missing exercise_name")
            return {
                **state,
                "structured_data": result.data,
                "ai_response": result.response,
                "profile_update": result.profile_update,
                "entry_date": result.entry_date or state.get("entry_date"),
            }
        except Exception:
            pass

    if intent == "log_strength_workout":
        data = _parse_strength(text)
        response = "已整理成力量训练记录，保存前可以再核对重量、组数和次数。"
    elif intent == "log_measurement":
        weight = _number(r"(\d+(?:\.\d+)?)\s*(?:kg|公斤)", text)
        body_fat = _number(r"体脂\s*(\d+(?:\.\d+)?)", text)
        data = {"measurements": [], "weight_kg": weight, "body_fat_pct": body_fat}
        if weight is not None:
            data["measurements"].append({"metric": "weight", "value": weight, "unit": "kg"})
        response = "已提取体测数据，建议在同一时间段持续记录，趋势会更可靠。"
    else:
        duration = int(_number(r"(\d+)\s*(?:分钟|min)", text, 30) or 30)
        data = {
            "exercise_name": "有氧运动" if "跑" not in text else "跑步",
            "duration_minutes": duration,
        }
        response = "已整理成运动记录，继续保持这个节奏。"

    return {**state, "structured_data": data, "ai_response": response}
