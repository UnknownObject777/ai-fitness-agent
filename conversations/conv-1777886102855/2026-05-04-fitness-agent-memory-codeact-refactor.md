# Fitness Agent Memory CodeAct Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current FastAPI + LangGraph Sparky backend into a safety-first fitness Agent with session state, four-layer memory, structured workout plan execution, bridge-based multimodal routing, domain tool registration, and observability.

**Architecture:** Keep the existing FastAPI API shape and LangGraph loop, but split the current broad memory and tool modules into explicit bounded units. The first implementation uses SQLite-compatible schemas and storage interfaces so the app keeps running locally while making room for Redis, TimescaleDB, PostgreSQL, and pgvector in a separate infrastructure migration.

**Tech Stack:** Python 3.11+, FastAPI, LangGraph, LangChain tools, Pydantic v2, aiosqlite, pytest/pytest-asyncio, React/Vite client compatibility through existing `/api` routes.

---

## Current Repository Facts

- The live backend is `backend/app/main.py`, not the legacy root `server.ts`; `server.ts.legacy` remains as historical reference.
- The active agent graph is `backend/app/agent/graph.py` with nodes under `backend/app/agent/nodes/`.
- Existing memory is concentrated in `backend/app/models/memory.py` and `backend/app/services/memory.py`.
- Existing tools are concentrated in `backend/app/agent/tools/__init__.py`.
- The current database is SQLite through `backend/app/services/db.py`.
- Existing backend tests live in `backend/tests/` and already isolate SQLite through `SPARKY_DATABASE_PATH`.
- The supplied architecture diagrams define these target layers:
  - FitnessSessionManager
  - WorkoutPlanExecutor + SafetyGuard
  - BiometricBridge, WearableBridge, VideoAnalysisBridge, NutritionBridge, StateBridge
  - FitnessToolRegistry with ExerciseLibrary, InjuryRiskAssessor, RecoveryAdvisor, CompetitionPlanner
  - Observation spans for workout execution and body metrics
  - Four-layer memory: working, episodic, semantic, procedural

## File Structure

### New Backend Files

- Create: `backend/app/models/session.py`
  - Pydantic models for static profile, dynamic profile, goals, active plans, wearable snapshots, and `FitnessSessionState`.
- Create: `backend/app/models/episodic.py`
  - Pydantic models for `WorkoutRecord`, `SetRecord`, `BiometricEvent`, `InjuryEvent`, `WeeklyPlanRecord`, and `ProgressRecord`.
- Create: `backend/app/models/planning.py`
  - Pydantic models for structured workout plan DSL, safety issues, execution results, and plan preview/confirmation payloads.
- Create: `backend/app/models/procedural.py`
  - Pydantic models for `PlanTemplate`, `PromptStrategy`, `ToolUsagePattern`, and `FeedbackLoop`.
- Create: `backend/app/services/session_manager.py`
  - `FitnessSessionManager` that loads global state, updates working memory, and composes session state for the graph.
- Create: `backend/app/services/working_memory.py`
  - TTL working memory store with sliding heart-rate aggregation and temporary plan draft handling.
- Create: `backend/app/services/episodic_memory.py`
  - Write/read service for workout, set, biometric, injury, weekly plan, and progress event records.
- Create: `backend/app/services/semantic_distiller.py`
  - Deterministic first-pass semantic memory updater for strength estimates, preferences, recovery patterns, and injury rules.
- Create: `backend/app/services/procedural_memory.py`
  - Stores plan templates, prompt strategy, feedback signals, and retrieval summaries.
- Create: `backend/app/services/context_budget.py`
  - Builds the three-tier context injection payload with a deterministic token-budget approximation.
- Create: `backend/app/agent/planning/dsl.py`
  - Plan DSL normalization and builder helpers.
- Create: `backend/app/agent/planning/safety_guard.py`
  - Safety checks for RPE, weekly frequency, recovery windows, injury contraindications, and biometric warnings.
- Create: `backend/app/agent/planning/executor.py`
  - `WorkoutPlanExecutor` that executes structured plan DSL, calls domain tools through the registry, runs SafetyGuard, and returns a plan execution result.
- Create: `backend/app/agent/planning/renderers.py`
  - Markdown-friendly plan and risk summary renderers for existing frontend chat cards.
- Create: `backend/app/agent/bridges/base.py`
  - Shared bridge protocols and normalized data schemas.
- Create: `backend/app/agent/bridges/biometric.py`
  - Reads/writes body metrics and workout biometrics.
- Create: `backend/app/agent/bridges/wearable.py`
  - Normalizes Apple HealthKit, Garmin Connect, and Xiaomi sample payloads to the domain schema.
- Create: `backend/app/agent/bridges/nutrition.py`
  - Wraps food image/text nutrition flows behind a single bridge interface.
- Create: `backend/app/agent/bridges/video_analysis.py`
  - Provides pose/video analysis stub output and a stable route for future model integration.
- Create: `backend/app/agent/bridges/state.py`
  - Bridge for reading/writing `FitnessSessionState`.
- Create: `backend/app/agent/bridges/router.py`
  - Multimodal route selection for text, image, and video inputs.
- Create: `backend/app/agent/tools/registry.py`
  - `FitnessToolRegistry` and schema exposure.
- Create: `backend/app/agent/tools/domain_tools.py`
  - Domain tool implementations for exercise search, injury risk, recovery advice, competition planning, and plan execution.
- Create: `backend/app/observability/fitness_tracing.py`
  - Lightweight span collector with DB-backed observation events.
- Create: `backend/app/api/plans.py`
  - Plan preview, confirm, and feedback endpoints.

### Modified Backend Files

- Modify: `backend/app/models/memory.py`
  - Extend semantic memory with `StrengthModel`, `PreferenceModel`, `RecoveryPattern`, `InjuryRiskProfile`, and procedural references.
- Modify: `backend/app/services/memory.py`
  - Delegate context construction to `FitnessSessionManager`, `episodic_memory`, `semantic_distiller`, `procedural_memory`, and `context_budget`.
- Modify: `backend/app/services/db.py`
  - Add additive SQLite tables and indexes; keep existing tables intact.
- Modify: `backend/app/agent/state.py`
  - Add `fitness_session_state`, `context_sections`, `modality_route`, `plan_execution`, and `safety_issues`.
- Modify: `backend/app/agent/nodes/context_builder.py`
  - Use `FitnessSessionManager` and budgeted context sections.
- Modify: `backend/app/agent/nodes/tool_executor.py`
  - Use multimodal router and registry lookup instead of direct monolithic imports.
- Modify: `backend/app/agent/nodes/supervisor_agent.py`
  - Inject safety-first system variables and new registry descriptions.
- Modify: `backend/app/agent/nodes/memory_updater.py`
  - Persist confirmed plan drafts, episode records, semantic diffs, and procedural feedback.
- Modify: `backend/app/agent/tools/__init__.py`
  - Re-export registry-built tools while preserving `TOOLS` and `TOOLS_BY_NAME`.
- Modify: `backend/app/main.py`
  - Include the new `plans` router.

### Test Files

- Create: `backend/tests/test_session_manager.py`
- Create: `backend/tests/test_working_memory.py`
- Create: `backend/tests/test_episodic_memory.py`
- Create: `backend/tests/test_semantic_distiller.py`
- Create: `backend/tests/test_context_budget.py`
- Create: `backend/tests/test_safety_guard.py`
- Create: `backend/tests/test_workout_plan_executor.py`
- Create: `backend/tests/test_bridges.py`
- Create: `backend/tests/test_fitness_tool_registry.py`
- Create: `backend/tests/test_observability.py`
- Modify: `backend/tests/test_memory.py`
- Modify: `backend/tests/test_agent.py`
- Modify: `backend/tests/test_api.py`

## Implementation Tasks

### Task 1: Session State Models

**Files:**
- Create: `backend/app/models/session.py`
- Test: `backend/tests/test_session_manager.py`

- [ ] **Step 1: Write model tests**

Create `backend/tests/test_session_manager.py` with:

