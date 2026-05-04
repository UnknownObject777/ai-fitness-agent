from typing import Any

from app.agent.tools.registry import FitnessToolSpec


async def exercise_library_handler(args: dict[str, Any]) -> dict[str, Any]:
    target_muscles = args.get("target_muscles") or []
    equipment = args.get("equipment") or []
    return {
        "exercises": [
            {
                "name": "bench press" if "chest" in target_muscles else "goblet squat",
                "targetMuscles": target_muscles,
                "equipment": equipment,
                "coachingCues": ["controlled eccentric", "stop with two reps in reserve"],
            }
        ]
    }


async def injury_risk_assessor_handler(args: dict[str, Any]) -> dict[str, Any]:
    profile = args.get("user_profile") or {}
    plan = args.get("plan") or {}
    injuries = str(profile.get("injuryHistory") or profile.get("injury_history") or "").lower()
    plan_text = str(plan).lower()
    score = 0.75 if "shoulder" in injuries and "press" in plan_text else 0.2
    return {
        "score": score,
        "riskLevel": "high" if score > 0.6 else "low",
        "alternatives": ["landmine press", "band external rotation"] if score > 0.6 else [],
    }


async def recovery_advisor_handler(args: dict[str, Any]) -> dict[str, Any]:
    hrv_trend = str(args.get("hrv_trend") or "unknown")
    sleep_score = float(args.get("sleep_score") or 70)
    readiness = 0.45 if hrv_trend == "down" or sleep_score < 60 else 0.8
    return {"readinessScore": readiness, "recommendation": "reduce_intensity" if readiness < 0.6 else "train_as_planned"}


async def competition_planner_handler(args: dict[str, Any]) -> dict[str, Any]:
    event_date = args.get("event_date")
    return {
        "periodization": [
            {"phase": "hypertrophy", "weeks": 4},
            {"phase": "strength", "weeks": 4},
            {"phase": "peak", "weeks": 2},
        ],
        "eventDate": event_date,
    }


CORE_FITNESS_TOOLS = [
    FitnessToolSpec(
        name="exercise_library",
        description="Return executable exercises and coaching cues for target muscles and equipment.",
        parameters={
            "type": "object",
            "properties": {
                "target_muscles": {"type": "array", "items": {"type": "string"}},
                "equipment": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["target_muscles"],
        },
        handler=exercise_library_handler,
    ),
    FitnessToolSpec(
        name="injury_risk_assessor",
        description="Assess injury risk from user profile, fatigue, and proposed plan intensity.",
        parameters={
            "type": "object",
            "properties": {
                "user_profile": {"type": "object"},
                "plan": {"type": "object"},
            },
            "required": ["user_profile", "plan"],
        },
        handler=injury_risk_assessor_handler,
    ),
    FitnessToolSpec(
        name="recovery_advisor",
        description="Assess recovery from HRV, sleep, soreness, and fatigue signals.",
        parameters={
            "type": "object",
            "properties": {
                "hrv_trend": {"type": "string"},
                "sleep_score": {"type": "number"},
            },
            "required": [],
        },
        handler=recovery_advisor_handler,
    ),
    FitnessToolSpec(
        name="competition_planner",
        description="Build periodized phases for competition preparation.",
        parameters={
            "type": "object",
            "properties": {
                "event_date": {"type": "string"},
                "sport": {"type": "string"},
            },
            "required": ["event_date"],
        },
        handler=competition_planner_handler,
    ),
]
