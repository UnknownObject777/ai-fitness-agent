import json
from typing import Any
from uuid import uuid4

from app.services.db import connection


async def record_workout_with_sets(
    user_id: str,
    started_at: str,
    workout_type: str,
    exercises: list[dict[str, Any]],
) -> dict[str, Any]:
    workout_id = str(uuid4())
    payload = {"exercises": exercises}
    async with connection() as db:
        await db.execute(
            """
            INSERT INTO workout_session_records (id, user_id, started_at, workout_type, raw_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (workout_id, user_id, started_at, workout_type, json.dumps(payload, ensure_ascii=False)),
        )
        for exercise in exercises:
            exercise_name = str(exercise.get("exerciseName") or exercise.get("name") or "unknown")
            for index, set_item in enumerate(exercise.get("sets") or [], start=1):
                await db.execute(
                    """
                    INSERT INTO set_records
                      (id, workout_record_id, user_id, exercise_name, set_number, weight_kg, reps, rpe, completed, raw_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid4()),
                        workout_id,
                        user_id,
                        exercise_name,
                        int(set_item.get("setNumber") or index),
                        set_item.get("weightKg") or set_item.get("weight_kg") or set_item.get("weight"),
                        set_item.get("reps"),
                        set_item.get("rpe"),
                        1 if set_item.get("completed", True) else 0,
                        json.dumps(set_item, ensure_ascii=False),
                    ),
                )
        await db.commit()
    return {"id": workout_id, "userId": user_id, "startedAt": started_at, "workoutType": workout_type}


async def get_recent_set_records(
    user_id: str,
    exercise_name: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    where = "WHERE user_id = ?"
    params: list[Any] = [user_id]
    if exercise_name:
        where += " AND exercise_name = ?"
        params.append(exercise_name)
    params.append(limit)
    async with connection() as db:
        cursor = await db.execute(
            f"""
            SELECT *
            FROM set_records
            {where}
            ORDER BY created_at DESC, set_number DESC
            LIMIT ?
            """,
            tuple(params),
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "workoutRecordId": row["workout_record_id"],
            "exerciseName": row["exercise_name"],
            "setNumber": row["set_number"],
            "weightKg": row["weight_kg"],
            "reps": row["reps"],
            "rpe": row["rpe"],
            "completed": bool(row["completed"]),
        }
        for row in rows
    ]


async def record_injury_event(
    user_id: str,
    occurred_at: str,
    body_region: str,
    severity: float,
    note: str,
) -> dict[str, Any]:
    event_id = str(uuid4())
    payload = {"bodyRegion": body_region, "severity": severity, "note": note}
    async with connection() as db:
        await db.execute(
            """
            INSERT INTO injury_events (id, user_id, occurred_at, body_region, severity, note, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (event_id, user_id, occurred_at, body_region, severity, note, json.dumps(payload, ensure_ascii=False)),
        )
        await db.commit()
    return {"id": event_id, "userId": user_id, "bodyRegion": body_region, "severity": severity, "note": note}


async def get_high_priority_injury_events(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    async with connection() as db:
        cursor = await db.execute(
            """
            SELECT *
            FROM injury_events
            WHERE user_id = ?
            ORDER BY severity DESC, occurred_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "occurredAt": row["occurred_at"],
            "bodyRegion": row["body_region"],
            "severity": row["severity"],
            "note": row["note"],
        }
        for row in rows
    ]