```python
from app.models.session import (
    ActivePlan,
    DynamicFitnessProfile,
    FitnessSessionState,
    GoalContext,
    StaticFitnessProfile,
    UserFitnessProfile,
    WearableSnapshot,
)


def test_fitness_session_state_splits_static_and_dynamic_profile():
    state = FitnessSessionState(
        userId="user_1",
        profile=UserFitnessProfile(
            static=StaticFitnessProfile(
                age=32,
                sex="male",
                heightCm=176,
                injuryHistory=["left shoulder impingement"],
                jointLimits=["avoid deep overhead pressing"],
            ),
            dynamic=DynamicFitnessProfile(
                weeklyFatigue=0.72,
                hrvTrend="down",
                readinessScore=0.43,
            ),
        ),
        currentPlan=ActivePlan(planId="plan_1", phase="base", week=2, status="active"),
        goals=GoalContext(primaryGoal="fat_loss", secondaryGoals=["strength"], targetDate="2026-08-01"),
        latestBiometrics=WearableSnapshot(
            source="garmin",
            capturedAt="2026-05-04T09:00:00+08:00",
            heartRateAvg=78,
            hrvMs=42,
            sleepScore=61,
        ),
    )

    payload = state.model_dump(by_alias=True)

    assert payload["profile"]["static"]["injuryHistory"] == ["left shoulder impingement"]
    assert payload["profile"]["dynamic"]["weeklyFatigue"] == 0.72
    assert payload["profile"]["dynamic"]["hrvTrend"] == "down"
    assert payload["goals"]["primaryGoal"] == "fat_loss"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_session_manager.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.session'`.

- [ ] **Step 3: Create session models**

Create `backend/app/models/session.py` with:

```python
from typing import Literal

from pydantic import BaseModel, Field


class StaticFitnessProfile(BaseModel):
    age: int | None = None
    sex: Literal["male", "female", "other", "unknown"] = "unknown"
    height_cm: float | None = Field(default=None, alias="heightCm")
    injury_history: list[str] = Field(default_factory=list, alias="injuryHistory")
    joint_limits: list[str] = Field(default_factory=list, alias="jointLimits")
    medical_contraindications: list[str] = Field(default_factory=list, alias="medicalContraindications")
    training_experience: Literal["beginner", "intermediate", "advanced", "unknown"] = Field(
        default="unknown",
        alias="trainingExperience",
    )

    model_config = {"populate_by_name": True}


class DynamicFitnessProfile(BaseModel):
    bmi: float | None = None
    weekly_fatigue: float = Field(default=0.0, ge=0, le=1, alias="weeklyFatigue")
    hrv_trend: Literal["up", "flat", "down", "unknown"] = Field(default="unknown", alias="hrvTrend")
    readiness_score: float | None = Field(default=None, ge=0, le=1, alias="readinessScore")
    current_soreness: dict[str, float] = Field(default_factory=dict, alias="currentSoreness")

    model_config = {"populate_by_name": True}


class UserFitnessProfile(BaseModel):
    static: StaticFitnessProfile = Field(default_factory=StaticFitnessProfile)
    dynamic: DynamicFitnessProfile = Field(default_factory=DynamicFitnessProfile)


class ActivePlan(BaseModel):
    plan_id: str | None = Field(default=None, alias="planId")
    phase: str = "none"
    week: int = 0
    status: Literal["draft", "active", "paused", "completed", "none"] = "none"

    model_config = {"populate_by_name": True}


class GoalContext(BaseModel):
    primary_goal: str = Field(default="general_fitness", alias="primaryGoal")
    secondary_goals: list[str] = Field(default_factory=list, alias="secondaryGoals")
    target_date: str | None = Field(default=None, alias="targetDate")

    model_config = {"populate_by_name": True}


class WearableSnapshot(BaseModel):
    source: str = "manual"
    captured_at: str = Field(alias="capturedAt")
    heart_rate_avg: float | None = Field(default=None, alias="heartRateAvg")
    heart_rate_peak: float | None = Field(default=None, alias="heartRatePeak")
    hrv_ms: float | None = Field(default=None, alias="hrvMs")
    sleep_score: float | None = Field(default=None, alias="sleepScore")
    steps: int | None = None

    model_config = {"populate_by_name": True}


class FitnessSessionState(BaseModel):
    user_id: str = Field(default="user_1", alias="userId")
    profile: UserFitnessProfile = Field(default_factory=UserFitnessProfile)
    history: list[dict] = Field(default_factory=list)
    current_plan: ActivePlan = Field(default_factory=ActivePlan, alias="currentPlan")
    goals: GoalContext = Field(default_factory=GoalContext)
    latest_biometrics: WearableSnapshot | None = Field(default=None, alias="latestBiometrics")

    model_config = {"populate_by_name": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd backend
uv run pytest tests/test_session_manager.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/session.py backend/tests/test_session_manager.py
git commit -m "feat: add fitness session state models"
```

### Task 2: Working Memory TTL and Sliding Biometrics

**Files:**
- Create: `backend/app/services/working_memory.py`
- Modify: `backend/tests/test_session_manager.py`
- Test: `backend/tests/test_working_memory.py`

- [ ] **Step 1: Write working memory tests**

Create `backend/tests/test_working_memory.py` with:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_working_memory.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.working_memory'`.

- [ ] **Step 3: Create working memory service**

Create `backend/app/services/working_memory.py` with:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd backend
uv run pytest tests/test_working_memory.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/working_memory.py backend/tests/test_working_memory.py
git commit -m "feat: add working memory store"
```

### Task 3: Episodic Memory Tables and Services

**Files:**
- Create: `backend/app/models/episodic.py`
- Create: `backend/app/services/episodic_memory.py`
- Modify: `backend/app/services/db.py`
- Test: `backend/tests/test_episodic_memory.py`

- [ ] **Step 1: Write episodic memory tests**

Create `backend/tests/test_episodic_memory.py` with:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_episodic_memory.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.episodic_memory'`.

- [ ] **Step 3: Add SQLite tables**

Modify `backend/app/services/db.py` inside the `await db.executescript(""" ... """)` block in `init_db()` by appending these table definitions after `user_semantic_memory`:

```sql
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
```

- [ ] **Step 4: Create episodic models**

Create `backend/app/models/episodic.py` with:

```python
from typing import Any

from pydantic import BaseModel, Field


class SetRecord(BaseModel):
    id: str
    workout_record_id: str = Field(alias="workoutRecordId")
    user_id: str = Field(alias="userId")
    exercise_name: str = Field(alias="exerciseName")
    set_number: int = Field(alias="setNumber")
    weight_kg: float | None = Field(default=None, alias="weightKg")
    reps: int | None = None
    rpe: float | None = None
    completed: bool = True
    raw: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class WorkoutRecord(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    started_at: str = Field(alias="startedAt")
    workout_type: str = Field(alias="workoutType")
    source: str = "agent"
    raw: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class InjuryEvent(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    occurred_at: str = Field(alias="occurredAt")
    body_region: str = Field(alias="bodyRegion")
    severity: float = Field(ge=0, le=1)
    note: str

    model_config = {"populate_by_name": True}
```

- [ ] **Step 5: Create episodic memory service**

Create `backend/app/services/episodic_memory.py` with:

```python
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
```

- [ ] **Step 6: Run episodic tests**

Run:

```bash
cd backend
uv run pytest tests/test_episodic_memory.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/episodic.py backend/app/services/episodic_memory.py backend/app/services/db.py backend/tests/test_episodic_memory.py
git commit -m "feat: add episodic fitness memory records"
```

### Task 4: Semantic Memory Models and Deterministic Distillation

**Files:**
- Modify: `backend/app/models/memory.py`
- Create: `backend/app/services/semantic_distiller.py`
- Modify: `backend/app/services/memory.py`
- Test: `backend/tests/test_semantic_distiller.py`
- Test: `backend/tests/test_memory.py`

- [ ] **Step 1: Write semantic distiller tests**

Create `backend/tests/test_semantic_distiller.py` with:

```python
from app.models.memory import SemanticMemory
from app.services.semantic_distiller import distill_strength_event, distill_injury_event


def test_strength_model_updates_estimate_and_confidence_without_overwrite():
    memory = SemanticMemory(userId="user_1")

    updated = distill_strength_event(
        memory,
        {
            "exerciseName": "bench press",
            "weightKg": 80,
            "reps": 8,
            "rpe": 8,
        },
    )

    estimate = updated.strength_model["bench press"]

    assert round(estimate["estimated1RM"], 1) == 101.3
    assert estimate["confidence"] == 0.35

    updated_again = distill_strength_event(
        updated,
        {
            "exerciseName": "bench press",
            "weightKg": 82.5,
            "reps": 6,
            "rpe": 8,
        },
    )

    assert updated_again.strength_model["bench press"]["confidence"] > estimate["confidence"]
    assert updated_again.strength_model["bench press"]["estimated1RM"] != estimate["estimated1RM"]


def test_injury_event_becomes_hard_constraint_rule():
    memory = SemanticMemory(userId="user_1")

    updated = distill_injury_event(
        memory,
        {"bodyRegion": "left shoulder", "severity": 0.9, "note": "pain during dumbbell shoulder press"},
    )

    rules = updated.injury_risk_profile["rules"]

    assert rules[0]["bodyRegion"] == "left shoulder"
    assert "overhead" in rules[0]["contraindicatedPatterns"]
    assert rules[0]["priority"] == "hard_constraint"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_semantic_distiller.py -v
```

Expected: FAIL because `SemanticMemory` lacks `injury_risk_profile` and distiller module does not exist.

- [ ] **Step 3: Extend SemanticMemory**

Modify `backend/app/models/memory.py` by adding fields to `SemanticMemory`:

```python
    preference_model: dict[str, Any] = Field(default_factory=dict, alias="preferenceModel")
    recovery_pattern: dict[str, Any] = Field(default_factory=dict, alias="recoveryPattern")
    injury_risk_profile: dict[str, Any] = Field(
        default_factory=lambda: {"rules": [], "lastReviewedAt": None},
        alias="injuryRiskProfile",
    )
    procedural_refs: dict[str, Any] = Field(default_factory=dict, alias="proceduralRefs")
```

Keep `model_config = {"populate_by_name": True}` unchanged.

- [ ] **Step 4: Create semantic distiller**

Create `backend/app/services/semantic_distiller.py` with:

```python
from copy import deepcopy
from typing import Any

from app.models.memory import SemanticMemory


def _estimate_1rm_epley(weight_kg: float, reps: int) -> float:
    return weight_kg * (1 + reps / 30)


def distill_strength_event(memory: SemanticMemory, event: dict[str, Any]) -> SemanticMemory:
    next_memory = memory.model_copy(deep=True)
    exercise = str(event.get("exerciseName") or event.get("name") or "unknown")
    weight = float(event.get("weightKg") or event.get("weight_kg") or event.get("weight") or 0)
    reps = int(event.get("reps") or 1)
    estimate = round(_estimate_1rm_epley(weight, reps), 2)
    current = deepcopy(next_memory.strength_model.get(exercise))

    if not current:
        next_memory.strength_model[exercise] = {
            "estimated1RM": estimate,
            "confidence": 0.35,
            "samples": 1,
            "method": "epley_bayesian_smoothing",
        }
        return next_memory

    samples = int(current.get("samples") or 1) + 1
    old_confidence = float(current.get("confidence") or 0.35)
    smoothing = min(0.65, 0.25 + samples * 0.05)
    blended = current["estimated1RM"] * (1 - smoothing) + estimate * smoothing
    next_memory.strength_model[exercise] = {
        "estimated1RM": round(blended, 2),
        "confidence": min(0.95, round(old_confidence + 0.12, 2)),
        "samples": samples,
        "method": "epley_bayesian_smoothing",
    }
    return next_memory


def distill_injury_event(memory: SemanticMemory, event: dict[str, Any]) -> SemanticMemory:
    next_memory = memory.model_copy(deep=True)
    profile = dict(next_memory.injury_risk_profile or {"rules": []})
    rules = list(profile.get("rules") or [])
    body_region = str(event.get("bodyRegion") or event.get("body_region") or "unknown")
    note = str(event.get("note") or "")
    patterns = ["overhead"] if "shoulder" in body_region.lower() or "press" in note.lower() else ["high_load"]
    rules.insert(
        0,
        {
            "bodyRegion": body_region,
            "contraindicatedPatterns": patterns,
            "substitutions": ["reduce range of motion", "use bands", "lower RPE target"],
            "priority": "hard_constraint",
            "source": "injury_event",
        },
    )
    profile["rules"] = rules
    next_memory.injury_risk_profile = profile
    return next_memory
```

- [ ] **Step 5: Run semantic distiller tests**

Run:

```bash
cd backend
uv run pytest tests/test_semantic_distiller.py -v
```

Expected: PASS.

- [ ] **Step 6: Run existing memory tests**

Run:

```bash
cd backend
uv run pytest tests/test_memory.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/memory.py backend/app/services/semantic_distiller.py backend/tests/test_semantic_distiller.py backend/tests/test_memory.py
git commit -m "feat: add semantic fitness memory distillation"
```

### Task 5: Procedural Memory and Feedback Loop

**Files:**
- Create: `backend/app/models/procedural.py`
- Create: `backend/app/services/procedural_memory.py`
- Modify: `backend/app/services/db.py`
- Test: `backend/tests/test_procedural_memory.py`

- [ ] **Step 1: Write procedural memory tests**

Create `backend/tests/test_procedural_memory.py` with:

```python
import pytest

from app.config import get_settings
from app.services import db
from app.services.procedural_memory import record_feedback_signal, retrieve_prompt_strategy


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_feedback_signal_updates_prompt_strategy_weight():
    await record_feedback_signal(
        user_id="user_1",
        plan_id="plan_1",
        signal="completed",
        score=0.9,
        communication_style="concise_coaching",
    )

    strategy = await retrieve_prompt_strategy("user_1")

    assert strategy["preferredStyle"] == "concise_coaching"
    assert strategy["confidence"] == 0.6
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_procedural_memory.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.procedural_memory'`.

- [ ] **Step 3: Add procedural memory table**

Modify `backend/app/services/db.py` inside `init_db()` by appending:

```sql
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
```

- [ ] **Step 4: Create procedural models**

Create `backend/app/models/procedural.py` with:

```python
from typing import Any

from pydantic import BaseModel, Field


class PromptStrategy(BaseModel):
    preferred_style: str = Field(default="balanced_coaching", alias="preferredStyle")
    confidence: float = Field(default=0.3, ge=0, le=1)

    model_config = {"populate_by_name": True}


class ProceduralMemory(BaseModel):
    user_id: str = Field(default="user_1", alias="userId")
    plan_templates: list[dict[str, Any]] = Field(default_factory=list, alias="planTemplates")
    prompt_strategy: PromptStrategy = Field(default_factory=PromptStrategy, alias="promptStrategy")
    tool_usage_pattern: dict[str, Any] = Field(default_factory=dict, alias="toolUsagePattern")
    feedback_loop: list[dict[str, Any]] = Field(default_factory=list, alias="feedbackLoop")

    model_config = {"populate_by_name": True}
```

- [ ] **Step 5: Create procedural memory service**

Create `backend/app/services/procedural_memory.py` with:

```python
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
```

- [ ] **Step 6: Run procedural tests**

Run:

```bash
cd backend
uv run pytest tests/test_procedural_memory.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/procedural.py backend/app/services/procedural_memory.py backend/app/services/db.py backend/tests/test_procedural_memory.py
git commit -m "feat: add procedural memory feedback loop"
```

### Task 6: Budgeted Memory Context Injection

**Files:**
- Create: `backend/app/services/context_budget.py`
- Modify: `backend/app/services/memory.py`
- Modify: `backend/app/agent/nodes/context_builder.py`
- Modify: `backend/app/agent/state.py`
- Test: `backend/tests/test_context_budget.py`
- Test: `backend/tests/test_memory.py`

- [ ] **Step 1: Write context budget tests**

Create `backend/tests/test_context_budget.py` with:

