"""
Sparky Agent 工具集定义

所有工具均使用 @tool 装饰器注册，供 Supervisor Agent 通过 bind_tools 调用。

工具清单：
  - extract_workout_data    从文本提取力量训练/有氧/体测结构化数据
  - extract_nutrition_data  从文本提取饮食记录结构化数据
  - extract_plan_data       提取或更新训练计划
  - analyze_food_image      分析食物图片并估算营养
  - save_record             将提取的数据持久化到 SQLite
  - query_history           查询用户近期活动历史
  - get_user_profile        获取用户语义记忆/健身档案
  - update_user_profile     更新用户目标、弱项、伤病史等

兜底策略：
  每个提取工具在 LLM 结构化输出失败时，都会回退到基于正则的本地解析，
  确保即使模型不可用也能返回可用的基础数据。
"""

import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.agent.llm import get_chat_model
from app.agent.schemas import (
    DomainResult,
    ExtractNutritionInput,
    ExtractPlanInput,
    ExtractWorkoutInput,
    QueryHistoryInput,
    SaveRecordInput,
    UpdateProfileInput,
)
from app.services.db import get_history, save_record as db_save_record
from app.services.memory import (
    get_or_init_semantic_memory,
    update_semantic_memory,
)


# ---- 本地兜底解析辅助函数（继承自旧版 Domain Agent） ----

def _number(pattern: str, text: str, default: float | None = None) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    return float(match.group(1)) if match else default


def _normalize_strength_data(data: dict[str, Any]) -> dict[str, Any]:
    """规范化力量训练数据，统一 sets 为列表格式并补全训练容量统计。"""
    exercises = data.get("exercises") if isinstance(data.get("exercises"), list) else []
    normalized = []
    total_sets = 0
    total_reps = 0
    total_volume = 0.0

    for exercise in exercises:
        if not isinstance(exercise, dict):
            continue
        next_exercise = dict(exercise)
        raw_sets = next_exercise.get("sets")
        reps = int(next_exercise.get("reps") or 8)
        weight = float(next_exercise.get("weight_kg") or next_exercise.get("weight") or 0)

        if isinstance(raw_sets, list):
            sets = [item for item in raw_sets if isinstance(item, dict)]
        else:
            set_count = int(raw_sets or next_exercise.get("set_count") or 1)
            sets = [
                {"weight": weight, "reps": reps, "rpe": next_exercise.get("rpe"), "failure": False}
                for _ in range(set_count)
            ]

        next_exercise["sets"] = sets
        if "name" not in next_exercise and next_exercise.get("exercise_name"):
            next_exercise["name"] = next_exercise["exercise_name"]
        normalized.append(next_exercise)

        for item in sets:
            item_weight = float(item.get("weight") or item.get("weight_kg") or weight or 0)
            item_reps = int(item.get("reps") or reps or 0)
            total_sets += 1
            total_reps += item_reps
            total_volume += item_weight * item_reps

    data["exercises"] = normalized
    if not isinstance(data.get("training_volume"), dict):
        data["training_volume"] = {}
    data["training_volume"].setdefault("total_sets", total_sets)
    data["training_volume"].setdefault("total_reps", total_reps)
    data["training_volume"].setdefault("total_volume_load", total_volume)
    data.setdefault("duration_minutes", 45)
    data.setdefault("workout_name", "Strength workout")
    return data


def _fallback_workout(intent: str, text: str) -> dict[str, Any]:
    """LLM 不可用时的本地力量训练/有氧/体测解析兜底。"""
    if intent == "log_strength_workout":
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

    if intent == "log_measurement":
        weight = _number(r"(\d+(?:\.\d+)?)\s*(?:kg|公斤)", text)
        body_fat = _number(r"体脂\s*(\d+(?:\.\d+)?)", text)
        data: dict[str, Any] = {"measurements": [], "weight_kg": weight, "body_fat_pct": body_fat}
        if weight is not None:
            data["measurements"].append({"metric": "weight", "value": weight, "unit": "kg"})
        return data

    duration = int(_number(r"(\d+)\s*(?:分钟|min)", text, 30) or 30)
    return {
        "exercise_name": "有氧运动" if "跑" not in text else "跑步",
        "duration_minutes": duration,
    }


