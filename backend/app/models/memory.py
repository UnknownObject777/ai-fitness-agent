from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class WorkingMemory(BaseModel):
    session_id: str | None = Field(default=None, alias="sessionId")
    active_exercise_index: int | None = Field(default=None, alias="activeExerciseIndex")
    current_set_number: int | None = Field(default=None, alias="currentSetNumber")
    recent_user_messages: list[dict[str, str]] = Field(default_factory=list, alias="recentUserMessages")

    model_config = {"populate_by_name": True}


class UserProfile(BaseModel):
    goals: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list, alias="weakPoints")
    preferred_style: str = Field(default="unknown", alias="preferredStyle")
    injury_history: list[str] = Field(default_factory=list, alias="injuryHistory")

    model_config = {"populate_by_name": True}


class WeeklyTrainingStats(BaseModel):
    week_id: str = Field(alias="weekId")
    start_date: str = Field(alias="startDate")
    end_date: str = Field(alias="endDate")
    total_workouts: int = Field(default=0, alias="totalWorkouts")
    muscle_group_volume: dict[str, dict[str, Any]] = Field(default_factory=dict, alias="muscleGroupVolume")
    exercise_records: dict[str, dict[str, Any]] = Field(default_factory=dict, alias="exerciseRecords")

    model_config = {"populate_by_name": True}


class SemanticMemory(BaseModel):
    user_id: str = Field(default="user_1", alias="userId")
    user_profile: UserProfile = Field(default_factory=UserProfile, alias="userProfile")
    strength_model: dict[str, Any] = Field(default_factory=dict, alias="strengthModel")
    weekly_training_stats: dict[str, Any] = Field(default_factory=dict, alias="weeklyTrainingStats")
    updated_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        alias="updatedAt",
    )

    model_config = {"populate_by_name": True}


class AgentContext(BaseModel):
    semantic_memory: SemanticMemory = Field(alias="semanticMemory")
    recent_episodes: list[dict[str, Any]] = Field(default_factory=list, alias="recentEpisodes")
    working_memory: WorkingMemory = Field(alias="workingMemory")
    user_message: str = Field(alias="userMessage")

    model_config = {"populate_by_name": True}

