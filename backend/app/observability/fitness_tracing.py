import json
from typing import Any
from uuid import uuid4

from app.services.db import connection


class FitnessSpanTracer:
    async def start_span(self, span_type: str, metadata: dict[str, Any]) -> str:
        span_id = str(uuid4())
        async with connection() as db:
            await db.execute(
                """
                INSERT INTO observation_events (id, span_type, event_type, metadata_json)
                VALUES (?, ?, ?, ?)
                """,
                (span_id, span_type, "span_started", json.dumps(metadata, ensure_ascii=False)),
            )
            await db.commit()
        return span_id

    async def end_span(self, span_id: str, metadata: dict[str, Any]) -> None:
        async with connection() as db:
            await db.execute(
                """
                UPDATE observation_events
                SET event_type = ?, metadata_json = ?, ended_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                ("span_ended", json.dumps(metadata, ensure_ascii=False), span_id),
            )
            await db.commit()

    async def record_biometric_warning(
        self,
        user_id: str,
        metric: str,
        value: float,
        threshold: float,
    ) -> dict[str, Any]:
        event_id = str(uuid4())
        metadata = {"userId": user_id, "metric": metric, "value": value, "threshold": threshold}
        async with connection() as db:
            await db.execute(
                """
                INSERT INTO observation_events (id, span_type, event_type, metadata_json)
                VALUES (?, ?, ?, ?)
                """,
                (event_id, "body_metrics", "fitness_metrics_warning", json.dumps(metadata, ensure_ascii=False)),
            )
            await db.commit()
        return {"id": event_id, "eventType": "fitness_metrics_warning", "metadata": metadata}


async def list_observation_events(limit: int = 20) -> list[dict[str, Any]]:
    async with connection() as db:
        cursor = await db.execute(
            """
            SELECT *
            FROM observation_events
            ORDER BY started_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "spanType": row["span_type"],
            "eventType": row["event_type"],
            "metadata": json.loads(row["metadata_json"]),
            "startedAt": row["started_at"],
            "endedAt": row["ended_at"],
        }
        for row in rows
    ]
