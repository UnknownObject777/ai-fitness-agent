import pytest

from app.config import get_settings
from app.services import db
from app.services.episodic_memory import (
    get_high_priority_injury_events,
    get_recent_set_records,
    record_injury_event,
    record_workout_with_sets,
)


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_workout_record_persists_each_set_as_independent_row():
    workout = await record_workout_with_sets(
        user_id="user_1",
        started_at="2026-05-04T09:00:00+08:00",
        workout_type="strength",
        exercises=[
            {
                "exerciseName": "bench press",
                "sets": [
                    {"setNumber": 1, "weightKg": 80, "reps": 8, "rpe": 8},
                    {"setNumber": 2, "weightKg": 80, "reps": 7, "rpe": 8.5},
                ],
            }
        ],
    )

    sets = await get_recent_set_records("user_1", exercise_name="bench press", limit=10)

    assert workout["workoutType"] == "strength"
    assert [item["reps"] for item in sets] == [7, 8]
    assert sets[0]["rpe"] == 8.5


async def test_injury_events_are_retrieved_before_general_context():
    await record_injury_event(
        user_id="user_1",
        occurred_at="2026-04-01T09:00:00+08:00",
        body_region="left shoulder",
        severity=0.8,
        note="Pain during overhead press",
    )

    injuries = await get_high_priority_injury_events("user_1")

    assert injuries[0]["bodyRegion"] == "left shoulder"
    assert injuries[0]["severity"] == 0.8
