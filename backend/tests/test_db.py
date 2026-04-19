import pytest

from app.config import get_settings
from app.services import db


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_chat_session_lifecycle():
    session = await db.create_chat_session("Training notes")
    assert session["title"] == "Training notes"
    assert session["archived"] is False

    await db.add_chat_message(session["id"], "user", "bench press 3x8")
    messages = await db.get_session_messages(session["id"])
    assert len(messages) == 1
    assert messages[0]["content"] == "bench press 3x8"

    archived = await db.update_chat_session(session["id"], {"archived": True})
    assert archived["archived"] is True

    archived_sessions = await db.list_chat_sessions("archived")
    assert any(item["id"] == session["id"] for item in archived_sessions)

    await db.delete_chat_session(session["id"])
    assert not await db.get_session_messages(session["id"])


async def test_save_update_delete_strength_record():
    record = await db.save_record(
        "log_strength_workout",
        {
            "workout_name": "Push A",
            "duration_minutes": 45,
            "exercises": [{"name": "Bench", "sets": [{"weight": 60, "reps": 8}]}],
        },
        "2026-04-19",
    )
    assert record["entryDate"] == "2026-04-19"

    history = await db.get_history()
    assert history[0]["id"] == record["id"]
    assert history[0]["data"]["workout_name"] == "Push A"

    updated = await db.update_activity_record(record["id"], {"data": {"workout_name": "Push B"}})
    assert updated["data"]["workout_name"] == "Push B"

    await db.delete_activity_record(record["id"])
    assert all(item["id"] != record["id"] for item in await db.get_history())


async def test_semantic_and_episodic_memory_roundtrip():
    await db.save_record("log_food", {"food_name": "oats", "calories": 320}, "2026-04-19")
    await db.save_semantic_memory("user_1", {"userId": "user_1", "userProfile": {"goals": ["cut"]}})

    memory = await db.get_semantic_memory("user_1")
    episodes = await db.get_episodic_memories("user_1", 5)

    assert memory["userProfile"]["goals"] == ["cut"]
    assert episodes[0]["intent"] == "log_food"
