"""
FitWeek AI LangGraph 工作流定义
================================

本模块定义 LangGraph 状态图（StateGraph）的结构和流转逻辑。
这是 AI 教练的"大脑"，控制数据如何在各节点间流动。

当前工作流架构（简化版）：
                    ┌─────────────────────────────────────┐
                    │           Entry Point               │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │           Planner Node                │
                    │      (生成分析计划/指令)               │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │           Writer Node                 │
                    │      (生成最终 AI 教练笔记)           │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │                END                    │
                    └─────────────────────────────────────┘

历史架构（完整版，当前未使用）：
原本包含 Research Node 和 Critique Node，用于：
- Research Node: 使用 Tavily 搜索相关科学研究和训练数据
- Critique Node: 审核研究结果的充分性，决定是否重新研究

简化的原因：
1. 减少延迟：移除网络搜索和外部 API 调用
2. 降低依赖：不再依赖 Tavily 和外部搜索服务
3. 性能优化：纯 LLM 处理更快，适合实时应用场景

扩展指南：
如需重新启用 Research Node 和 Critique Node：
1. 取消注释 researchNode 和 critiqueNode 的导入
2. 使用下方注释掉的代码块替换当前工作流配置
3. 确保 TAVILY_API_KEY 环境变量已配置
"""

from langgraph.graph import StateGraph, END
from agentStateNode import AgentState
from plannerNode import planner_node
from writerNode import writer_node

# 扩展节点导入（当前未使用，保留供将来扩展）
# from researchNode import research_node
# from critiqueNode import critique_node


# ============================================================================
# 当前工作流配置（简化版 - 两节点线性流程）
# ============================================================================

# 1. Initialize the Graph with the shared State
# 初始化状态图，使用 AgentState 作为状态类型
# 状态图是 LangGraph 的核心概念，定义了节点和边的有向图
workflow = StateGraph(AgentState)

# 2. Add the simplified nodes
# 添加简化的节点到状态图
# 当前工作流只包含两个节点：
# - planner: 分析训练数据并生成分析计划
# - writer: 根据计划生成最终的 AI 教练笔记
#
# 注释说明：
# We've removed 'researcher' and 'auditor' to eliminate latency and dependency on web search.
# 我们移除了 'researcher' 和 'auditor' 节点以消除延迟和对网络搜索的依赖
workflow.add_node("planner", planner_node)
workflow.add_node("writer", writer_node)

# 3. Define the linear flow
# 定义线性流程的边（Edge）
# 边定义了节点之间的流转关系：
# - set_entry_point: 设置入口点为 planner 节点
# - planner -> writer: planner 执行完后流转到 writer
# - writer -> END: writer 执行完后工作流结束
#
# The entry point is the Planner, which then hands off directly to the Writer.
# 入口点是 Planner 节点，它直接交接给 Writer 节点
workflow.set_entry_point("planner")
workflow.add_edge("planner", "writer")
workflow.add_edge("writer", END)

# 4. Compile the Graph
# 编译状态图，生成可执行的工作流对象
# This 'architect_brain' is what your FastAPI (main.py) calls.
# 这个 'architect_brain' 就是 FastAPI（main.py）调用的对象
# 编译后的对象可以通过 ainvoke() 方法异步执行
architect_brain = workflow.compile()


# ============================================================================
# 扩展工作流配置（完整版 - 五节点循环流程，当前未使用）
# ============================================================================
# 下方代码展示了包含 Research Node 和 Critique Node 的完整工作流配置。
# 如需启用，请：
# 1. 取消注释下方代码块
# 2. 注释掉上方的简化版配置
# 3. 确保已配置 TAVILY_API_KEY 环境变量
# 4. 取消注释本文件顶部的 researchNode 和 critiqueNode 导入

"""
# 初始化状态图
workflow = StateGraph(AgentState)

# 添加所有节点
workflow.add_node("planner", planner_node)       # 计划节点：生成研究计划
workflow.add_node("researcher", research_node)   # 研究节点：执行网络搜索
workflow.add_node("auditor", critique_node)      # 审核节点：评估研究结果质量
workflow.add_node("writer", writer_node)         # 写作节点：生成最终教练笔记

# 定义条件路由函数
def route_from_auditor(state: AgentState):
    \"\"\"
    从审核节点路由的决策函数

    根据 Critique Node 的审核结果决定工作流的走向：
    - 如果验证通过 (is_validated=True): 流向 Writer 节点生成最终笔记
    - 如果验证失败 (is_validated=False): 流回 Researcher 节点进行补充研究

    这种循环机制确保研究质量达到要求后才进入写作阶段。

    参数:
        state (AgentState): 当前工作流状态，包含 is_validated 标志

    返回:
        str: 目标节点名称（"writer" 或 "researcher"）

    状态读取:
        - state["is_validated"]: bool - 验证通过标志
    \"\"\"
    if state["is_validated"]:
        return "writer"  # 验证通过，进入写作阶段
    else:
        return "researcher"  # 验证失败，返回补充研究

# 设置入口点
workflow.set_entry_point("planner")

# 定义边（流转关系）
workflow.add_edge("planner", "researcher")           # Planner -> Researcher
workflow.add_edge("researcher", "auditor")           # Researcher -> Auditor

# Auditor 之后的条件边
# 使用 route_from_auditor 函数决定走向
workflow.add_conditional_edges(
    "auditor",                    # 源节点
    route_from_auditor,           # 路由决策函数
    {                             # 映射：返回值 -> 目标节点
        "writer": "writer",       # 验证通过 -> Writer
        "researcher": "researcher"  # 验证失败 -> Researcher（循环）
    }
)

# Writer 之后结束工作流
workflow.add_edge("writer", END)

# 编译状态图
architect_brain = workflow.compile()
"""
