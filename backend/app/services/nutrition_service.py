import json
from datetime import UTC, datetime, timedelta
from math import sqrt
from typing import Any

from app.services.db import connection
from app.services.training_analytics import get_days_back


def _safe_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


async def get_nutrition_analysis(user_id: str = "user_1", range_value: str = "30d") -> dict[str, Any]:
    days = get_days_back(range_value)
    since = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()

    async with connection() as db:
        meal_cursor = await db.execute(
            """
            SELECT DATE(eaten_at) as date,
                   SUM(total_kcal) as kcal,
                   SUM(total_protein_g) as protein,
                   SUM(total_carb_g) as carb,
                   SUM(total_fat_g) as fat,
                   COUNT(*) as meals
            FROM meal_logs
            WHERE user_id = ? AND DATE(eaten_at) >= ?
            GROUP BY DATE(eaten_at)
            ORDER BY date ASC
            """,
            (user_id, since),
        )
        meal_rows = await meal_cursor.fetchall()
        food_cursor = await db.execute(
            """
            SELECT entry_date, data_json
            FROM activity_records
            WHERE user_id = ? AND intent = 'log_food' AND entry_date >= ?
            ORDER BY entry_date ASC
            """,
            (user_id, since),
        )
        food_rows = await food_cursor.fetchall()

    daily_map: dict[str, dict[str, Any]] = {}
    for row in meal_rows:
        daily_map[row["date"]] = {
            "date": row["date"],
            "totalKcal": row["kcal"] or 0,
            "proteinG": row["protein"] or 0,
            "carbG": row["carb"] or 0,
            "fatG": row["fat"] or 0,
            "mealCount": row["meals"] or 0,
        }

    for row in food_rows:
        data = _safe_json(row["data_json"])
        entry = daily_map.setdefault(
            row["entry_date"],
            {"date": row["entry_date"], "totalKcal": 0, "proteinG": 0, "carbG": 0, "fatG": 0, "mealCount": 0},
        )
        if data.get("calories"):
            entry["totalKcal"] += data.get("calories") or 0
            entry["proteinG"] += data.get("protein") or 0
            entry["carbG"] += data.get("carbs") or 0
            entry["fatG"] += data.get("fat") or 0
            entry["mealCount"] += 1

    daily_data = sorted(daily_map.values(), key=lambda item: item["date"])
    days_logged = len(daily_data)
    total_kcal = sum(item["totalKcal"] for item in daily_data)
    total_protein = sum(item["proteinG"] for item in daily_data)
    total_carb = sum(item["carbG"] for item in daily_data)
    total_fat = sum(item["fatG"] for item in daily_data)
    avg_kcal = round(total_kcal / days_logged) if days_logged else 0
    avg_protein = round(total_protein / days_logged) if days_logged else 0
    avg_carb = round(total_carb / days_logged) if days_logged else 0
    avg_fat = round(total_fat / days_logged) if days_logged else 0

    macro_kcal = total_protein * 4 + total_carb * 4 + total_fat * 9
    macro_distribution = {
        "proteinPct": round((total_protein * 4 / macro_kcal) * 100) if macro_kcal else 0,
        "carbPct": round((total_carb * 4 / macro_kcal) * 100) if macro_kcal else 0,
        "fatPct": round((total_fat * 9 / macro_kcal) * 100) if macro_kcal else 0,
        "avgProteinG": avg_protein,
        "avgCarbG": avg_carb,
        "avgFatG": avg_fat,
    }

    consistency_score = 0
    if days_logged >= 3 and avg_kcal:
        variance = sum((item["totalKcal"] - avg_kcal) ** 2 for item in daily_data) / days_logged
        cv = sqrt(variance) / avg_kcal
        consistency_score = round(max(0, min(100, (1 - cv) * 100)))

    streak_days = 0
    date_set = {item["date"] for item in daily_data}
    checking = datetime.now(UTC).date()
    while checking.isoformat() in date_set:
        streak_days += 1
        checking -= timedelta(days=1)

    target_kcal = 2000
    target_protein = round(70 * 1.8)
    protein_goal_pct = round((avg_protein / target_protein) * 100) if target_protein else 0
    protein_adequacy = "adequate" if 90 <= protein_goal_pct <= 130 else ("high" if protein_goal_pct > 130 else "low")

    return {
        "dailyData": daily_data,
        "macroDistribution": macro_distribution,
        "summary": {
            "avgDailyKcal": avg_kcal,
            "avgProteinG": avg_protein,
            "daysLogged": days_logged,
            "proteinGoalPct": protein_goal_pct,
            "calorieConsistencyScore": consistency_score,
            "streakDays": streak_days,
        },
        "goalComparison": {
            "targetKcal": target_kcal,
            "avgKcal": avg_kcal,
            "deficitOrSurplus": avg_kcal - target_kcal,
            "targetProteinG": target_protein,
            "avgProteinG": avg_protein,
            "proteinAdequacy": protein_adequacy,
        },
    }

