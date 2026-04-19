"""
FitWeek AI 数据模型定义
========================

本模块使用 Pydantic 库定义 AI 服务的数据传输对象（DTO）。
这些模型用于：
1. 验证从 Spring Boot 后端接收的数据
2. 提供类型安全和自动化的数据验证
3. 将数据序列化为可传输的格式

架构说明：
- SetLogDTO: 单个训练组的记录
- WorkoutSessionDTO: 完整的训练会话，包含多个组记录
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class SetLogDTO(BaseModel):
    """
    训练组记录数据传输对象

    表示单次训练动作的一组记录，包含：
    - 动作名称（如卧推、深蹲等）
    - 使用的重量（公斤）
    - 完成的次数
    - 主观疲劳程度（RPE，Rate of Perceived Exertion）

    字段说明：
        exerciseName: str - 训练动作名称（如 "Bench Press", "Squat"）
        weight: float - 使用重量，单位为公斤（kg）
        reps: int - 完成的重复次数
        rpe: int - 主观疲劳程度评分，范围 1-10（10 表示极限努力）

    示例：
        >>> set_log = SetLogDTO(
        ...     exerciseName="Bench Press",
        ...     weight=80.0,
        ...     reps=8,
        ...     rpe=8
        ... )
    """
    exerciseName: str
    weight: float
    reps: int
    rpe: int


class WorkoutSessionDTO(BaseModel):
    """
    训练会话数据传输对象

    表示一次完整的训练会话，包含：
    - 会话标题（如 "上肢训练日"、"腿部日" 等）
    - 训练日期
    - 多个训练组记录
    - 可选的现有 AI 教练笔记

    这是从 Spring Boot 后端接收的主要数据结构，
    也是 /analyze 端点的请求体模型。

    字段说明：
        title: str - 训练会话标题
        workoutDate: str - 训练日期，ISO 格式字符串（如 "2024-01-15"）
        setLogs: List[SetLogDTO] - 训练组记录列表
        aiCoachNotes: Optional[str] - 现有的 AI 教练笔记（可选，用于更新场景）

    示例：
        >>> session = WorkoutSessionDTO(
        ...     title="Upper Body Day",
        ...     workoutDate="2024-01-15",
        ...     setLogs=[
        ...         SetLogDTO(exerciseName="Bench Press", weight=80.0, reps=8, rpe=8),
        ...         SetLogDTO(exerciseName="Pull Up", weight=0.0, reps=10, rpe=7)
        ...     ],
        ...     aiCoachNotes=None
        ... )
    """
    title: str
    workoutDate: str
    setLogs: List[SetLogDTO]
    aiCoachNotes: Optional[str] = None
