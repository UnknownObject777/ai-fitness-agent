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
