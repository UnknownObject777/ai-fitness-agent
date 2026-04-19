import json
from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.db import connection


def estimate_one_rm(weight: float, reps: float) -> int:
    if reps == 1:
        return round(weight)
    return round(weight * (1 + reps / 30))


EXERCISE_MUSCLE_MAP = {
    "bench": "chest",
    "chest": "chest",
    "卧推": "胸部",
    "push-up": "chest",
    "pull-up": "back",
    "row": "back",
    "deadlift": "back",
    "划船": "背部",
    "硬拉": "背部",
    "squat": "legs",
    "lunge": "legs",
    "leg": "legs",
    "深蹲": "腿部",
    "press": "shoulders",
    "shoulder": "shoulders",
    "肩": "肩部",
    "curl": "arms",
    "tricep": "arms",
    "plank": "core",
    "crunch": "core",
}


def detect_muscle_group(exercise_name: str) -> str:
    lower = exercise_name.lower()
    for key, group in EXERCISE_MUSCLE_MAP.items():
        if key.lower() in lower:
            return group
    return "general"


def get_days_back(range_value: str) -> int:
    return {"7d": 7, "30d": 30, "90d": 90, "180d": 180}.get(range_value, 30)


def _safe_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


async def get_workout_trends(user_id: str = "user_1", range_value: str = "30d") -> dict[str, Any]:
    days = get_days_back(range_value)
    since = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()

    async with connection() as db:
        strength_cursor = await db.execute(
            """
            SELECT id, entry_date, timestamp, data_json
            FROM activity_records
            WHERE user_id = ? AND intent = 'log_strength_workout' AND entry_date >= ?
            ORDER BY entry_date ASC
            """,
            (user_id, since),
        )
        strength_rows = await strength_cursor.fetchall()
        cardio_cursor = await db.execute(
            """
            SELECT id, entry_date, timestamp, data_json
            FROM activity_records
            WHERE user_id = ? AND intent = 'log_exercise' AND entry_date >= ?
            ORDER BY entry_date ASC
            """,
            (user_id, since),
        )
        cardio_rows = await cardio_cursor.fetchall()

    day_map: dict[str, dict[str, Any]] = {}
    muscle_map: dict[str, dict[str, float]] = {}
    strength_progress_map: dict[str, list[dict[str, Any]]] = {}

    def ensure_day(date: str) -> dict[str, Any]:
        day_map.setdefault(
            date,
            {"date": date, "totalVolume": 0, "workoutCount": 0, "durationMin": 0, "avgRpe": None, "muscleGroups": []},
        )
        return day_map[date]

    for row in strength_rows:
        data = _safe_json(row["data_json"])
        day = ensure_day(row["entry_date"])
        day["workoutCount"] += 1
        day["durationMin"] += data.get("duration_minutes") or 0
        if isinstance(data.get("rpe"), (int, float)):
            day["avgRpe"] = data["rpe"] if day["avgRpe"] is None else (day["avgRpe"] + data["rpe"]) / 2

        workout_muscle = detect_muscle_group(data.get("workout_name") or "")
        exercises = data.get("exercises") if isinstance(data.get("exercises"), list) else []
        if not exercises:
            if workout_muscle not in day["muscleGroups"]:
                day["muscleGroups"].append(workout_muscle)
            muscle_map.setdefault(workout_muscle, {"volume": 0, "sessions": 0})["sessions"] += 1

        for exercise in exercises:
            if not isinstance(exercise, dict):
                continue
            name = exercise.get("exercise_name") or exercise.get("name") or ""
            muscle = detect_muscle_group(name) or workout_muscle
            if muscle not in day["muscleGroups"]:
                day["muscleGroups"].append(muscle)
            sets = exercise.get("sets") if isinstance(exercise.get("sets"), list) else []
            ex_volume = 0
            for item in sets:
                if not isinstance(item, dict):
                    continue
                weight = float(item.get("weight_kg") or item.get("weight") or 0)
                reps = float(item.get("reps") or 0)
                ex_volume += weight * reps
                if weight > 0 and reps > 0:
                    one_rm = estimate_one_rm(weight, reps)
                    entries = [entry for entry in strength_progress_map.get(name, []) if entry["date"] != row["entry_date"]]
                    day_best = next((entry for entry in strength_progress_map.get(name, []) if entry["date"] == row["entry_date"]), None)
                    if day_best is None or one_rm > day_best["oneRM"]:
                        entries.append({"date": row["entry_date"], "oneRM": one_rm, "weight": weight, "reps": reps})
                    strength_progress_map[name] = entries
            day["totalVolume"] += ex_volume
            muscle_entry = muscle_map.setdefault(muscle, {"volume": 0, "sessions": 0})
            muscle_entry["volume"] += ex_volume
            muscle_entry["sessions"] += 1

    for row in cardio_rows:
        data = _safe_json(row["data_json"])
        day = ensure_day(row["entry_date"])
        day["workoutCount"] += 1
        day["durationMin"] += data.get("duration_minutes") or 0
        if "cardio" not in day["muscleGroups"]:
            day["muscleGroups"].append("cardio")

    trend_points = sorted(day_map.values(), key=lambda item: item["date"])
    muscle_distribution = sorted(
        [{"group": group, **values} for group, values in muscle_map.items()],
        key=lambda item: item["volume"],
        reverse=True,
    )
    strength_progress = []
    for exercise, entries in strength_progress_map.items():
        for entry in sorted(entries, key=lambda item: item["date"]):
            strength_progress.append(
                {
                    "date": entry["date"],
                    "exercise": exercise,
                    "estimated1RM": entry["oneRM"],
                    "bestSet": {"weight": entry["weight"], "reps": entry["reps"]},
                }
            )

    total_volume = round(sum(point["totalVolume"] for point in trend_points))
    total_duration = sum(point["durationMin"] for point in trend_points)
    total_workouts = sum(point["workoutCount"] for point in trend_points)
    return {
        "trendPoints": trend_points,
        "muscleDistribution": muscle_distribution,
        "strengthProgress": strength_progress,
        "summary": {
            "totalWorkouts": total_workouts,
            "totalVolume": total_volume,
            "avgWorkoutsPerWeek": round((total_workouts / days) * 7, 1) if days else 0,
            "mostTrainedGroup": muscle_distribution[0]["group"] if muscle_distribution else "-",
            "totalDurationMin": total_duration,
        },
    }


async def get_body_metrics_trend(user_id: str = "user_1", range_value: str = "90d") -> list[dict[str, Any]]:
    days = get_days_back(range_value)
    since = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()
    async with connection() as db:
        cursor = await db.execute(
            """
            SELECT entry_date, data_json
            FROM activity_records
            WHERE user_id = ? AND intent = 'log_measurement' AND entry_date >= ?
            ORDER BY entry_date ASC
            """,
            (user_id, since),
        )
        rows = await cursor.fetchall()

    result = []
    for row in rows:
        data = _safe_json(row["data_json"])
        weight = data.get("weight_kg")
        if weight is None and isinstance(data.get("measurements"), list):
            weight = next((item.get("value") for item in data["measurements"] if item.get("metric") == "weight"), None)
        bmi = round(weight / (1.7**2), 1) if weight else None
        result.append(
            {
                "date": row["entry_date"],
                "weight_kg": weight,
                "body_fat_pct": data.get("body_fat_pct"),
                "waist_cm": data.get("waist_cm"),
                "bmi": bmi,
            }
        )
    return result

