from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field


class HeartRateSample(BaseModel):
    value: float
    captured_at: datetime = Field(alias="capturedAt")

    model_config = {"populate_by_name": True}


class WorkingMemoryEntry(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="updatedAt")
    heart_rate_samples: list[HeartRateSample] = Field(default_factory=list, alias="heartRateSamples")
    current_progress: dict[str, Any] = Field(default_factory=dict, alias="currentProgress")
    plan_draft: dict[str, Any] | None = Field(default=None, alias="planDraft")

    model_config = {"populate_by_name": True}


class InMemoryWorkingMemoryStore:
    def __init__(self, ttl_seconds: int = 7200) -> None:
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, WorkingMemoryEntry] = {}

    def _now(self) -> datetime:
        return datetime.now(UTC)

    def _entry(self, session_id: str) -> WorkingMemoryEntry:
        self.prune_expired()
        entry = self._entries.get(session_id)
        if entry is None:
            entry = WorkingMemoryEntry()
            self._entries[session_id] = entry
        entry.updated_at = self._now()
        return entry

    def prune_expired(self) -> None:
        cutoff = self._now() - timedelta(seconds=self.ttl_seconds)
        expired = [key for key, entry in self._entries.items() if entry.updated_at < cutoff]
        for key in expired:
            del self._entries[key]

    def add_heart_rate_sample(self, session_id: str, sample: HeartRateSample) -> None:
        entry = self._entry(session_id)
        entry.heart_rate_samples.append(sample)

    def get_heart_rate_summary(
        self,
        session_id: str,
        now: datetime | None = None,
        window_minutes: int = 5,
    ) -> dict[str, Any]:
        entry = self._entries.get(session_id)
        if entry is None:
            return {"avg": None, "peak": None, "sampleCount": 0}
        reference = now or self._now()
        cutoff = reference - timedelta(minutes=window_minutes)
        samples = [sample.value for sample in entry.heart_rate_samples if sample.captured_at >= cutoff]
        if not samples:
            return {"avg": None, "peak": None, "sampleCount": 0}
        return {
            "avg": round(sum(samples) / len(samples), 2),
            "peak": max(samples),
            "sampleCount": len(samples),
        }

    def save_plan_draft(self, session_id: str, draft: dict[str, Any]) -> None:
        self._entry(session_id).plan_draft = draft

    def get_plan_draft(self, session_id: str) -> dict[str, Any] | None:
        entry = self._entries.get(session_id)
        return entry.plan_draft if entry else None

    def discard_plan_draft(self, session_id: str) -> None:
        entry = self._entries.get(session_id)
        if entry:
            entry.plan_draft = None


working_memory_store = InMemoryWorkingMemoryStore()