```python
from app.services.context_budget import build_budgeted_context


def test_budgeted_context_always_includes_full_injury_profile():
    context = build_budgeted_context(
        injury_risk_profile={
            "rules": [
                {"bodyRegion": "left shoulder", "contraindicatedPatterns": ["overhead"], "priority": "hard_constraint"}
            ]
        },
        current_goal={"primaryGoal": "fat_loss", "phase": "base"},
        prompt_strategy={"preferredStyle": "concise_coaching"},
        recent_sets=[{"exerciseName": "bench press", "weightKg": 80, "reps": 8}],
        fatigue={"weeklyFatigue": 0.7, "hrvTrend": "down"},
        strength_model={"bench press": {"estimated1RM": 101.3, "confidence": 0.35}},
        similar_episodes=[{"summary": "Similar high-fatigue upper body day"}],
        max_tokens=2000,
    )

    system = context["systemPrompt"]
    session = context["sessionPrompt"]
    dynamic = context["dynamicRecall"]

    assert "left shoulder" in system
    assert "hard_constraint" in system
    assert "fat_loss" in system
    assert "bench press" in session
    assert "Similar high-fatigue" in dynamic
    assert context["estimatedTokens"] <= 2000
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_context_budget.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.context_budget'`.

- [ ] **Step 3: Create context budget service**

Create `backend/app/services/context_budget.py` with:

```python
import json
from typing import Any


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _json_line(label: str, value: Any) -> str:
    return f"- {label}: {json.dumps(value, ensure_ascii=False, separators=(',', ':'))}"


def build_budgeted_context(
    injury_risk_profile: dict[str, Any],
    current_goal: dict[str, Any],
    prompt_strategy: dict[str, Any],
    recent_sets: list[dict[str, Any]],
    fatigue: dict[str, Any],
    strength_model: dict[str, Any],
    similar_episodes: list[dict[str, Any]],
    max_tokens: int = 2000,
) -> dict[str, Any]:
    system_lines = [
        "## System Memory",
        _json_line("InjuryRiskProfile", injury_risk_profile),
        _json_line("CurrentGoal", current_goal),
        _json_line("PromptStrategy", prompt_strategy),
    ]
    session_lines = [
        "## Session Memory",
        _json_line("RecentSameTypeSetRecords", recent_sets[:3]),
        _json_line("FatigueAndHRV", fatigue),
        _json_line("StrengthModel", strength_model),
    ]
    dynamic_lines = [
        "## Dynamic Recall",
        _json_line("SimilarHistoricalEpisodes", similar_episodes[:3]),
    ]

    system_prompt = "\n".join(system_lines)
    session_prompt = "\n".join(session_lines)
    dynamic_recall = "\n".join(dynamic_lines)
    estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    if estimated > max_tokens:
        dynamic_recall = "## Dynamic Recall\n- SimilarHistoricalEpisodes: []"
        estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    if estimated > max_tokens:
        session_prompt = "\n".join(
            [
                "## Session Memory",
                _json_line("RecentSameTypeSetRecords", recent_sets[:1]),
                _json_line("FatigueAndHRV", fatigue),
                _json_line("StrengthModel", strength_model),
            ]
        )
        estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    return {
        "systemPrompt": system_prompt,
        "sessionPrompt": session_prompt,
        "dynamicRecall": dynamic_recall,
        "estimatedTokens": estimated,
    }
```

- [ ] **Step 4: Add state fields**

Modify `backend/app/agent/state.py` by adding these optional fields to `AgentState`:

```python
    fitness_session_state: dict[str, Any]
    context_sections: dict[str, Any]
    modality_route: str
    plan_execution: dict[str, Any]
    safety_issues: list[dict[str, Any]]
```

- [ ] **Step 5: Use budgeted sections in context builder**

Modify `backend/app/agent/nodes/context_builder.py` so the returned state includes `context_sections`. Keep `memory_prompt` for compatibility:

```python
    formatted_prompt = format_context_as_system_prompt(context)

    return {
        **state,
        "semantic_memory": context.semantic_memory.model_dump(by_alias=True),
        "episodic_memory": context.recent_episodes,
        "working_memory": context.working_memory.model_dump(by_alias=True),
        "memory_prompt": formatted_prompt,
        "context_sections": getattr(context, "context_sections", {"legacy": formatted_prompt}),
        "messages": messages,
    }
```

- [ ] **Step 6: Run context and existing memory tests**

Run:

```bash
cd backend
uv run pytest tests/test_context_budget.py tests/test_memory.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/context_budget.py backend/app/services/memory.py backend/app/agent/nodes/context_builder.py backend/app/agent/state.py backend/tests/test_context_budget.py backend/tests/test_memory.py
git commit -m "feat: add budgeted memory context injection"
```

### Task 7: FitnessSessionManager Integration

**Files:**
- Create: `backend/app/services/session_manager.py`
- Modify: `backend/app/services/memory.py`
- Modify: `backend/app/agent/nodes/context_builder.py`
- Test: `backend/tests/test_session_manager.py`

- [ ] **Step 1: Add session manager test**

Append to `backend/tests/test_session_manager.py`:

```python
import pytest

from app.config import get_settings
from app.services import db
from app.services.session_manager import FitnessSessionManager


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_session_manager_builds_global_context_with_dynamic_profile():
    manager = FitnessSessionManager()

    state = await manager.load_state(
        user_id="user_1",
        session_id="session_1",
        chat_history=[{"role": "user", "content": "今天有点累"}],
    )

    payload = state.model_dump(by_alias=True)

    assert payload["userId"] == "user_1"
    assert "static" in payload["profile"]
    assert "dynamic" in payload["profile"]
    assert payload["currentPlan"]["status"] in {"none", "draft", "active", "paused", "completed"}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_session_manager.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.session_manager'`.

- [ ] **Step 3: Create session manager**

Create `backend/app/services/session_manager.py` with:

```python
from app.models.memory import SemanticMemory
from app.models.session import (
    ActivePlan,
    DynamicFitnessProfile,
    FitnessSessionState,
    GoalContext,
    StaticFitnessProfile,
    UserFitnessProfile,
)
from app.services.db import DEFAULT_USER_ID, get_episodic_memories
from app.services.memory import get_or_init_semantic_memory


class FitnessSessionManager:
    async def load_state(
        self,
        user_id: str = DEFAULT_USER_ID,
        session_id: str | None = None,
        chat_history: list[dict] | None = None,
    ) -> FitnessSessionState:
        del session_id, chat_history
        semantic = SemanticMemory.model_validate(await get_or_init_semantic_memory(user_id))
        profile = semantic.user_profile
        recent = await get_episodic_memories(user_id, 10)
        primary_goal = profile.goals[0] if profile.goals else "general_fitness"

        return FitnessSessionState(
            userId=user_id,
            profile=UserFitnessProfile(
                static=StaticFitnessProfile(
                    injuryHistory=profile.injury_history,
                    trainingExperience="unknown",
                ),
                dynamic=DynamicFitnessProfile(
                    weeklyFatigue=float((semantic.weekly_training_stats or {}).get("fatigueScore") or 0),
                    hrvTrend=str((semantic.recovery_pattern or {}).get("hrvTrend") or "unknown"),
                ),
            ),
            history=recent,
            currentPlan=ActivePlan(status="none"),
            goals=GoalContext(primaryGoal=primary_goal),
            latestBiometrics=None,
        )
```

- [ ] **Step 4: Run session manager tests**

Run:

```bash
cd backend
uv run pytest tests/test_session_manager.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/session_manager.py backend/tests/test_session_manager.py
git commit -m "feat: add fitness session manager"
```

### Task 8: Structured Plan DSL and SafetyGuard

**Files:**
- Create: `backend/app/models/planning.py`
- Create: `backend/app/agent/planning/dsl.py`
- Create: `backend/app/agent/planning/safety_guard.py`
- Test: `backend/tests/test_safety_guard.py`

- [ ] **Step 1: Write SafetyGuard tests**

Create `backend/tests/test_safety_guard.py` with:

