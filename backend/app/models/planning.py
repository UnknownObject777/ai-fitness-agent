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