def _fallback_nutrition(text: str) -> dict[str, Any]:
    """LLM 不可用时的本地饮食解析兜底。"""
    meal_type = "meal"
    if "早餐" in text:
        meal_type = "breakfast"
    elif "午餐" in text:
        meal_type = "lunch"
    elif "晚餐" in text:
        meal_type = "dinner"
    elif "加餐" in text:
        meal_type = "snack"

    calories = _number(r"(\d+(?:\.\d+)?)\s*(?:kcal|大卡|卡)", text, 0) or 0
    protein = _number(r"蛋白(?:质)?\s*(\d+(?:\.\d+)?)", text, 0) or 0
    carbs = _number(r"碳水\s*(\d+(?:\.\d+)?)", text, 0) or 0
    fat = _number(r"脂肪\s*(\d+(?:\.\d+)?)", text, 0) or 0
    food_name = re.sub(r".*(吃了|吃|ate)\s*", "", text, flags=re.IGNORECASE).strip() or "food"

    return {
        "food_name": food_name[:40],
        "meal_type": meal_type,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
    }


def _fallback_plan() -> dict[str, Any]:
    """LLM 不可用时的默认训练计划兜底。"""
    return {
        "plan_metadata": {
            "goal_orientation": "general_fitness",
            "total_weeks": 4,
            "start_phase": "base_building",
            "rationale": "Based on the current request and recent training context.",
        },
        "weekly_templates": [
            {
                "week_number": 1,
                "sessions": [
                    {
                        "session_id": "A",
                        "focus": "Lower body strength + core",
                        "exercises": [
                            {"name": "Squat", "sets": 3, "reps": 8, "rpe": 7, "notes": "Leave 2 reps in reserve"}
                        ],
                    },
                    {
                        "session_id": "B",
                        "focus": "Upper body push/pull",
                        "exercises": [
                            {"name": "Bench press", "sets": 3, "reps": 8, "rpe": 7, "notes": "Controlled tempo"}
                        ],
                    },
                ],
            }
        ],
    }


def _fallback_vision() -> dict[str, Any]:
    """LLM 不可用时的食物图片分析兜底。"""
    return {
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


# ---- 工具定义（供 Supervisor Agent bind_tools 使用） ----

@tool(args_schema=ExtractWorkoutInput)
async def extract_workout_data(intent: str, user_message: str) -> dict[str, Any]:
    """从用户消息中提取结构化的训练/运动/体测数据。适用于力量训练、有氧、体测等意图。"""
    model = get_chat_model()
    if model is not None:
        try:
            structured = model.with_structured_output(DomainResult)
            result = await structured.ainvoke(
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
                    HumanMessage(content=f"Intent: {intent}\nMessage: {user_message}"),
                ]
            )
            data = result.data
            if intent == "log_strength_workout":
                data = _normalize_strength_data(data)
            if intent == "log_strength_workout" and not data.get("exercises"):
                raise ValueError("structured workout data missing exercises")
            if intent == "log_exercise" and not data.get("exercise_name"):
                raise ValueError("structured exercise data missing exercise_name")
            return {"data": data, "response": result.response, "entry_date": result.entry_date}
        except Exception:
            pass

    return {"data": _fallback_workout(intent, user_message), "response": "已整理成运动记录，继续保持这个节奏。", "entry_date": None}


@tool(args_schema=ExtractNutritionInput)
async def extract_nutrition_data(user_message: str) -> dict[str, Any]:
    """从用户消息中提取饮食记录结构化数据（食物名、餐别、热量、宏量营养）。"""
    model = get_chat_model()
    if model is not None:
        try:
            structured = model.with_structured_output(DomainResult)
            result = await structured.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Extract a food log. Respond in Chinese. "
                            "Use data keys food_name, meal_type, calories, protein, carbs, fat."
                        )
                    ),
                    HumanMessage(content=f"Message: {user_message}"),
                ]
            )
            if not result.data.get("food_name"):
                raise ValueError("structured nutrition data missing food_name")
            return {"data": result.data, "response": result.response, "entry_date": result.entry_date}
        except Exception:
            pass

    return {"data": _fallback_nutrition(user_message), "response": "已整理成饮食记录；如果热量或宏量营养不确定，可以之后手动修正。", "entry_date": None}


@tool(args_schema=ExtractPlanInput)
async def extract_plan_data(intent: str, user_message: str) -> dict[str, Any]:
    """提取或更新训练计划，返回 plan_metadata 和 weekly_templates。"""
    model = get_chat_model()
    if model is not None:
        try:
            structured = model.with_structured_output(DomainResult)
            result = await structured.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Create or update a workout plan. Respond in Chinese. "
                            "Use data keys plan_metadata and weekly_templates, with sessions and exercises."
                        )
                    ),
                    HumanMessage(content=f"Intent: {intent}\nMessage: {user_message}"),
                ]
            )
            if not result.data.get("weekly_templates"):
                raise ValueError("structured plan data missing weekly_templates")
            return {"data": result.data, "response": result.response, "entry_date": result.entry_date}
        except Exception:
            pass

    return {"data": _fallback_plan(), "response": "先给你一个稳妥的 4 周训练框架，后续可以按恢复和器械条件继续细化。", "entry_date": None}


