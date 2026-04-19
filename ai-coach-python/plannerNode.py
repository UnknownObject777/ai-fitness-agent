"""
FitWeek AI Planner 节点
========================

本模块定义 LangGraph 工作流的第一个节点——Planner Node（规划器节点）。
这是整个 AI 教练大脑的"策略师"，负责分析训练数据并生成具体的分析计划。

Planner Node 的职责：
1. 接收原始训练数据（workout_data）
2. 使用 Gemini LLM 进行智能分析
3. 生成 4 步分析计划（research_plan），指导 Writer Node

分析计划的具体内容（4 个步骤）：
1. 主要复合动作识别 - 用于计算总训练量
2. 高 RPE 组标记 - 识别需要恢复调整的高强度组
3. 肌肉群刺激分析 - 检查相对于 7 天趋势的过度训练
4. 下次训练目标设定 - 基于今日表现设定下次负荷目标

为什么需要结构化输出（ResearchPlan 类）：
- 确保 LLM 返回格式一致的列表
- 提供类型安全和验证
- 便于后续节点解析和使用
"""

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from agentStateNode import AgentState
from typing import List
from pydantic import BaseModel, Field

# 加载 .env 文件中的环境变量
# 包含 GOOGLE_API_KEY 等敏感信息
load_dotenv()


# =============================================================================
# 结构化输出模型定义
# =============================================================================

class ResearchPlan(BaseModel):
    """
    研究计划结构化输出模型

    使用 Pydantic BaseModel 定义 LLM 的结构化输出格式。
    这确保 Gemini 返回的数据是一个格式良好的 JSON 对象，
    包含一个名为 "steps" 的字符串列表。

    设计目的：
    - 类型安全：确保 LLM 输出符合预期结构
    - 易于解析：可直接转换为 Python 列表使用
    - 验证友好：Pydantic 会自动验证字段类型和内容

    字段说明：
        steps: List[str] - 4-5 个具体的研究任务或分析步骤字符串列表
                          每个字符串描述一个具体的分析任务

    使用方式：
        structured_llm = llm.with_structured_output(ResearchPlan)
        response = structured_llm.invoke(prompt)  # 返回 ResearchPlan 实例
        steps = response.steps  # 直接访问列表
    """
    steps: List[str] = Field(description="A list of 4-5 specific research tasks to perform.")


# =============================================================================
# Planner Node 核心函数
# =============================================================================

