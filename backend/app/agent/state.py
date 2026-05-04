"""
LangGraph 全局状态定义（AgentState）

该 TypedDict 承载整个 ReAct 循环中的全部状态数据，
从 context_builder 初始化，经 supervisor_agent / tool_executor 更新，
最终由 response_formatter 输出为 response_payload。

新增字段 messages（list[BaseMessage]）用于维护 ReAct 消息线程，
其余字段保持与旧版 DAG 兼容，确保前端 API 无需改动。
"""

from typing import Any, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    # ---- 用户输入层 ----
    user_message: str                    # 当前用户输入文本
    session_id: str                      # 会话 ID，用于持久化聊天记录
    base64_image: str | None             # 用户上传的食物图片（base64）
    image_key: str | None                # 图片在存储中的 key
    chat_history: list[dict[str, Any]]   # 前端传来的完整历史消息列表

    # ---- 记忆上下文（由 context_builder 填充） ----
    semantic_memory: dict[str, Any]      # 长期语义记忆（目标、弱项、伤病史等）
    episodic_memory: list[dict[str, Any]]# 近期活动记忆（最近训练/饮食记录）
    working_memory: dict[str, Any]       # 工作记忆（当前会话状态）
    memory_prompt: str                   # 格式化的记忆提示文本，注入系统提示

    # ---- ReAct 消息线程（新增） ----
    messages: list[BaseMessage]          # Supervisor 与 Tool Executor 之间的消息循环

    # ---- 意图与结构化数据 ----
    detected_intent: str                 # 检测到的意图（供兼容旧版字段使用）
    intent_confidence: float             # 意图置信度
    structured_data: dict[str, Any]      # 提取出的结构化业务数据（训练、饮食、计划等）
    profile_update: dict[str, Any] | None# 用户档案更新内容
    entry_date: str | None               # 记录日期（today / yesterday / YYYY-MM-DD）

    # ---- 健身会话与计划执行 ----
    fitness_session_state: dict[str, Any]  # FitnessSessionState 序列化
    context_sections: dict[str, Any]       # 三层预算化上下文（system/session/dynamic）
    modality_route: str                    # 多模态路由结果（text/nutrition_image/video_analysis）
    plan_execution: dict[str, Any]         # 结构化训练计划执行结果
    safety_issues: list[dict[str, Any]]    # SafetyGuard 检测到的安全问题

    # ---- 输出层 ----
    ai_response: str                     # LLM 最终回复文本
    response_payload: dict[str, Any]     # 格式化后的 API 响应体（返回给前端）
