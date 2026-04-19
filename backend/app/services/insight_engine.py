from typing import Any


def generate_workout_insights(data: dict[str, Any]) -> list[dict[str, Any]]:
    summary = data.get("summary") or {}
    insights: list[dict[str, Any]] = []
    total_workouts = summary.get("totalWorkouts") or 0
    if total_workouts == 0:
        insights.append({"type": "warning", "title": "训练记录不足", "message": "最近还没有训练记录，可以先从一次轻量训练开始。"})
    elif summary.get("avgWorkoutsPerWeek", 0) >= 3:
        insights.append({"type": "positive", "title": "训练频率稳定", "message": "最近训练频率不错，注意恢复和渐进加量。"})
    if summary.get("mostTrainedGroup") not in {None, "-"}:
        insights.append(
            {
                "type": "info",
                "title": "主要训练部位",
                "message": f"最近主要训练 {summary['mostTrainedGroup']}，可以检查是否需要补足薄弱肌群。",
            }
        )
    return insights


def generate_nutrition_insights(data: dict[str, Any]) -> list[dict[str, Any]]:
    summary = data.get("summary") or {}
    goal = data.get("goalComparison") or {}
    insights: list[dict[str, Any]] = []
    if summary.get("daysLogged", 0) == 0:
        insights.append({"type": "warning", "title": "饮食记录不足", "message": "记录一两餐就能开始看到热量和蛋白质趋势。"})
    if goal.get("proteinAdequacy") == "low":
        insights.append({"type": "warning", "title": "蛋白质偏低", "message": "当前平均蛋白质低于目标，优先补足每餐优质蛋白。"})
    elif goal.get("proteinAdequacy") == "adequate":
        insights.append({"type": "positive", "title": "蛋白质达标", "message": "蛋白质摄入接近目标，有助于恢复和维持肌肉。"})
    if summary.get("calorieConsistencyScore", 0) >= 75:
        insights.append({"type": "positive", "title": "热量稳定", "message": "热量波动较小，对体重趋势判断很有帮助。"})
    return insights


def generate_combined_insights(workout_data: dict[str, Any], nutrition_data: dict[str, Any]) -> list[dict[str, Any]]:
    return [*generate_workout_insights(workout_data), *generate_nutrition_insights(nutrition_data)]

