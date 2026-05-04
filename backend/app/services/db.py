import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import aiosqlite

from app.config import get_settings


DEFAULT_USER_ID = "user_1"


async def get_connection() -> aiosqlite.Connection:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(settings.database_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


@asynccontextmanager
async def connection():
    db = await get_connection()
    try:
        yield db
    finally:
        await db.close()


async def init_db() -> None:
    async with connection() as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              archived INTEGER DEFAULT 0,
              archived_at DATETIME,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              image_data TEXT,
              intent TEXT,
              intent_data TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_logs (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              meal_type TEXT,
              eaten_at DATETIME NOT NULL,
              total_kcal REAL,
              total_protein_g REAL,
              total_carb_g REAL,
              total_fat_g REAL,
              source TEXT,
              note TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_items (
              id TEXT PRIMARY KEY,
              meal_log_id TEXT NOT NULL,
              food_name TEXT NOT NULL,
              food_source_id TEXT,
              grams REAL,
              kcal REAL,
              protein_g REAL,
              carb_g REAL,
              fat_g REAL,
              confidence REAL,
              raw_json TEXT,
              FOREIGN KEY(meal_log_id) REFERENCES meal_logs(id)
            );

            CREATE TABLE IF NOT EXISTS activity_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              intent TEXT NOT NULL,
              entry_date TEXT,
              timestamp DATETIME NOT NULL,
              data_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS body_metrics (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              measured_at DATETIME NOT NULL,
              weight_kg REAL,
              body_fat_pct REAL,
              waist_cm REAL,
              chest_cm REAL,
              hip_cm REAL,
              raw_json TEXT
            );

            CREATE TABLE IF NOT EXISTS workout_logs (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              started_at DATETIME NOT NULL,
              workout_type TEXT,
              duration_min INTEGER,
              calories_burned REAL,
              rpe REAL,
              note TEXT,
              raw_json TEXT
            );

            CREATE TABLE IF NOT EXISTS user_semantic_memory (
              user_id TEXT PRIMARY KEY,
              memory_json TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS workout_session_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              started_at DATETIME NOT NULL,
              workout_type TEXT NOT NULL,
              source TEXT DEFAULT 'agent',
              raw_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS set_records (
              id TEXT PRIMARY KEY,
              workout_record_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              exercise_name TEXT NOT NULL,
              set_number INTEGER NOT NULL,
              weight_kg REAL,
              reps INTEGER,
              rpe REAL,
              completed INTEGER DEFAULT 1,
              raw_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(workout_record_id) REFERENCES workout_session_records(id)
            );

            CREATE TABLE IF NOT EXISTS biometric_events (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              event_type TEXT NOT NULL,
              captured_at DATETIME NOT NULL,
              value_json TEXT NOT NULL,
              source TEXT DEFAULT 'manual',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS injury_events (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              occurred_at DATETIME NOT NULL,
              body_region TEXT NOT NULL,
              severity REAL NOT NULL,
              note TEXT NOT NULL,
              raw_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS weekly_plan_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              plan_json TEXT NOT NULL,
              status TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              confirmed_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS progress_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              parent_plan_id TEXT,
              progress_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_set_records_user_exercise_created
              ON set_records(user_id, exercise_name, created_at);

            CREATE INDEX IF NOT EXISTS idx_injury_events_user_severity
              ON injury_events(user_id, severity, occurred_at);

            CREATE TABLE IF NOT EXISTS user_procedural_memory (
              user_id TEXT PRIMARY KEY,
              memory_json TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS feedback_signals (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              plan_id TEXT,
              signal TEXT NOT NULL,
              score REAL NOT NULL,
              metadata_json TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS observation_events (
              id TEXT PRIMARY KEY,
              span_type TEXT NOT NULL,
              event_type TEXT NOT NULL,
              metadata_json TEXT NOT NULL,
              started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              ended_at DATETIME
            );
            """
        )
        await ensure_chat_session_columns(db)
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", ("user_1",))
        await db.execute(
            """
            INSERT OR IGNORE INTO chat_sessions (id, user_id, title, archived, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            ("session_1", "user_1", "Default session", 0),
        )
        await db.commit()


def parse_json_safe(value: str | None, fallback: Any = None) -> Any:
    if fallback is None:
        fallback = {}
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def utc_now() -> datetime:
    return datetime.now(UTC)


def resolve_timestamp(entry_date: str | None = None) -> str:
    if not entry_date or entry_date == "today":
        return utc_now().isoformat()
    if entry_date == "yesterday":
        return (utc_now() - timedelta(days=1)).isoformat()

    try:
        parsed = datetime.fromisoformat(entry_date.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat()
    except ValueError:
        return utc_now().isoformat()


async def insert_activity_record(
    db: aiosqlite.Connection,
    user_id: str,
    intent: str,
    data: dict[str, Any] | None,
    entry_date: str | None = None,
    record_id: str | None = None,
    explicit_timestamp: str | None = None,
) -> dict[str, Any]:
    next_id = record_id or str(uuid4())
    timestamp = explicit_timestamp or resolve_timestamp(entry_date)
    resolved_entry_date = entry_date or timestamp[:10]
    payload = data or {}

    await db.execute(
        """
        INSERT OR REPLACE INTO activity_records (id, user_id, intent, entry_date, timestamp, data_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (next_id, user_id, intent, resolved_entry_date, timestamp, json.dumps(payload, ensure_ascii=False)),
    )
    return {
        "id": next_id,
        "intent": intent,
        "data": payload,
        "entryDate": resolved_entry_date,
        "timestamp": timestamp,
    }


async def ensure_chat_session_columns(db: aiosqlite.Connection) -> None:
    cursor = await db.execute("PRAGMA table_info(chat_sessions)")
    columns = await cursor.fetchall()
    names = {row["name"] for row in columns}

    if "archived" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN archived INTEGER DEFAULT 0")
    if "archived_at" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN archived_at DATETIME")
    if "updated_at" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME")

    await db.execute("UPDATE chat_sessions SET archived = COALESCE(archived, 0)")
    await db.execute(
        "UPDATE chat_sessions SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
    )


async def get_session_messages(session_id: str) -> list[dict[str, Any]]:
    async with connection() as db:
        cursor = await db.execute(
            "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        )
        rows = await cursor.fetchall()

    return [
        {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "image_data": row["image_data"],
            "intent": row["intent"],
            "data": parse_json_safe(row["intent_data"], None) if row["intent_data"] else None,
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def format_session(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"] or "Untitled chat",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"] or row["created_at"],
        "archived": bool(row["archived"]),
        "archivedAt": row["archived_at"] or None,
        "lastMessageAt": row["last_message_at"] or None,
        "lastMessagePreview": row["last_message_preview"] or None,
        "messageCount": row["message_count"] or 0,
    }


async def list_chat_sessions(scope: str = "active") -> list[dict[str, Any]]:
    if scope not in {"active", "archived", "all"}:
        scope = "active"

    where_clause = ""
    if scope == "active":
        where_clause = "WHERE COALESCE(s.archived, 0) = 0"
    elif scope == "archived":
        where_clause = "WHERE COALESCE(s.archived, 0) = 1"

    async with connection() as db:
        cursor = await db.execute(
            f"""
            SELECT
              s.id,
              s.title,
              s.created_at,
              s.updated_at,
              s.archived,
              s.archived_at,
              (
                SELECT m.created_at
                FROM chat_messages m
                WHERE m.session_id = s.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_at,
              (
                SELECT m.content
                FROM chat_messages m
                WHERE m.session_id = s.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_preview,
              (
                SELECT COUNT(1)
                FROM chat_messages m
                WHERE m.session_id = s.id
              ) AS message_count
            FROM chat_sessions s
            {where_clause}
            ORDER BY COALESCE(last_message_at, s.updated_at, s.created_at) DESC
            """
        )
        rows = await cursor.fetchall()

    return [format_session(row) for row in rows]


async def create_chat_session(title: str | None = None, user_id: str = DEFAULT_USER_ID) -> dict[str, Any]:
    session_id = f"session_{uuid4()}"
    resolved_title = title.strip() if isinstance(title, str) and title.strip() else "New chat"

    async with connection() as db:
        await db.execute(
            """
            INSERT INTO chat_sessions (id, user_id, title, archived, updated_at)
            VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
            """,
            (session_id, user_id, resolved_title),
        )
        await db.commit()

    sessions = await list_chat_sessions("all")
    for session in sessions:
        if session["id"] == session_id:
            return session
    raise RuntimeError("Failed to create chat session")


async def update_chat_session(session_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    async with connection() as db:
        cursor = await db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
        current = await cursor.fetchone()
        if not current:
            raise ValueError("Session not found")

        if isinstance(updates.get("title"), str):
            next_title = updates["title"].strip()
            if not next_title:
                raise ValueError("Session title cannot be empty")
            await db.execute(
                "UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (next_title, session_id),
            )

        if isinstance(updates.get("archived"), bool):
            archived = 1 if updates["archived"] else 0
            await db.execute(
                """
                UPDATE chat_sessions
                SET archived = ?,
                    archived_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (archived, archived, session_id),
            )

        await db.commit()

    sessions = await list_chat_sessions("all")
    for session in sessions:
        if session["id"] == session_id:
            return session
    raise RuntimeError("Failed to update chat session")


async def delete_chat_session(session_id: str) -> None:
    async with connection() as db:
        cursor = await db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
        current = await cursor.fetchone()
        if not current:
            raise ValueError("Session not found")
        await db.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        await db.commit()


async def ensure_session_exists(
    db: aiosqlite.Connection,
    session_id: str,
    user_id: str = DEFAULT_USER_ID,
) -> None:
    cursor = await db.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
    session = await cursor.fetchone()
    if session:
        return
    await db.execute(
        """
        INSERT INTO chat_sessions (id, user_id, title, archived, updated_at)
        VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
        """,
        (session_id, user_id, "Untitled chat"),
    )


async def add_chat_message(
    session_id: str,
    role: str,
    content: str,
    image_data: str | None = None,
    intent: str | None = None,
    intent_data: Any = None,
) -> dict[str, Any]:
    msg_id = str(uuid4())
    async with connection() as db:
        await ensure_session_exists(db, session_id)
        await db.execute(
            """
            INSERT INTO chat_messages (id, session_id, role, content, image_data, intent, intent_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                msg_id,
                session_id,
                role,
                content,
                image_data,
                intent,
                json.dumps(intent_data, ensure_ascii=False) if intent_data is not None else None,
            ),
        )
        await db.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        await db.commit()
    return {
        "id": msg_id,
        "role": role,
        "content": content,
        "image_data": image_data,
        "intent": intent,
        "intent_data": intent_data,
    }


async def save_record(intent: str, data: dict[str, Any] | None, entry_date: str | None = None) -> dict[str, Any]:
    payload = data or {}
    record_id = str(uuid4())
    timestamp = resolve_timestamp(entry_date)

    async with connection() as db:
        if intent == "log_food":
            await db.execute(
                """
                INSERT INTO meal_logs
                  (id, user_id, meal_type, eaten_at, total_kcal, total_protein_g, total_carb_g, total_fat_g, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    DEFAULT_USER_ID,
                    payload.get("meal_type") or "meal",
                    timestamp,
                    payload.get("calories"),
                    payload.get("protein"),
                    payload.get("carbs"),
                    payload.get("fat"),
                    "manual",
                ),
            )
            await db.execute(
                """
                INSERT INTO meal_items
                  (id, meal_log_id, food_name, grams, kcal, protein_g, carb_g, fat_g, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    record_id,
                    payload.get("food_name") or payload.get("name") or "Food",
                    payload.get("quantity") or payload.get("grams"),
                    payload.get("calories"),
                    payload.get("protein"),
                    payload.get("carbs"),
                    payload.get("fat"),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
        elif intent in {"log_exercise", "log_strength_workout"}:
            await db.execute(
                """
                INSERT INTO workout_logs
                  (id, user_id, started_at, workout_type, duration_min, note, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    DEFAULT_USER_ID,
                    timestamp,
                    payload.get("workout_name") or payload.get("exercise_name") or "Workout",
                    payload.get("duration_minutes") or payload.get("duration_min") or 0,
                    payload.get("note") or "",
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
        elif intent == "log_measurement":
            first_measurement = None
            if isinstance(payload.get("measurements"), list) and payload["measurements"]:
                first_measurement = payload["measurements"][0]
            weight = payload.get("weight_kg")
            if weight is None and isinstance(first_measurement, dict) and first_measurement.get("metric") == "weight":
                weight = first_measurement.get("value")
            await db.execute(
                """
                INSERT INTO body_metrics
                  (id, user_id, measured_at, weight_kg, body_fat_pct, waist_cm, chest_cm, hip_cm, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    DEFAULT_USER_ID,
                    timestamp,
                    weight,
                    payload.get("body_fat_pct"),
                    payload.get("waist_cm"),
                    payload.get("chest_cm"),
                    payload.get("hip_cm"),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )

        record = await insert_activity_record(
            db,
            DEFAULT_USER_ID,
            intent,
            payload,
            entry_date,
            record_id,
            timestamp,
        )
        await db.commit()
        return record


async def save_meal_log_multi(
    user_id: str,
    response_json: dict[str, Any],
    source: str = "photo",
) -> dict[str, Any]:
    meal_log_id = str(uuid4())
    eaten_at = utc_now().isoformat()
    items = response_json.get("items") if isinstance(response_json.get("items"), list) else []
    total = response_json.get("total") if isinstance(response_json.get("total"), dict) else {}

    async with connection() as db:
        await db.execute(
            """
            INSERT INTO meal_logs
              (id, user_id, meal_type, eaten_at, total_kcal, total_protein_g, total_carb_g, total_fat_g, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                meal_log_id,
                user_id,
                response_json.get("meal_type") or "unknown",
                eaten_at,
                total.get("kcal") or 0,
                total.get("protein_g") or 0,
                total.get("carb_g") or 0,
                total.get("fat_g") or 0,
                source,
            ),
        )

        for item in items:
            candidates = item.get("candidate_foods") if isinstance(item.get("candidate_foods"), list) else []
            nutrition = item.get("nutrition_estimate") if isinstance(item.get("nutrition_estimate"), dict) else {}
            await db.execute(
                """
                INSERT INTO meal_items
                  (id, meal_log_id, food_name, food_source_id, grams, kcal, protein_g, carb_g, fat_g, confidence, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    meal_log_id,
                    item.get("name") or "Food",
                    candidates[0].get("source_id") if candidates and isinstance(candidates[0], dict) else None,
                    item.get("estimated_grams") or 0,
                    nutrition.get("kcal") or 0,
                    nutrition.get("protein_g") or 0,
                    nutrition.get("carb_g") or 0,
                    nutrition.get("fat_g") or 0,
                    item.get("confidence") if item.get("confidence") is not None else 1.0,
                    json.dumps(item, ensure_ascii=False),
                ),
            )

        record = await insert_activity_record(
            db,
            user_id,
            "log_food_multi",
            response_json,
            eaten_at[:10],
            meal_log_id,
            eaten_at,
        )
        await db.commit()
        return record


async def get_history(limit: int = 100) -> list[dict[str, Any]]:
    async with connection() as db:
        cursor = await db.execute(
            """
            SELECT id, intent, entry_date, timestamp, data_json
            FROM activity_records
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "intent": row["intent"],
            "entryDate": row["entry_date"] or None,
            "data": parse_json_safe(row["data_json"], {}),
        }
        for row in rows
    ]


async def update_activity_record(record_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    async with connection() as db:
        cursor = await db.execute(
            "SELECT id, intent, entry_date, timestamp, data_json FROM activity_records WHERE id = ?",
            (record_id,),
        )
        current = await cursor.fetchone()
        if not current:
            raise ValueError("Record not found")

        next_data = updates["data"] if "data" in updates else parse_json_safe(current["data_json"], {})
        next_timestamp = current["timestamp"]
        next_entry_date = current["entry_date"] or current["timestamp"][:10]

        if isinstance(updates.get("entryDate"), str) and updates["entryDate"].strip():
            next_timestamp = resolve_timestamp(updates["entryDate"].strip())
            next_entry_date = next_timestamp[:10]

        await db.execute(
            """
            UPDATE activity_records
            SET data_json = ?, entry_date = ?, timestamp = ?
            WHERE id = ?
            """,
            (json.dumps(next_data or {}, ensure_ascii=False), next_entry_date, next_timestamp, record_id),
        )
        await db.commit()

    return {
        "id": record_id,
        "intent": current["intent"],
        "data": next_data or {},
        "entryDate": next_entry_date,
        "timestamp": next_timestamp,
    }


async def delete_activity_record(record_id: str) -> None:
    async with connection() as db:
        cursor = await db.execute(
            "SELECT id, intent FROM activity_records WHERE id = ?",
            (record_id,),
        )
        current = await cursor.fetchone()
        if not current:
            raise ValueError("Record not found")

        await db.execute("DELETE FROM activity_records WHERE id = ?", (record_id,))
        if current["intent"] in {"log_food", "log_food_multi"}:
            await db.execute("DELETE FROM meal_items WHERE meal_log_id = ?", (record_id,))
            await db.execute("DELETE FROM meal_logs WHERE id = ?", (record_id,))
        if current["intent"] in {"log_exercise", "log_strength_workout"}:
            await db.execute("DELETE FROM workout_logs WHERE id = ?", (record_id,))
        if current["intent"] == "log_measurement":
            await db.execute("DELETE FROM body_metrics WHERE id = ?", (record_id,))
        await db.commit()


async def get_semantic_memory(user_id: str = DEFAULT_USER_ID) -> dict[str, Any] | None:
    async with connection() as db:
        cursor = await db.execute(
            "SELECT memory_json FROM user_semantic_memory WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
    return parse_json_safe(row["memory_json"], None) if row else None


async def save_semantic_memory(user_id: str, memory: dict[str, Any]) -> None:
    async with connection() as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO user_semantic_memory (user_id, memory_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            """,
            (user_id, json.dumps(memory, ensure_ascii=False)),
        )
        await db.commit()


async def get_episodic_memories(user_id: str = DEFAULT_USER_ID, limit: int = 20) -> list[dict[str, Any]]:
    async with connection() as db:
        cursor = await db.execute(
            """
            SELECT id, intent, entry_date, timestamp, data_json
            FROM activity_records
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "intent": row["intent"],
            "entryDate": row["entry_date"],
            "timestamp": row["timestamp"],
            "data": parse_json_safe(row["data_json"], {}),
        }
        for row in rows
    ]