```python
from app.agent.planning.safety_guard import SafetyGuard
from app.models.planning import PlanSession, WeeklyPlanDSL


def test_safety_guard_rejects_high_rpe_for_beginner():
    guard = SafetyGuard()
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=5,
        sessions=[
            PlanSession(day="Monday", type="strength", duration=60, intensity=0.8, rpeTarget=9.5),
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "beginner", "injuryHistory": []},
            "dynamic": {"weeklyFatigue": 0.2, "hrvTrend": "flat"},
        }
    }

    result = guard.check(state, plan)

    assert result.allowed is False
    assert result.issues[0].code == "rpe_too_high"


def test_safety_guard_adds_injury_constraint_substitution():
    guard = SafetyGuard()
    plan = WeeklyPlanDSL(
        goal="muscle_gain",
        days=3,
        sessions=[
            PlanSession(
                day="Wednesday",
                type="strength",
                duration=45,
                intensity=0.7,
                rpeTarget=7,
                exercises=[{"name": "dumbbell shoulder press"}],
            ),
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "intermediate", "injuryHistory": ["left shoulder"]},
            "dynamic": {"weeklyFatigue": 0.2, "hrvTrend": "flat"},
        },
        "semanticMemory": {
            "injuryRiskProfile": {
                "rules": [
                    {
                        "bodyRegion": "left shoulder",
                        "contraindicatedPatterns": ["overhead", "shoulder press"],
                        "substitutions": ["band external rotation", "landmine press"],
                        "priority": "hard_constraint",
                    }
                ]
            }
        },
    }

    result = guard.check(state, plan)

    assert result.allowed is False
    assert result.issues[0].code == "injury_contraindication"
    assert "landmine press" in result.issues[0].suggestions
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_safety_guard.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agent.planning'`.

- [ ] **Step 3: Create planning models**

Create `backend/app/models/planning.py` with:

```python
from typing import Any, Literal

from pydantic import BaseModel, Field


class PlanSession(BaseModel):
    day: str
    type: Literal["HIIT", "strength", "cardio", "mobility", "recovery"]
    duration: int = Field(ge=1, le=180)
    intensity: float = Field(default=0.6, ge=0, le=1)
    rpe_target: float = Field(default=7, ge=1, le=10, alias="rpeTarget")
    muscles: list[str] = Field(default_factory=list)
    exercises: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class WeeklyPlanDSL(BaseModel):
    goal: str
    days: int = Field(ge=1, le=7)
    sessions: list[PlanSession] = Field(default_factory=list)


class SafetyIssue(BaseModel):
    code: str
    message: str
    severity: Literal["warning", "blocker"]
    suggestions: list[str] = Field(default_factory=list)


class SafetyResult(BaseModel):
    allowed: bool
    issues: list[SafetyIssue] = Field(default_factory=list)


class PlanExecutionResult(BaseModel):
    plan: WeeklyPlanDSL
    safety: SafetyResult
    tool_results: list[dict[str, Any]] = Field(default_factory=list, alias="toolResults")
    rendered_markdown: str = Field(default="", alias="renderedMarkdown")

    model_config = {"populate_by_name": True}
```

- [ ] **Step 4: Create DSL helper**

Create `backend/app/agent/planning/dsl.py` with:

```python
from app.models.planning import PlanSession, WeeklyPlanDSL


def create_weekly_plan(goal: str, days: int) -> WeeklyPlanDSL:
    return WeeklyPlanDSL(goal=goal, days=days, sessions=[])


def add_session(plan: WeeklyPlanDSL, session: PlanSession) -> WeeklyPlanDSL:
    next_plan = plan.model_copy(deep=True)
    next_plan.sessions.append(session)
    return next_plan
```

- [ ] **Step 5: Create SafetyGuard**

Create `backend/app/agent/planning/safety_guard.py` with:

```python
from typing import Any

from app.models.planning import SafetyIssue, SafetyResult, WeeklyPlanDSL


class SafetyGuard:
    def check(self, state: dict[str, Any], plan: WeeklyPlanDSL) -> SafetyResult:
        issues: list[SafetyIssue] = []
        profile = state.get("profile") or {}
        static = profile.get("static") or {}
        dynamic = profile.get("dynamic") or {}
        training_experience = static.get("trainingExperience") or static.get("training_experience") or "unknown"
        fatigue = float(dynamic.get("weeklyFatigue") or 0)

        if training_experience == "beginner":
            for session in plan.sessions:
                if session.rpe_target > 8:
                    issues.append(
                        SafetyIssue(
                            code="rpe_too_high",
                            message=f"{session.day} targets RPE {session.rpe_target}, which is too high for a beginner.",
                            severity="blocker",
                            suggestions=["cap RPE at 7.5", "reduce load", "add rest intervals"],
                        )
                    )

        if fatigue >= 0.75 and plan.days >= 5:
            issues.append(
                SafetyIssue(
                    code="frequency_recovery_conflict",
                    message="Weekly fatigue is high and planned frequency leaves too little recovery.",
                    severity="blocker",
                    suggestions=["reduce to 3 training days", "replace HIIT with mobility"],
                )
            )

        injury_rules = (
            (state.get("semanticMemory") or {})
            .get("injuryRiskProfile", {})
            .get("rules", [])
        )
        for rule in injury_rules:
            patterns = [str(item).lower() for item in rule.get("contraindicatedPatterns") or []]
            substitutions = [str(item) for item in rule.get("substitutions") or []]
            for session in plan.sessions:
                exercise_names = " ".join(str(item.get("name") or "").lower() for item in session.exercises)
                if any(pattern in exercise_names for pattern in patterns):
                    issues.append(
                        SafetyIssue(
                            code="injury_contraindication",
                            message=f"{session.day} contains a pattern blocked by {rule.get('bodyRegion')}.",
                            severity="blocker",
                            suggestions=substitutions,
                        )
                    )

        return SafetyResult(allowed=not any(issue.severity == "blocker" for issue in issues), issues=issues)
```

- [ ] **Step 6: Run SafetyGuard tests**

Run:

```bash
cd backend
uv run pytest tests/test_safety_guard.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/planning.py backend/app/agent/planning/dsl.py backend/app/agent/planning/safety_guard.py backend/tests/test_safety_guard.py
git commit -m "feat: add workout plan safety guard"
```

### Task 9: FitnessToolRegistry and Domain Tools

**Files:**
- Create: `backend/app/agent/tools/registry.py`
- Create: `backend/app/agent/tools/domain_tools.py`
- Modify: `backend/app/agent/tools/__init__.py`
- Modify: `backend/app/agent/nodes/supervisor_agent.py`
- Test: `backend/tests/test_fitness_tool_registry.py`

- [ ] **Step 1: Write registry tests**

Create `backend/tests/test_fitness_tool_registry.py` with:

```python
from app.agent.tools.registry import build_fitness_tool_registry


def test_fitness_registry_exposes_core_domain_tools_with_schema():
    registry = build_fitness_tool_registry()

    names = registry.names()
    schema = registry.json_schema()

    assert "exercise_library" in names
    assert "injury_risk_assessor" in names
    assert "recovery_advisor" in names
    assert "competition_planner" in names
    assert schema["exercise_library"]["description"]
    assert "target_muscles" in schema["exercise_library"]["parameters"]["properties"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_fitness_tool_registry.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agent.tools.registry'`.

- [ ] **Step 3: Create registry**

Create `backend/app/agent/tools/registry.py` with:

```python
from dataclasses import dataclass
from typing import Any, Awaitable, Callable


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class FitnessToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: ToolHandler


class FitnessToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, FitnessToolSpec] = {}

    def register(self, spec: FitnessToolSpec) -> None:
        self._tools[spec.name] = spec

    def get(self, name: str) -> FitnessToolSpec | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return sorted(self._tools.keys())

    def json_schema(self) -> dict[str, Any]:
        return {
            name: {"description": spec.description, "parameters": spec.parameters}
            for name, spec in self._tools.items()
        }


def build_fitness_tool_registry() -> FitnessToolRegistry:
    from app.agent.tools.domain_tools import CORE_FITNESS_TOOLS

    registry = FitnessToolRegistry()
    for spec in CORE_FITNESS_TOOLS:
        registry.register(spec)
    return registry
```

- [ ] **Step 4: Create domain tool specs**

Create `backend/app/agent/tools/domain_tools.py` with:

