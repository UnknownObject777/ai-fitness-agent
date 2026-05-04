from datetime import UTC, datetime, timedelta

from app.services.working_memory import InMemoryWorkingMemoryStore, HeartRateSample


def test_working_memory_aggregates_recent_heart_rate_window():
    store = InMemoryWorkingMemoryStore(ttl_seconds=3600)
    base = datetime(2026, 5, 4, 9, 0, tzinfo=UTC)

    store.add_heart_rate_sample("session_1", HeartRateSample(value=100, capturedAt=base - timedelta(minutes=6)))
    store.add_heart_rate_sample("session_1", HeartRateSample(value=120, capturedAt=base - timedelta(minutes=4)))
    store.add_heart_rate_sample("session_1", HeartRateSample(value=150, capturedAt=base - timedelta(minutes=1)))

    summary = store.get_heart_rate_summary("session_1", now=base, window_minutes=5)

    assert summary["avg"] == 135
    assert summary["peak"] == 150
    assert summary["sampleCount"] == 2


def test_plan_draft_is_removed_when_discarded():
    store = InMemoryWorkingMemoryStore(ttl_seconds=3600)
    store.save_plan_draft("session_1", {"planId": "draft_1", "weekly_templates": []})

    assert store.get_plan_draft("session_1")["planId"] == "draft_1"

    store.discard_plan_draft("session_1")

    assert store.get_plan_draft("session_1") is None
