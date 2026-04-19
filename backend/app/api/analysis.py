from fastapi import APIRouter

from app.services.insight_engine import (
    generate_combined_insights,
    generate_nutrition_insights,
    generate_workout_insights,
)
from app.services.nutrition_service import get_nutrition_analysis
from app.services.training_analytics import get_body_metrics_trend, get_workout_trends


router = APIRouter()


@router.get("/workout-trends")
async def workout_trends(range: str = "30d", userId: str = "user_1"):
    data = await get_workout_trends(userId, range)
    return {"success": True, "data": data, "insights": generate_workout_insights(data)}


@router.get("/nutrition")
async def nutrition(range: str = "30d", userId: str = "user_1"):
    data = await get_nutrition_analysis(userId, range)
    return {"success": True, "data": data, "insights": generate_nutrition_insights(data)}


@router.get("/body-metrics")
async def body_metrics(range: str = "90d", userId: str = "user_1"):
    return {"success": True, "data": await get_body_metrics_trend(userId, range)}


@router.get("/summary")
async def summary(range: str = "30d", userId: str = "user_1"):
    workout = await get_workout_trends(userId, range)
    nutrition_data = await get_nutrition_analysis(userId, range)
    body_data = await get_body_metrics_trend(userId, range)
    return {
        "success": True,
        "workout": workout,
        "nutrition": nutrition_data,
        "bodyMetrics": body_data,
        "insights": generate_combined_insights(workout, nutrition_data),
    }