```python
from typing import Any

from app.agent.tools.registry import FitnessToolSpec


async def exercise_library_handler(args: dict[str, Any]) -> dict[str, Any]:
    target_muscles = args.get("target_muscles") or []
    equipment = args.get("equipment") or []
    return {
        "exercises": [
            {
                "name": "bench press" if "chest" in target_muscles else "goblet squat",
                "targetMuscles": target_muscles,
                "equipment": equipment,
                "coachingCues": ["controlled eccentric", "stop with two reps in reserve"],
            }
        ]
    }


async def injury_risk_assessor_handler(args: dict[str, Any]) -> dict[str, Any]:
    profile = args.get("user_profile") or {}
    plan = args.get("plan") or {}
    injuries = str(profile.get("injuryHistory") or profile.get("injury_history") or "").lower()
    plan_text = str(plan).lower()
    score = 0.75 if "shoulder" in injuries and "press" in plan_text else 0.2
    return {
        "score": score,
        "riskLevel": "high" if score > 0.6 else "low",
        "alternatives": ["landmine press", "band external rotation"] if score > 0.6 else [],
    }


async def recovery_advisor_handler(args: dict[str, Any]) -> dict[str, Any]:
    hrv_trend = str(args.get("hrv_trend") or "unknown")
    sleep_score = float(args.get("sleep_score") or 70)
    readiness = 0.45 if hrv_trend == "down" or sleep_score < 60 else 0.8
    return {"readinessScore": readiness, "recommendation": "reduce_intensity" if readiness < 0.6 else "train_as_planned"}


async def competition_planner_handler(args: dict[str, Any]) -> dict[str, Any]:
    event_date = args.get("event_date")
    return {
        "periodization": [
            {"phase": "hypertrophy", "weeks": 4},
            {"phase": "strength", "weeks": 4},
            {"phase": "peak", "weeks": 2},
        ],
        "eventDate": event_date,
    }


CORE_FITNESS_TOOLS = [
    FitnessToolSpec(
        name="exercise_library",
        description="Return executable exercises and coaching cues for target muscles and equipment.",
        parameters={
            "type": "object",
            "properties": {
                "target_muscles": {"type": "array", "items": {"type": "string"}},
                "equipment": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["target_muscles"],
        },
        handler=exercise_library_handler,
    ),
    FitnessToolSpec(
        name="injury_risk_assessor",
        description="Assess injury risk from user profile, fatigue, and proposed plan intensity.",
        parameters={
            "type": "object",
            "properties": {
                "user_profile": {"type": "object"},
                "plan": {"type": "object"},
            },
            "required": ["user_profile", "plan"],
        },
        handler=injury_risk_assessor_handler,
    ),
    FitnessToolSpec(
        name="recovery_advisor",
        description="Assess recovery from HRV, sleep, soreness, and fatigue signals.",
        parameters={
            "type": "object",
            "properties": {
                "hrv_trend": {"type": "string"},
                "sleep_score": {"type": "number"},
            },
            "required": [],
        },
        handler=recovery_advisor_handler,
    ),
    FitnessToolSpec(
        name="competition_planner",
        description="Build periodized phases for competition preparation.",
        parameters={
            "type": "object",
            "properties": {
                "event_date": {"type": "string"},
                "sport": {"type": "string"},
            },
            "required": ["event_date"],
        },
        handler=competition_planner_handler,
    ),
]
```

- [ ] **Step 5: Run registry tests**

Run:

```bash
cd backend
uv run pytest tests/test_fitness_tool_registry.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/tools/registry.py backend/app/agent/tools/domain_tools.py backend/tests/test_fitness_tool_registry.py
git commit -m "feat: add fitness domain tool registry"
```

### Task 10: WorkoutPlanExecutor

**Files:**
- Create: `backend/app/agent/planning/executor.py`
- Create: `backend/app/agent/planning/renderers.py`
- Modify: `backend/app/agent/tools/domain_tools.py`
- Test: `backend/tests/test_workout_plan_executor.py`

- [ ] **Step 1: Write executor tests**

Create `backend/tests/test_workout_plan_executor.py` with:

```python
from app.agent.planning.executor import WorkoutPlanExecutor
from app.agent.tools.registry import build_fitness_tool_registry
from app.models.planning import PlanSession, WeeklyPlanDSL


async def test_executor_blocks_unsafe_plan_before_tool_execution():
    executor = WorkoutPlanExecutor(registry=build_fitness_tool_registry())
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=5,
        sessions=[PlanSession(day="Monday", type="strength", duration=45, rpeTarget=9.5)],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "beginner"},
            "dynamic": {"weeklyFatigue": 0.2},
        }
    }

    result = await executor.execute(plan, state)

    assert result.safety.allowed is False
    assert result.tool_results == []
    assert "rpe_too_high" in result.rendered_markdown


async def test_executor_runs_domain_tools_for_safe_plan():
    executor = WorkoutPlanExecutor(registry=build_fitness_tool_registry())
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=3,
        sessions=[
            PlanSession(
                day="Monday",
                type="strength",
                duration=45,
                rpeTarget=7,
                muscles=["chest"],
            )
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "intermediate", "injuryHistory": []},
            "dynamic": {"weeklyFatigue": 0.2},
        }
    }

    result = await executor.execute(plan, state)

    assert result.safety.allowed is True
    assert result.tool_results[0]["tool"] == "exercise_library"
    assert "Monday" in result.rendered_markdown
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_workout_plan_executor.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agent.planning.executor'`.

- [ ] **Step 3: Create renderers**

Create `backend/app/agent/planning/renderers.py` with:

```python
from app.models.planning import PlanExecutionResult, SafetyResult, WeeklyPlanDSL


def render_safety_result(safety: SafetyResult) -> str:
    if safety.allowed:
        return "SafetyGuard: allowed"
    lines = ["SafetyGuard: blocked"]
    for issue in safety.issues:
        lines.append(f"- {issue.code}: {issue.message}")
        if issue.suggestions:
            lines.append(f"  Suggestions: {', '.join(issue.suggestions)}")
    return "\n".join(lines)


def render_plan(plan: WeeklyPlanDSL) -> str:
    lines = [f"Plan goal: {plan.goal}", f"Training days: {plan.days}"]
    for session in plan.sessions:
        lines.append(f"- {session.day}: {session.type}, {session.duration} min, RPE {session.rpe_target}")
    return "\n".join(lines)


def render_execution_result(result: PlanExecutionResult) -> str:
    return "\n\n".join([render_safety_result(result.safety), render_plan(result.plan)])
```

- [ ] **Step 4: Create executor**

Create `backend/app/agent/planning/executor.py` with:

```python
from typing import Any

from app.agent.planning.renderers import render_execution_result
from app.agent.planning.safety_guard import SafetyGuard
from app.agent.tools.registry import FitnessToolRegistry, build_fitness_tool_registry
from app.models.planning import PlanExecutionResult, WeeklyPlanDSL


class WorkoutPlanExecutor:
    def __init__(
        self,
        registry: FitnessToolRegistry | None = None,
        safety_guard: SafetyGuard | None = None,
    ) -> None:
        self.registry = registry or build_fitness_tool_registry()
        self.safety_guard = safety_guard or SafetyGuard()

    async def execute(self, plan: WeeklyPlanDSL, state: dict[str, Any]) -> PlanExecutionResult:
        safety = self.safety_guard.check(state, plan)
        if not safety.allowed:
            result = PlanExecutionResult(plan=plan, safety=safety, toolResults=[])
            result.rendered_markdown = render_execution_result(result)
            return result

        tool_results: list[dict[str, Any]] = []
        exercise_tool = self.registry.get("exercise_library")
        if exercise_tool:
            for session in plan.sessions:
                if session.type == "strength":
                    response = await exercise_tool.handler(
                        {
                            "target_muscles": session.muscles,
                            "equipment": ["bodyweight", "dumbbell", "barbell"],
                        }
                    )
                    tool_results.append({"tool": "exercise_library", "day": session.day, "result": response})

        result = PlanExecutionResult(plan=plan, safety=safety, toolResults=tool_results)
        result.rendered_markdown = render_execution_result(result)
        return result
```

- [ ] **Step 5: Run executor tests**

Run:

```bash
cd backend
uv run pytest tests/test_workout_plan_executor.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/planning/executor.py backend/app/agent/planning/renderers.py backend/tests/test_workout_plan_executor.py
git commit -m "feat: add workout plan executor"
```

### Task 11: Multisource Bridges and Modality Router

**Files:**
- Create: `backend/app/agent/bridges/base.py`
- Create: `backend/app/agent/bridges/biometric.py`
- Create: `backend/app/agent/bridges/wearable.py`
- Create: `backend/app/agent/bridges/nutrition.py`
- Create: `backend/app/agent/bridges/video_analysis.py`
- Create: `backend/app/agent/bridges/state.py`
- Create: `backend/app/agent/bridges/router.py`
- Test: `backend/tests/test_bridges.py`

