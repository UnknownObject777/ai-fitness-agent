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