async def _analyze_food_image_internal(user_message: str, base64_image: str | None) -> dict[str, Any]:
    """内部实现：调用多模态 LLM 分析食物图片（不直接暴露为独立工具）。"""
    model = get_chat_model()
    if model is not None and base64_image:
        try:
            structured = model.with_structured_output(DomainResult)
            result = await structured.ainvoke(
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
                            {"type": "text", "text": user_message or "识别这张图片中的食物"},
                            {"type": "image_url", "image_url": {"url": base64_image}},
                        ]
                    ),
                ]
            )
            if not result.data.get("items") or not result.data.get("total"):
                raise ValueError("structured vision data missing items or total")
            return {"data": result.data, "response": result.response, "entry_date": result.entry_date}
        except Exception:
            pass

    return {
        "data": _fallback_vision(),
        "response": "我已收到图片，但当前本地兜底模式无法精确识别食物，请确认后再记录。",
        "entry_date": None,
    }


@tool(args_schema=SaveRecordInput)
async def save_record(intent: str, data: dict[str, Any], entry_date: str | None = None) -> dict[str, Any]:
    """将提取的数据持久化保存到 SQLite 数据库。应在 extract_* 之后调用。"""
    record = await db_save_record(intent, data, entry_date)
    return {"saved": True, "record_id": record.get("id"), "intent": intent}


@tool
async def analyze_food_image(image_url: str, user_message: str = "识别这张图片中的食物") -> dict[str, Any]:
    """分析用户上传的食物图片，返回识别出的食物列表和估算营养。"""
    model = get_chat_model()
    if model is not None and image_url:
        try:
            structured = model.with_structured_output(DomainResult)
            result = await structured.ainvoke(
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
                            {"type": "text", "text": user_message},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ]
                    ),
                ]
            )
            if not result.data.get("items") or not result.data.get("total"):
                raise ValueError("structured vision data missing items or total")
            return {"data": result.data, "response": result.response, "entry_date": result.entry_date}
        except Exception:
            pass

    return {
        "data": _fallback_vision(),
        "response": "我已收到图片，但当前本地兜底模式无法精确识别食物，请确认后再记录。",
        "entry_date": None,
    }


@tool(args_schema=QueryHistoryInput)
async def query_history(
    intent_filter: str | None = None, days: int = 7, limit: int = 20
) -> list[dict[str, Any]]:
    """查询用户最近的活动历史。可用于回答"我上周练了什么"这类问题。"""
    cutoff = datetime.now(UTC) - timedelta(days=days)
    history = await get_history(limit=max(limit, 100))
    filtered = [
        h
        for h in history
        if h.get("timestamp", "") >= cutoff.isoformat()
        and (intent_filter is None or h.get("intent") == intent_filter)
    ]
    return filtered[:limit]


@tool
async def get_user_profile() -> dict[str, Any]:
    """获取用户的语义记忆（长期健身档案），包括目标、弱项、伤病史等。"""
    return await get_or_init_semantic_memory()


@tool(args_schema=UpdateProfileInput)
async def update_user_profile(
    goals: list[str] | None = None,
    weak_points: list[str] | None = None,
    injury_history: list[str] | None = None,
    preferred_style: str | None = None,
    weekly_training_stats: dict[str, Any] | None = None,
    strength_model: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """更新用户的健身档案。仅传入发生变化的字段即可。"""
    updates: dict[str, Any] = {}
    if goals is not None:
        updates["goals"] = goals
    if weak_points is not None:
        updates["weakPoints"] = weak_points
    if injury_history is not None:
        updates["injuryHistory"] = injury_history
    if preferred_style is not None:
        updates["preferredStyle"] = preferred_style
    if weekly_training_stats is not None:
        updates["weeklyTrainingStats"] = weekly_training_stats
    if strength_model is not None:
        updates["strengthModel"] = strength_model

    if updates:
        return await update_semantic_memory(updates)
    return await get_or_init_semantic_memory()


# 工具注册表：供 Supervisor 和 Tool Executor 统一索引
TOOLS = [
    extract_workout_data,
    extract_nutrition_data,
    extract_plan_data,
    analyze_food_image,
    save_record,
    query_history,
    get_user_profile,
    update_user_profile,
]

TOOLS_BY_NAME = {t.name: t for t in TOOLS}