- [ ] **Step 1: Write bridge tests**

Create `backend/tests/test_bridges.py` with:

```python
from app.agent.bridges.router import route_modality
from app.agent.bridges.wearable import WearableBridge


def test_wearable_bridge_normalizes_vendor_payloads_to_domain_schema():
    bridge = WearableBridge()

    apple = bridge.normalize(
        "apple_health",
        {
            "averageHeartRate": 74,
            "maxHeartRate": 158,
            "hrvSDNN": 48,
            "sleepAnalysisScore": 82,
            "startDate": "2026-05-04T07:00:00+08:00",
        },
    )
    garmin = bridge.normalize(
        "garmin",
        {
            "avgHr": 76,
            "maxHr": 162,
            "lastNightHrv": 45,
            "sleepScore": 78,
            "timestamp": "2026-05-04T07:05:00+08:00",
        },
    )

    assert apple["source"] == "apple_health"
    assert apple["heartRateAvg"] == 74
    assert garmin["hrvMs"] == 45
    assert set(apple.keys()) == set(garmin.keys())


def test_modality_router_selects_visual_paths():
    assert route_modality(has_image=True, has_video=False, user_message="午餐照片") == "nutrition_image"
    assert route_modality(has_image=False, has_video=True, user_message="帮我看深蹲姿态") == "video_analysis"
    assert route_modality(has_image=False, has_video=False, user_message="今天练胸") == "text"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_bridges.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agent.bridges'`.

- [ ] **Step 3: Create base bridge schemas**

Create `backend/app/agent/bridges/base.py` with:

```python
from typing import Any, Protocol


NormalizedPayload = dict[str, Any]


class Bridge(Protocol):
    name: str

    async def handle(self, payload: dict[str, Any]) -> NormalizedPayload:
        ...
```

- [ ] **Step 4: Create wearable bridge**

Create `backend/app/agent/bridges/wearable.py` with:

```python
from typing import Any


class WearableBridge:
    name = "wearable"

    def normalize(self, source: str, payload: dict[str, Any]) -> dict[str, Any]:
        if source == "apple_health":
            captured_at = payload.get("startDate")
            avg = payload.get("averageHeartRate")
            peak = payload.get("maxHeartRate")
            hrv = payload.get("hrvSDNN")
            sleep = payload.get("sleepAnalysisScore")
        elif source == "garmin":
            captured_at = payload.get("timestamp")
            avg = payload.get("avgHr")
            peak = payload.get("maxHr")
            hrv = payload.get("lastNightHrv")
            sleep = payload.get("sleepScore")
        elif source == "xiaomi":
            captured_at = payload.get("time")
            avg = payload.get("heart_rate_avg")
            peak = payload.get("heart_rate_max")
            hrv = payload.get("hrv")
            sleep = payload.get("sleep_score")
        else:
            captured_at = payload.get("capturedAt")
            avg = payload.get("heartRateAvg")
            peak = payload.get("heartRatePeak")
            hrv = payload.get("hrvMs")
            sleep = payload.get("sleepScore")

        return {
            "source": source,
            "capturedAt": captured_at,
            "heartRateAvg": avg,
            "heartRatePeak": peak,
            "hrvMs": hrv,
            "sleepScore": sleep,
            "steps": payload.get("steps"),
        }
```

- [ ] **Step 5: Create router and bridge stubs**

Create `backend/app/agent/bridges/router.py` with:

```python
def route_modality(has_image: bool, has_video: bool, user_message: str) -> str:
    text = user_message.lower()
    if has_video:
        return "video_analysis"
    if has_image and any(word in text for word in ["餐", "饭", "food", "meal", "午餐", "早餐", "晚餐"]):
        return "nutrition_image"
    if has_image:
        return "image_general"
    return "text"
```

Create `backend/app/agent/bridges/biometric.py` with:

```python
from typing import Any


class BiometricBridge:
    name = "biometric"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "biometric", "payload": payload}
```

Create `backend/app/agent/bridges/nutrition.py` with:

```python
from typing import Any


class NutritionBridge:
    name = "nutrition"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "nutrition", "payload": payload}
```

Create `backend/app/agent/bridges/video_analysis.py` with:

```python
from typing import Any


class VideoAnalysisBridge:
    name = "video_analysis"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "type": "video_analysis",
            "formScore": 0.0,
            "findings": [],
            "payload": payload,
        }
```

Create `backend/app/agent/bridges/state.py` with:

```python
from typing import Any


class StateBridge:
    name = "state"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "state", "payload": payload}
```

- [ ] **Step 6: Run bridge tests**

Run:

```bash
cd backend
uv run pytest tests/test_bridges.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/agent/bridges backend/tests/test_bridges.py
git commit -m "feat: add fitness data bridges"
```

### Task 12: Agent Graph Integration for Router, Registry, and Safety Context

**Files:**
- Modify: `backend/app/agent/nodes/context_builder.py`
- Modify: `backend/app/agent/nodes/tool_executor.py`
- Modify: `backend/app/agent/nodes/supervisor_agent.py`
- Modify: `backend/app/agent/tools/__init__.py`
- Modify: `backend/tests/test_agent.py`

- [ ] **Step 1: Add agent integration test**

Append to `backend/tests/test_agent.py`:

```python
from app.agent.bridges.router import route_modality
from app.agent.nodes.supervisor_agent import SYSTEM_PROMPT_TEMPLATE


def test_supervisor_prompt_contains_safety_first_constraints():
    assert "SafetyGuard" in SYSTEM_PROMPT_TEMPLATE
    assert "medical contraindications" in SYSTEM_PROMPT_TEMPLATE
    assert "never override" in SYSTEM_PROMPT_TEMPLATE


def test_image_food_route_is_available_to_tool_executor():
    assert route_modality(True, False, "帮我识别午餐照片") == "nutrition_image"
```

- [ ] **Step 2: Run agent test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_agent.py -v
```

Expected: FAIL because the prompt does not mention the new safety constraints.

- [ ] **Step 3: Update supervisor prompt**

Modify `SYSTEM_PROMPT_TEMPLATE` in `backend/app/agent/nodes/supervisor_agent.py` by adding this section before `## Guidelines`:

```text
## SafetyGuard and immutable medical variables
Medical contraindications, joint limits, and injury-risk rules are immutable system variables.
You must never override, ignore, or soften those constraints.
When creating or updating workout plans, call the plan execution path so SafetyGuard can inspect RPE, frequency, recovery windows, and injury contraindications before the plan is shown as actionable.
```

- [ ] **Step 4: Keep tool exports stable**

Modify `backend/app/agent/tools/__init__.py` so existing `TOOLS` and `TOOLS_BY_NAME` still exist after registry additions. Keep all current LangChain `@tool` functions available, and add a helper:

```python
from app.agent.tools.registry import build_fitness_tool_registry


FITNESS_TOOL_REGISTRY = build_fitness_tool_registry()
FITNESS_TOOL_SCHEMAS = FITNESS_TOOL_REGISTRY.json_schema()
```

- [ ] **Step 5: Run agent tests**

Run:

```bash
cd backend
uv run pytest tests/test_agent.py tests/test_fitness_tool_registry.py tests/test_bridges.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/nodes/supervisor_agent.py backend/app/agent/tools/__init__.py backend/tests/test_agent.py
git commit -m "feat: integrate safety context into agent graph"
```

### Task 13: Plan Preview, Confirmation, and Feedback APIs

