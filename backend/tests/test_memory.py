import pytest

from app.config import get_settings
from app.services import db
from app.services.memory import (
    aggregate_weekly_stats,
    analyze_muscle_groups,
    build_agent_context,
    format_context_as_system_prompt,
    get_or_init_semantic_memory,
    merge_weekly_stats,
    update_semantic_memory,
)


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_semantic_memory_merges_profile_updates():
    await get_or_init_semantic_memory()
    memory = await update_semantic_memory(
        {
            "goals": ["fat loss", "fat loss"],
            "weakPoints": ["shoulder stability"],
            "injuryHistory": ["left knee"],
            "preferredStyle": "strength first",
        }
    )

    assert memory["userProfile"]["goals"] == ["fat loss"]
    assert memory["userProfile"]["weakPoints"] == ["shoulder stability"]
    assert memory["userProfile"]["preferredStyle"] == "strength first"


async def test_context_format_includes_recent_episode():
    await db.save_record("log_food", {"food_name": "rice", "calories": 260}, "2026-04-19")

    ctx = await build_agent_context(
        "what should I eat next?",
        "session_1",
        [{"role": "user", "content": "logged lunch"}],
    )
    prompt = format_context_as_system_prompt(ctx)

    assert "Semantic Memory" in prompt
    assert "Food log" in prompt
    assert "logged lunch" in prompt


async def test_weekly_training_stats_helpers():
    workout = {
        "id": "record_1",
        "data": {
            "exercises": [
                {"name": "bench press", "sets": [{"weight": 60, "reps": 8}, {"weight": 65, "reps": 5}]}
            ]
        },
    }

    analysis = analyze_muscle_groups(workout["data"])
    stats = await aggregate_weekly_stats("user_1", "2026-W16", [workout])
    merged = merge_weekly_stats({"totalWorkouts": 1}, stats)

    assert analysis["totalSets"] == 2
    assert "chest" in analysis["muscleGroups"]
    assert stats["exerciseRecords"]["bench press"]["bestWeight"] == 65
    assert merged["totalWorkouts"] == 2