def planner_node(state: AgentState):
    """
    Planner Node（规划器节点）核心函数

    这是 LangGraph 工作流的第一个节点，扮演"首席数据策略师"的角色。
    它接收原始训练数据，使用 Gemini LLM 进行智能分析，
    生成一个 4 步分析计划，指导 Writer Node 生成最终的教练笔记。

    处理流程：
    1. 从状态中提取训练数据（workout_data）
    2. 初始化 Gemini LLM（使用 gemini-2.5-flash 模型）
    3. 构造详细的提示词（prompt），包含：
       - 角色设定：首席数据策略师
       - 任务描述：生成 4 步执行计划
       - 具体数据：训练标题、动作记录
    4. 调用 LLM 生成结构化输出（ResearchPlan）
    5. 将生成的步骤列表返回到状态的 research_plan 字段

    4 步分析计划详解：

    步骤 1：主要复合动作识别
    - 识别训练中的主要复合动作（如深蹲、硬拉、卧推等）
    - 用于计算该动作的"总训练量"（Total Tonnage = weight * reps）
    - 这是评估训练强度和恢复需求的基础

    步骤 2：高 RPE 组标记
    - 扫描所有组记录，识别 RPE 8-10 的高强度组
    - 这些组对神经系统压力大，需要特定的恢复或强度调整
    - 标记这些组有助于防止过度训练和受伤风险

    步骤 3：肌肉群刺激分析
    - 根据动作名称识别主要刺激的肌肉群
    - 对比该肌肉群在 7 天内的训练频率
    - 检查是否存在"过度训练"（同一肌肉群训练过于频繁）

    步骤 4：下次训练目标设定
    - 基于今日表现（重量、次数、RPE）设定下次目标
    - 例如：如果今日 RPE 7 完成了 80kg x 8 次，
            下次目标可能是 82.5kg x 8 次或 80kg x 9 次

    提示词设计说明：
    - 角色设定清晰：首席数据策略师，明确职责范围
    - 任务具体：生成 4 步执行计划，避免模糊描述
    - 数据充分：提供完整的训练数据，包括标题和动作记录
    - 约束明确：使用编号列表确保 LLM 输出结构清晰

    参数:
        state (AgentState): 当前工作流状态对象，包含：
            - workout_data (dict): 原始训练数据，格式如下：
              {
                  "title": "训练标题",
                  "workoutDate": "2024-01-15",
                  "setLogs": [
                      {"exerciseName": "Bench Press", "weight": 80.0, "reps": 8, "rpe": 8},
                      ...
                  ]
              }

    返回:
        dict: 包含更新后状态字段的字典，格式如下：
            {
                "research_plan": List[str]  # 4-5 个分析步骤的字符串列表
            }

        注意：LangGraph 会自动将这个字典的字段合并到整体状态中。
              使用 Annotated[List[str], operator.add] 定义的字段会使用追加语义。

    使用示例：
        >>> state = {
        ...     "workout_data": {
        ...         "title": "Push Day",
        ...         "setLogs": [
        ...             {"exerciseName": "Bench Press", "weight": 80, "reps": 8, "rpe": 8}
        ...         ]
        ...     },
        ...     "research_plan": [],
        ...     ...
        ... }
        >>> result = planner_node(state)
        >>> print(result["research_plan"])
        [
            "1. Calculate total tonnage for Bench Press as the primary compound movement...",
            "2. Identify high-RPE sets (8-10) in today's session...",
            "3. Analyze chest and triceps stimulation frequency over the past 7 days...",
            "4. Set next session's target load based on 80kg x 8 @ RPE 8..."
        ]

    依赖：
        - ChatGoogleGenerativeAI: LangChain 封装的 Gemini LLM 客户端
        - ResearchPlan: Pydantic 模型，定义 LLM 的结构化输出格式
        - AgentState: 类型字典，定义工作流状态结构

    配置要求：
        环境变量：
            GOOGLE_API_KEY: Google Gemini API 密钥（在 .env 文件中配置）

    模型信息：
        使用模型：gemini-2.5-flash
        选择理由：
        - 速度快：适合实时应用，延迟低
        - 成本低：比 Pro 版本更经济
        - 能力足够：对于结构化输出和简单分析任务表现良好

    异常处理：
        - 如果 LLM 调用失败，会抛出异常并由 LangGraph 的异常处理机制捕获
        - 建议在调用处添加 try-except 块进行错误处理和日志记录

    性能优化建议：
        1. 考虑添加 LLM 响应缓存，避免重复计算相同训练数据的计划
        2. 对于复杂分析，可考虑使用 gemini-2.5-pro 模型以获得更高质量输出
        3. 监控 LLM 调用延迟，必要时添加超时机制

    维护者注意：
        - 修改提示词时请保持 4 步结构的一致性
        - 添加新步骤时需同步更新提示词中的编号列表
        - 测试时请验证 LLM 输出是否符合预期的结构化格式
    """

    # 从状态中提取训练数据
    # workout 是一个字典，包含 title、workoutDate、setLogs 等字段
    workout = state["workout_data"]

    # 初始化 LLM（Large Language Model，大语言模型）
    # ChatGoogleGenerativeAI 是 LangChain 提供的 Google Gemini 模型封装
    # 使用 "gemini-2.5-flash" 模型，这是一个快速且经济的模型变体
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

    # 使用结构化输出包装器
    # with_structured_output 方法确保 LLM 返回符合 ResearchPlan 模型的结构化数据
    # 这避免了自由文本解析的复杂性，直接返回可编程处理的 Python 对象
    structured_llm = llm.with_structured_output(ResearchPlan)

    # 构造提示词（Prompt）
    # 提示词是提供给 LLM 的指令，告诉它：
    # 1. 它扮演的角色（首席数据策略师）
    # 2. 它需要完成的任务（生成 4 步执行计划）
    # 3. 输入数据（训练标题和动作记录）
    # 4. 输出格式（4 个具体步骤的详细描述）
    prompt = f"""
    You are the 'Lead Data Strategist' for FitWeek.
    Analyze today's session to identify the key quantitative metrics for the Writer Node.

    WORKOUT: {workout.get('title')}
    LIFTS: {workout.get('setLogs')}

    Your task is to create a 4-step execution plan for the Writer:
    1. Identify the primary compound movement to be used for the 'Total Tonnage' calculation.
    2. Flag any high-RPE sets (8-10) that require specific recovery or intensity adjustments.
    3. Determine which muscle groups received the most stimulus today to check for 'overtraining' against the 7-day trend.
    4. Set the logic for the next session's 'Target Load' (e.g., +2.5kg or +1 rep) based on today's performance.
    """

    # 调用 LLM 生成计划
    # structured_llm.invoke(prompt) 发送提示词到 Gemini API
    # 返回 ResearchPlan 对象，包含 steps 属性（字符串列表）
    response = structured_llm.invoke(prompt)

    # 将生成的步骤列表返回到状态
    # 返回字典的 "research_plan" 键对应 AgentState 中的同名字段
    # LangGraph 会自动将这个返回值合并到整体状态中
    # 由于 research_plan 定义为 Annotated[List[str], operator.add]，
    # 新步骤会追加到现有列表（而非替换）
    return {
        "research_plan": response.steps
    }
