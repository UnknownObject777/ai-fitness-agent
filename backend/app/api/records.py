from fastapi import APIRouter, HTTPException

from app.models.chat import SaveRecordRequest, UpdateRecordRequest
from app.services.db import delete_activity_record, get_history, save_meal_log_multi, save_record, update_activity_record
from app.services.memory import (
    aggregate_weekly_stats,
    analyze_muscle_groups,
    get_or_init_semantic_memory,
    get_week_number,
    merge_weekly_stats,
    update_semantic_memory,
)


router = APIRouter()


@router.post("/save-record")
async def post_save_record(request: SaveRecordRequest):
    if request.intent == "log_food_multi":
        record = await save_meal_log_multi("user_1", request.data, "photo")
        return {"success": True, "record": record}

    record = await save_record(request.intent, request.data, request.entry_date)
    if request.intent != "log_strength_workout":
        return {"success": True, "record": record}

    muscle_analysis = analyze_muscle_groups(request.data)
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    week_id = f"{now.year}-W{get_week_number(now)}"
    weekly_stats = await aggregate_weekly_stats("user_1", week_id, [record])
    memory = await get_or_init_semantic_memory("user_1")
    memory.setdefault("weeklyTrainingStats", {})
    if week_id in memory["weeklyTrainingStats"]:
        merge_weekly_stats(memory["weeklyTrainingStats"][week_id], weekly_stats)
    else:
        memory["weeklyTrainingStats"][week_id] = weekly_stats
    await update_semantic_memory({"weeklyTrainingStats": memory["weeklyTrainingStats"]}, "user_1")
    return {"success": True, "record": record, "muscleAnalysis": muscle_analysis, "weeklyStats": weekly_stats}


@router.get("/logs")
async def get_logs():
    return await get_history()


@router.patch("/logs/{record_id}")
async def patch_log(record_id: str, request: UpdateRecordRequest):
    updates = request.model_dump(by_alias=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No valid updates provided")
    try:
        return {"success": True, "record": await update_activity_record(record_id, updates)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/logs/{record_id}")
async def delete_log(record_id: str):
    try:
        await delete_activity_record(record_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"success": True}

