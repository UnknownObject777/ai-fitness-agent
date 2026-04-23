"""
Pydantic 模式定义：用于结构化 LLM 输出和工具参数校验

- IntentResult / AgentPayload / DomainResult：旧版结构化输出兼容模式
- ExtractWorkoutInput / ExtractNutritionInput / ExtractPlanInput：数据提取工具的入参模式
- SaveRecordInput：持久化工具入参
- QueryHistoryInput：历史查询工具入参
- UpdateProfileInput：档案更新工具入参

所有模式均设置 populate_by_name=True，兼容驼峰/下划线两种字段命名。
"""

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
    """意图识别结果模式。"""
    intent: IntentName = "chat"
    confidence: float = Field(default=0.5, ge=0, le=1)
    entry_date: str | None = Field(default=None, alias="entryDate")

    model_config = {"populate_by_name": True}


class AgentPayload(BaseModel):
    """Agent 最终对外输出的 API 响应模式。"""
    success: bool = True
    response: str
    intent: IntentName = "chat"
    data: dict[str, Any] | None = None
    entry_date: str | None = Field(default=None, alias="entryDate")
    profile_update: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class DomainResult(BaseModel):
    """各 Domain Agent（现为工具）返回的结构化结果模式。"""
    response: str
    data: dict[str, Any] = Field(default_factory=dict)
    profile_update: dict[str, Any] | None = None
    entry_date: str | None = Field(default=None, alias="entryDate")

    model_config = {"populate_by_name": True}


# ---- 工具入参模式 ----

class ExtractWorkoutInput(BaseModel):
    """extract_workout_data 工具的入参。"""
    intent: Literal["log_strength_workout", "log_exercise", "log_measurement"] = Field(
        description="The workout intent to extract data for"
    )
    user_message: str = Field(description="The user's message to extract from")


class ExtractNutritionInput(BaseModel):
    """extract_nutrition_data 工具的入参。"""
    user_message: str = Field(description="The user's message to extract food data from")


class ExtractPlanInput(BaseModel):
    """extract_plan_data 工具的入参。"""
    intent: Literal["generate_workout_plan", "update_workout_plan"] = Field(
        description="The plan intent"
    )
    user_message: str = Field(description="The user's message to extract plan data from")


class SaveRecordInput(BaseModel):
    """save_record 工具的入参。"""
    intent: IntentName = Field(description="The intent of the record to save")
    data: dict[str, Any] = Field(description="Structured data to persist")
    entry_date: str | None = Field(default=None, alias="entryDate", description="Date hint")


class QueryHistoryInput(BaseModel):
    """query_history 工具的入参。"""
    intent_filter: str | None = Field(
        default=None, description="Filter by intent, e.g. 'log_strength_workout'"
    )
    days: int = Field(default=7, ge=1, le=90, description="How many days back to query")
    limit: int = Field(default=20, ge=1, le=100)


class UpdateProfileInput(BaseModel):
    """update_user_profile 工具的入参。仅传入需要更新的字段。"""
    goals: list[str] | None = Field(default=None, description="New or updated goals")
    weak_points: list[str] | None = Field(default=None, alias="weakPoints")
    injury_history: list[str] | None = Field(default=None, alias="injuryHistory")
    preferred_style: str | None = Field(default=None, alias="preferredStyle")
    weekly_training_stats: dict[str, Any] | None = Field(default=None, alias="weeklyTrainingStats")
    strength_model: dict[str, Any] | None = Field(default=None, alias="strengthModel")
