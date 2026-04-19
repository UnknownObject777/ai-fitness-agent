from typing import Any, Literal

from pydantic import BaseModel, Field


IntentName = Literal[
    "generate_workout_plan",
    "update_workout_plan",
    "log_strength_workout",
    "log_exercise",
    "log_food",
    "log_food_multi",
    "log_measurement",
    "chat",
]


class IntentResult(BaseModel):
    intent: IntentName = "chat"
    confidence: float = Field(default=0.5, ge=0, le=1)
    entry_date: str | None = Field(default=None, alias="entryDate")

    model_config = {"populate_by_name": True}


class AgentPayload(BaseModel):
    success: bool = True
    response: str
    intent: IntentName = "chat"
    data: dict[str, Any] | None = None
    entry_date: str | None = Field(default=None, alias="entryDate")
    profile_update: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}

