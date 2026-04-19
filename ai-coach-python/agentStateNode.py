"""
FitWeek AI Agent 状态定义
=========================

本模块定义 LangGraph 工作流中各节点之间传递的状态数据结构。
使用 TypedDict 定义类型安全的状态对象，确保各节点能够正确地读取和更新状态。

状态流转说明：
1. workout_data (输入) ->
2. research_plan (Planner 生成) ->
3. research_results (当前未使用) ->
4. final_notes (Writer 生成) ->
5. is_validated (当前未使用)

架构说明：
- AgentState 使用 TypedDict 定义，提供类型检查
- 使用 Annotated 和 operator.add 实现列表的追加语义（而非覆盖）
"""

from typing import TypedDict, List, Annotated
import operator


class AgentState(TypedDict):
    """
    LangGraph Agent 状态类型定义

    这是一个 TypedDict 类型，定义了在 LangGraph 工作流中各节点之间
    传递和共享的状态数据结构。每个字段代表工作流中的一个关键数据。

    设计原理：
    - 使用 TypedDict 而非普通 dict 以提供类型安全
    - 列表字段使用 Annotated 包装，配合 operator.add 实现"追加"语义
    - 状态是"累加"的，后续节点可以读取前面节点写入的数据

    字段详细说明：

    1. workout_data (dict)
       - 输入字段，由 main.py 的 /analyze 端点注入
       - 包含原始训练数据：标题、日期、组记录等
       - 格式：WorkoutSessionDTO 的字典表示

    2. research_plan (Annotated[List[str], operator.add])
       - 由 Planner Node 生成，Writer Node 读取
       - 存储 4-5 个具体的研究任务或分析步骤
       - 使用 operator.add 语义：新步骤会追加到列表，而非替换
       - 作为 Writer Node 生成最终笔记的指导和约束

    3. research_results (Annotated[List[str], operator.add])
       - 保留字段，当前工作流中未使用
       - 原本设计用于存储 Tavily 搜索结果
       - 为未来扩展保留（如重新启用 Research Node）

    4. final_notes (str)
       - 输出字段，由 Writer Node 生成
       - 存储最终生成的 AI 教练笔记（约 4 句话）
       - 被 main.py 返回给 Spring Boot 后端
       - 内容由定量分析组成：容量、不平衡、强度处方、RPE 目标

    5. is_validated (bool)
       - 保留字段，当前工作流中未使用
       - 原本设计用于 Critique Node 的验证结果
       - 为未来扩展保留（如重新启用 Critique Node）

    使用示例：
        # 在 main.py 中初始化状态
        initial_state: AgentState = {
            "workout_data": {...},
            "research_plan": [],
            "research_results": [],
            "final_notes": "",
            "is_validated": False
        }

        # 在 Planner Node 中更新状态
        def planner_node(state: AgentState):
            return {"research_plan": ["step1", "step2"]}  # 追加到列表

    注意：
    - TypedDict 不会在运行时强制类型检查，但 IDE 和类型检查器会利用这些类型信息
    - 状态字典会被 LangGraph 在各节点间传递，保持引用一致性
    """

    # The raw workout data coming from Spring Boot
    # 来自 Spring Boot 的原始训练数据（WorkoutSessionDTO 的字典表示）
    workout_data: dict

    # CHANGED: Now a list so we can handle multiple research objectives
    # We use operator.add so we can append new steps if the Critique node asks for more
    # 分析计划列表，由 Planner Node 生成
    # 使用 Annotated 和 operator.add 实现追加语义，新步骤会追加到列表而非替换
    research_plan: Annotated[List[str], operator.add]

    # A list of scientific facts or historical data gathered by the Research Node
    # 研究结果列表（当前未使用，保留用于未来扩展）
    # 使用 operator.add 实现追加语义
    research_results: Annotated[List[str], operator.add]

    # The final Stoic insight produced by the Writer Node
    # 最终 AI 教练笔记，由 Writer Node 生成
    final_notes: str

    # A flag to track if the Critique Node approved the content
    # 验证标志（当前未使用，保留用于未来扩展）
    # 用于标记 Critique Node 是否已批准内容
    is_validated: bool
