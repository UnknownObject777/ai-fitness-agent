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
