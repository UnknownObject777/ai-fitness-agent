import json
from typing import Any
from uuid import uuid4

from app.models.procedural import ProceduralMemory
from app.services.db import connection


async def get_or_init_procedural_memory(user_id: str = "user_1") -> ProceduralMemory:
    async with connection() as db:
        cursor = await db.execute("SELECT memory_json FROM user_procedural_memory WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            return ProceduralMemory.model_validate(json.loads(row["memory_json"]))
        memory = ProceduralMemory(userId=user_id)
        await db.execute(
            """
            INSERT INTO user_procedural_memory (user_id, memory_json)
            VALUES (?, ?)
            """,
            (user_id, json.dumps(memory.model_dump(by_alias=True), ensure_ascii=False)),
        )
        await db.commit()
        return memory


async def save_procedural_memory(user_id: str, memory: ProceduralMemory) -> None:
    async with connection() as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO user_procedural_memory (user_id, memory_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            """,
            (user_id, json.dumps(memory.model_dump(by_alias=True), ensure_ascii=False)),
        )
        await db.commit()


async def record_feedback_signal(
    user_id: str,
    plan_id: str | None,
    signal: str,
    score: float,
    communication_style: str | None = None,
) -> dict[str, Any]:
    memory = await get_or_init_procedural_memory(user_id)
    if communication_style and score >= 0.7:
        memory.prompt_strategy.preferred_style = communication_style
        memory.prompt_strategy.confidence = min(0.95, max(memory.prompt_strategy.confidence, 0.6))
    memory.feedback_loop.append({"planId": plan_id, "signal": signal, "score": score})
    await save_procedural_memory(user_id, memory)

    signal_id = str(uuid4())
    async with connection() as db:
        await db.execute(
            """
            INSERT INTO feedback_signals (id, user_id, plan_id, signal, score, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                signal_id,
                user_id,
                plan_id,
                signal,
                score,
                json.dumps({"communicationStyle": communication_style}, ensure_ascii=False),
            ),
        )
        await db.commit()
    return {"id": signal_id, "userId": user_id, "signal": signal, "score": score}


async def retrieve_prompt_strategy(user_id: str) -> dict[str, Any]:
    memory = await get_or_init_procedural_memory(user_id)
    return memory.prompt_strategy.model_dump(by_alias=True)
