"""
FitWeek AI 教练服务主入口
===========================

本模块是 AI 服务的 FastAPI 应用入口，负责：
1. 提供健康检查端点
2. 接收来自后端 Spring Boot 的训练数据
3. 调用 LangGraph 工作流进行 AI 分析和生成教练笔记

架构说明：
- 使用 FastAPI 框架构建 RESTful API
- 通过 Pydantic 模型进行数据验证
- 异步调用 LangGraph 工作流处理训练数据
"""

from fastapi import FastAPI
from models import WorkoutSessionDTO
from graph import architect_brain # Import the compiled graph

# 初始化 FastAPI 应用实例
# title 参数定义了 API 文档中显示的标题
app = FastAPI(title="FitWeek AI Architect")


@app.get("/health")
def health():
    """
    健康检查端点

    用途：
    - Docker 容器健康检查
    - 负载均衡器后端健康探测
    - 监控系统的可用性检查

    返回:
        dict: 包含服务状态信息的字典
    """
    return {"status": "The Architect is awake"}


@app.post("/analyze")
async def analyze_workout(session: WorkoutSessionDTO):
    """
    训练数据分析主入口

    这是 AI 服务的核心端点，接收来自 Spring Boot 后端的训练数据，
    通过 LangGraph 工作流进行智能分析，返回 AI 生成的教练笔记。

    处理流程：
    1. 接收并验证训练会话数据（标题、日期、组记录）
    2. 初始化 LangGraph 状态对象
    3. 异步调用工作流（Planner -> Writer）
    4. 返回生成的 AI 教练笔记

    状态流转说明：
    - workout_data: 原始训练数据
    - research_plan: 分析计划（由 Planner 节点生成）
    - research_results: 保留字段（当前未使用）
    - final_notes: 最终 AI 教练笔记
    - is_validated: 保留字段（当前未使用）

    参数:
        session (WorkoutSessionDTO): 训练会话数据传输对象，包含：
            - title: 训练标题
            - workoutDate: 训练日期
            - setLogs: 组记录列表
            - aiCoachNotes: 现有 AI 笔记（可选）

    返回:
        dict: 包含 AI 教练笔记和状态信息的字典
            - aiCoachNotes: AI 生成的教练笔记文本
            - status: 处理状态（"success" 表示成功）

    示例:
        >>> session = WorkoutSessionDTO(
        ...     title="Upper Body Day",
        ...     workoutDate="2024-01-15",
        ...     setLogs=[...]
        ... )
        >>> result = await analyze_workout(session)
        >>> print(result["aiCoachNotes"])
    """
    print(f"Received session for processing: {session.title}")

    # 初始化 LangGraph 状态对象
    # 这是工作流的初始状态，包含所有需要在节点间传递的数据
    initial_state = {
        "workout_data": session.dict(),  # 将 Pydantic 模型转换为字典
        "research_plan": [],              # 初始分析计划为空列表
        "research_results": [],           # 初始研究结果为空列表
        "final_notes": "",                # 初始最终笔记为空字符串
        "is_validated": False             # 初始验证状态为 False
    }

    # 异步调用 LangGraph 工作流
    # architect_brain 是编译好的状态图，ainvoke 方法异步执行工作流
    # 执行流程：Planner -> Writer -> END
    # 每个节点会接收当前状态，处理后返回更新后的状态
    final_state = await architect_brain.ainvoke(initial_state)

    # 返回最终结果
    # final_notes 是由 Writer 节点生成的 AI 教练笔记
    return {
        "aiCoachNotes": final_state["final_notes"],
        "status": "success"
    }