**Files:**
- Create: `backend/app/api/plans.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/episodic_memory.py`
- Modify: `backend/app/services/procedural_memory.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Add API tests**

Append to `backend/tests/test_api.py`:

```python
def test_plan_preview_blocks_unsafe_payload(client):
    response = client.post(
        "/api/plans/preview",
        json={
            "userId": "user_1",
            "plan": {
                "goal": "fat_loss",
                "days": 5,
                "sessions": [
                    {"day": "Monday", "type": "strength", "duration": 45, "rpeTarget": 9.5}
                ],
            },
            "state": {
                "profile": {
                    "static": {"trainingExperience": "beginner"},
                    "dynamic": {"weeklyFatigue": 0.2}
                }
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["safety"]["allowed"] is False


def test_plan_feedback_records_signal(client):
    response = client.post(
        "/api/plans/feedback",
        json={
            "userId": "user_1",
            "planId": "plan_1",
            "signal": "completed",
            "score": 0.9,
            "communicationStyle": "concise_coaching",
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
```

- [ ] **Step 2: Run API tests to verify they fail**

Run:

```bash
cd backend
uv run pytest tests/test_api.py -v
```

Expected: FAIL with 404 for `/api/plans/preview`.

- [ ] **Step 3: Create plans router**

Create `backend/app/api/plans.py` with:

```python
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agent.planning.executor import WorkoutPlanExecutor
from app.models.planning import WeeklyPlanDSL
from app.services.procedural_memory import record_feedback_signal


router = APIRouter(prefix="/plans", tags=["plans"])


class PlanPreviewRequest(BaseModel):
    user_id: str = Field(default="user_1", alias="userId")
    plan: WeeklyPlanDSL
    state: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class PlanFeedbackRequest(BaseModel):
    user_id: str = Field(default="user_1", alias="userId")
    plan_id: str | None = Field(default=None, alias="planId")
    signal: str
    score: float
    communication_style: str | None = Field(default=None, alias="communicationStyle")

    model_config = {"populate_by_name": True}


@router.post("/preview")
async def preview_plan(request: PlanPreviewRequest):
    executor = WorkoutPlanExecutor()
    result = await executor.execute(request.plan, request.state)
    return {"success": True, "data": result.model_dump(by_alias=True)}


@router.post("/feedback")
async def feedback(request: PlanFeedbackRequest):
    signal = await record_feedback_signal(
        user_id=request.user_id,
        plan_id=request.plan_id,
        signal=request.signal,
        score=request.score,
        communication_style=request.communication_style,
    )
    return {"success": True, "data": signal}
```

- [ ] **Step 4: Include router in app**

Modify `backend/app/main.py`:

```python
from app.api.plans import router as plans_router
```

Add:

```python
app.include_router(plans_router, prefix="/api")
```

- [ ] **Step 5: Run API tests**

Run:

```bash
cd backend
uv run pytest tests/test_api.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/plans.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add plan preview and feedback APIs"
```

### Task 14: Observability for Workout and Biometric Spans

**Files:**
- Create: `backend/app/observability/fitness_tracing.py`
- Modify: `backend/app/services/db.py`
- Modify: `backend/app/agent/planning/executor.py`
- Test: `backend/tests/test_observability.py`

- [ ] **Step 1: Write observability tests**

Create `backend/tests/test_observability.py` with:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_observability.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.observability'`.

- [ ] **Step 3: Add observation events table**

Modify `backend/app/services/db.py` inside `init_db()`:

```sql
            CREATE TABLE IF NOT EXISTS observation_events (
              id TEXT PRIMARY KEY,
              span_type TEXT NOT NULL,
              event_type TEXT NOT NULL,
              metadata_json TEXT NOT NULL,
              started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              ended_at DATETIME
            );
```

- [ ] **Step 4: Create tracer**

Create `backend/app/observability/fitness_tracing.py` with:

```python
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
```

- [ ] **Step 5: Run observability tests**

Run:

```bash
cd backend
uv run pytest tests/test_observability.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/observability/fitness_tracing.py backend/app/services/db.py backend/tests/test_observability.py
git commit -m "feat: add fitness observability spans"
```

### Task 15: Memory Updater Lifecycle for Plan Drafts and Semantic Diffs

**Files:**
- Modify: `backend/app/agent/nodes/memory_updater.py`
- Modify: `backend/app/services/memory.py`
- Modify: `backend/app/services/episodic_memory.py`
- Modify: `backend/app/services/semantic_distiller.py`
- Test: `backend/tests/test_agent.py`
- Test: `backend/tests/test_semantic_distiller.py`

- [ ] **Step 1: Add lifecycle tests**

Append to `backend/tests/test_agent.py`:

```python
from app.agent.nodes.memory_updater import _infer_intent


def test_memory_updater_infers_plan_intent_from_plan_execution():
    intent = _infer_intent(
        {
            "plan_execution": {
                "plan": {"goal": "fat_loss", "sessions": []},
                "safety": {"allowed": True},
            }
        }
    )

    assert intent == "generate_workout_plan"
```

- [ ] **Step 2: Run lifecycle test to verify it fails**

Run:

```bash
cd backend
uv run pytest tests/test_agent.py -v
```

Expected: FAIL because `_infer_intent` does not inspect `plan_execution`.

- [ ] **Step 3: Update intent inference**

Modify `_infer_intent` in `backend/app/agent/nodes/memory_updater.py`:

```python
    if state.get("plan_execution"):
        return "generate_workout_plan"
```

Place this check before reading `structured_data`.

- [ ] **Step 4: Add semantic diff call for strength workouts**

Modify `memory_updater_node` in `backend/app/agent/nodes/memory_updater.py` after chat messages are written:

```python
    if intent == "log_strength_workout" and isinstance(data.get("exercises"), list):
        from app.models.memory import SemanticMemory
        from app.services.memory import get_or_init_semantic_memory, save_semantic_memory
        from app.services.semantic_distiller import distill_strength_event

        semantic = SemanticMemory.model_validate(await get_or_init_semantic_memory("user_1"))
        for exercise in data.get("exercises") or []:
            for set_item in exercise.get("sets") or []:
                semantic = distill_strength_event(
                    semantic,
                    {
                        "exerciseName": exercise.get("name") or exercise.get("exercise_name"),
                        "weightKg": set_item.get("weight") or set_item.get("weight_kg"),
                        "reps": set_item.get("reps"),
                        "rpe": set_item.get("rpe"),
                    },
                )
        await save_semantic_memory("user_1", semantic.model_dump(by_alias=True))
```

- [ ] **Step 5: Run agent and semantic tests**

Run:

```bash
cd backend
uv run pytest tests/test_agent.py tests/test_semantic_distiller.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/nodes/memory_updater.py backend/tests/test_agent.py
git commit -m "feat: update memory lifecycle for plans and strength diffs"
```

### Task 16: Final Backend Verification

**Files:**
- Modify only files needed to fix failures found by these commands.

- [ ] **Step 1: Run full backend tests**

Run:

```bash
cd backend
uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 2: Run backend compile check**

Run:

```bash
cd backend
uv run python -m compileall app tests
```

Expected: exits with code 0 and no syntax errors.

- [ ] **Step 3: Run frontend TypeScript check**

Run:

```bash
npm run lint
```

Expected: exits with code 0. If it fails because existing frontend issues predate this refactor, record the failing file and line in the implementation handoff before changing unrelated frontend code.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: exits with code 0 and writes `dist/`.

- [ ] **Step 5: Commit verification fixes**

If Step 1-4 required code changes:

```bash
git add backend/app backend/tests src tests package.json package-lock.json
git commit -m "fix: stabilize fitness agent refactor"
```

If Step 1-4 passed without changes, do not create an empty commit.

## Rollout Notes

- Keep existing `/api/chat`, `/api/records`, `/api/memory`, and `/api/sessions` responses compatible while adding new plan endpoints.
- Keep `activity_records` as the compatibility feed for current frontend history views.
- New detailed tables provide higher-fidelity records for long-term personalization.
- The first storage pass remains SQLite. Redis, TimescaleDB, PostgreSQL, and pgvector become storage-adapter targets after this refactor proves the domain boundaries.
- Safety-critical memory enters the system prompt through `InjuryRiskProfile` and medical contraindications on every plan-related call.
- Plan drafts remain in working memory until confirmation. Confirmed plans are written to `weekly_plan_records`; discarded drafts are deleted from the TTL store.

## Self-Review

- Spec coverage: The plan covers session state, plan execution, SafetyGuard, bridges, registry tools, observability, four-layer memory, lifecycle management, and budgeted context injection.
- Placeholder scan: The plan contains no placeholder tokens or unscoped implementation steps.
- Type consistency: The plan consistently uses Pydantic aliases such as `userId`, `injuryRiskProfile`, `rpeTarget`, `weightKg`, `planId`, and `entryDate`.
- Scope control: External storage migration is excluded from this pass and represented through stable service boundaries.
