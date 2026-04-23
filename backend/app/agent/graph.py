"""
LangGraph 主图定义：ReAct 多轮工具调用循环

架构流程：
    context_builder → supervisor_agent → [should_continue]
                          ↑                   |
                          └──── tool_executor ←┘  (当 supervisor 发起 tool_calls 时循环)
                          |
                          ↓ (当 supervisor 返回最终答案时)
                    memory_updater → response_formatter → END

supervisor_agent 绑定所有工具，根据对话决定调用哪些工具；
tool_executor 执行工具调用后将结果回传给 supervisor，形成多轮循环。
"""

from functools import lru_cache
from typing import Literal

from langchain_core.messages import AIMessage

from langgraph.graph import END, StateGraph

from app.agent.nodes.context_builder import context_builder_node
from app.agent.nodes.memory_updater import memory_updater_node
from app.agent.nodes.response_formatter import response_formatter_node
from app.agent.nodes.supervisor_agent import supervisor_agent_node
from app.agent.nodes.tool_executor import tool_executor_node
from app.agent.state import AgentState


def should_continue(state: AgentState) -> Literal["tool_executor", "memory_updater"]:
    """路由判断：若最后一条消息包含 tool_calls，则进入工具执行节点；否则进入记忆更新节点。"""
    messages = state.get("messages", [])
    if not messages:
        return "memory_updater"
    last_msg = messages[-1]
    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        return "tool_executor"
    return "memory_updater"


def build_agent_graph():
    """构建并编译 LangGraph 工作流。"""
    workflow = StateGraph(AgentState)

    # 核心节点注册
    workflow.add_node("context_builder", context_builder_node)
    workflow.add_node("supervisor_agent", supervisor_agent_node)
    workflow.add_node("tool_executor", tool_executor_node)
    workflow.add_node("memory_updater", memory_updater_node)
    workflow.add_node("response_formatter", response_formatter_node)

    # 入口
    workflow.set_entry_point("context_builder")

    # ReAct 循环：supervisor → (tool_executor → supervisor) 或 memory_updater
    workflow.add_edge("context_builder", "supervisor_agent")
    workflow.add_conditional_edges(
        "supervisor_agent",
        should_continue,
        {
            "tool_executor": "tool_executor",
            "memory_updater": "memory_updater",
        },
    )
    # 工具执行后回到 supervisor 继续思考
    workflow.add_edge("tool_executor", "supervisor_agent")

    # 最终输出链路
    workflow.add_edge("memory_updater", "response_formatter")
    workflow.add_edge("response_formatter", END)

    return workflow.compile()


@lru_cache
def get_agent_graph():
    """获取编译后的图实例（单例缓存）。"""
    return build_agent_graph()
