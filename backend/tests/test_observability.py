import pytest

from app.config import get_settings
from app.observability.fitness_tracing import FitnessSpanTracer, list_observation_events
from app.services import db


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_workout_span_records_safety_and_tool_metadata():
    tracer = FitnessSpanTracer()

    span_id = await tracer.start_span("workout_execution", {"sessionId": "session_1"})
    await tracer.end_span(span_id, {"safetyGuardTriggers": 1, "toolLatencyMs": 23, "tokenUsage": 1200})

    events = await list_observation_events(limit=10)

    assert events[0]["spanType"] == "workout_execution"
    assert events[0]["metadata"]["safetyGuardTriggers"] == 1


async def test_biometric_warning_event_is_recorded():
    tracer = FitnessSpanTracer()

    event = await tracer.record_biometric_warning(
        user_id="user_1",
        metric="heart_rate",
        value=188,
        threshold=180,
    )

    assert event["eventType"] == "fitness_metrics_warning"
