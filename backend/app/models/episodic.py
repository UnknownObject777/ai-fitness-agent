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
