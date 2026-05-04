"""
Supervisor Agent 节点：LangGraph ReAct 循环的决策核心

职责：
1. 绑定全部工具（bind_tools），让 LLM 自主决定调用哪些工具
2. 构建对话上下文（SystemMessage + 用户记忆 + 历史消息）
3. 调用 LLM 并判断：
   - 若返回 tool_calls → 进入 tool_executor 节点，等待工具执行结果后再次循环
   - 若无 tool_calls → 视为最终回答，进入 memory_updater 节点

多轮循环示例：
  supervisor(用户说"深蹲80kg") → tool_calls=[extract_workout_data]
  tool_executor 执行提取 → 结果写回 messages
  supervisor(看到工具结果) → tool_calls=[save_record]
  tool_executor 执行保存 → 结果写回 messages
  supervisor(看到保存成功) → 无 tool_calls，输出最终回复
"""

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.state import AgentState
from app.agent.tools import TOOLS


# 系统提示模板：向 LLM 说明可用工具、使用规则及用户记忆上下文
SYSTEM_PROMPT_TEMPLATE = """You are Sparky, a warm and precise AI fitness and nutrition assistant.

You have access to tools that help you:
- Extract structured workout/nutrition/plan data from user messages
- Analyze food images
- Save records to the database
- Query the user's history and profile
- Update the user's fitness profile

## Available Tools
{tool_descriptions}

## SafetyGuard and immutable medical variables
Medical contraindications, joint limits, and injury-risk rules are immutable system variables.
You must never override, ignore, or soften those constraints.
When creating or updating workout plans, call the plan execution path so SafetyGuard can inspect RPE, frequency, recovery windows, and injury contraindications before the plan is shown as actionable.

## Guidelines
1. When a user describes a workout, meal, or body measurement, use the appropriate extraction tool
2. After extracting data, use `save_record` to persist it
3. When asked about past activities, use `query_history` first
4. When giving personalized advice, use `get_user_profile` to understand the user's context
5. If the user provides new goals, injuries, or preferences, use `update_user_profile`
6. Respond in Chinese (Simplified) unless the user writes in another language
7. Be encouraging and specific in your feedback

## Context
{memory_context}
"""


def _build_tool_descriptions() -> str:
    """根据已注册工具动态生成工具签名与描述列表，注入系统提示中。"""
    lines = []
    for t in TOOLS:
        sig = t.args_schema.model_json_schema() if hasattr(t, "args_schema") and t.args_schema else {}
        props = sig.get("properties", {})
        params = ", ".join(
            f"{name}{'' if prop.get('required') else '?'}: {prop.get('type', 'any')}"
            for name, prop in props.items()
        )
        desc = t.description or "No description"
        lines.append(f"- {t.name}({params}): {desc}")
    return "\n".join(lines)


# 模块级缓存：避免每次调用都重新生成工具描述
TOOL_DESCRIPTIONS = _build_tool_descriptions()


def _format_memory_context(state: AgentState) -> str:
    """将记忆上下文字符串化，供系统提示使用。"""
    memory_prompt = state.get("memory_prompt", "")
    if memory_prompt:
        return f"\n### User Memory\n{memory_prompt}\n"
    return "\n### User Memory\nNo memory available yet.\n"


async def supervisor_agent_node(state: AgentState) -> AgentState:
    """Supervisor 主节点：调用 LLM 并决定下一步路由。"""
    model = get_chat_model()
    if model is None:
        return _no_model_response(state)

    messages = state.get("messages", [])
    if not messages:
        return _no_model_response(state)

    user_message = state.get("user_message", "")
    memory_context = _format_memory_context(state)

    # 构建系统提示
    system_msg = SystemMessage(
        content=SYSTEM_PROMPT_TEMPLATE.format(
            tool_descriptions=TOOL_DESCRIPTIONS,
            memory_context=memory_context,
        )
    )

    # 构造完整对话：系统提示 + 历史消息 + 当前用户消息
    conversation = [system_msg]
    for msg in messages:
        conversation.append(msg)
    last_msg = conversation[-1] if conversation[1:] else None
    if not isinstance(last_msg, HumanMessage) or last_msg.content != user_message:
        conversation.append(HumanMessage(content=user_message))

    # 绑定工具，让 LLM 自主决定 tool_choice
    bound_model = model.bind_tools(TOOLS, tool_choice="auto")
    try:
        response: AIMessage = await bound_model.ainvoke(conversation)
    except Exception:
        return _no_model_response(state)

    # 将 LLM 的回复追加到 messages 中，供后续节点使用
    updated_messages = list(state.get("messages", [])) + [response]

    result: dict[str, Any] = {"messages": updated_messages}

    # 无 tool_calls → 最终回答
    if not response.tool_calls:
        result["ai_response"] = response.content
        result["structured_data"] = {}
        return {**state, **result}

    # 有 tool_calls → 继续 ReAct 循环
    return {**state, **result}


def _no_model_response(state: AgentState) -> AgentState:
    """LLM 不可用时的兜底回复。"""
    return {
        **state,
        "ai_response": "我在。你可以告诉我今天的训练、饮食、体测，或者让我帮你调整接下来的计划。",
        "structured_data": {},
        "messages": state.get("messages", []),
    }
