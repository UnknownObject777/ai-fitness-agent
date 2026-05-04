"""
Supervisor Agent 节点：LangGraph ReAct 循环的决策核心

职责：
1. 绑定全部工具（bind_tools），让 LLM 自主决定调用哪些工具
2. 构建对话上下文（SystemMessage + 用户记忆 + 历史消息）
3. 调用 LLM 并判断：
   - 若返回 tool_calls → 进入 tool_executor 节点，等待工具执行结果后再次循环
   - 若无 tool_calls → 视为最终回答，进入 memory_updater 节点
4. LLM 不可用时，使用确定性关键词匹配路由到对应提取工具（离线兜底）

多轮循环示例：
  supervisor(用户说"深蹲80kg") → tool_calls=[extract_workout_data]
  tool_executor 执行提取 → 结果写回 messages
  supervisor(看到工具结果) → tool_calls=[save_record]
  tool_executor 执行保存 → 结果写回 messages
  supervisor(看到保存成功) → 无 tool_calls，输出最终回复
"""

import re
from typing import Any
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

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


# ---- 确定性意图检测（LLM 不可用时的离线兜底路由） ----

_STRENGTH_KEYWORDS = re.compile(
    r"(?:卧推|深蹲|硬拉|划船|推举|弯举|飞鸟|卧推|肩推|"
    r"bench|squat|deadlift|row|press|curl|fly|"
    r"\d+\s*[xX*×]\s*\d+|\d+\s*(?:kg|公斤|组|sets?))",
    re.IGNORECASE,
)
_MEASUREMENT_KEYWORDS = re.compile(
    r"(?:体重|体脂|身高|腰围|胸围|bmi|weight\s*(?:kg)?|body\s*fat)",
    re.IGNORECASE,
)
_NUTRITION_KEYWORDS = re.compile(
    r"(?:吃了|吃了|喝了|餐|饭|食物|卡路里|热量|kcal|蛋白质|碳水|"
    r"早餐|午餐|晚餐|加餐|零食|ate|food|meal|snack)",
    re.IGNORECASE,
)
_PLAN_KEYWORDS = re.compile(
    r"(?:训练计划|健身计划|减脂计划|增肌计划|周计划|"
    r"workout\s*plan|training\s*plan|program|计划)",
    re.IGNORECASE,
)
_EXERCISE_KEYWORDS = re.compile(
    r"(?:跑步|游泳|骑行|跳绳|有氧|步行|"
    r"run|swim|bike|jog|cardio|walk)",
    re.IGNORECASE,
)


def _detect_intent_from_text(text: str) -> str:
    """从用户消息中确定性地推断意图，用于 LLM 不可用时的路由。"""
    if _STRENGTH_KEYWORDS.search(text):
        return "log_strength_workout"
    if _MEASUREMENT_KEYWORDS.search(text):
        return "log_measurement"
    if _PLAN_KEYWORDS.search(text):
        return "generate_workout_plan"
    if _NUTRITION_KEYWORDS.search(text):
        return "log_food"
    if _EXERCISE_KEYWORDS.search(text):
        return "log_exercise"
    return "chat"


def _build_fallback_tool_calls(state: AgentState) -> list[dict[str, Any]] | None:
    """LLM 不可用时，根据关键词匹配构造确定性 tool_calls。"""
    user_message = state.get("user_message", "")
    base64_image = state.get("base64_image")
    intent = _detect_intent_from_text(user_message)

    if intent == "log_strength_workout" or intent == "log_measurement":
        return [
            {
                "name": "extract_workout_data",
                "args": {"intent": intent, "user_message": user_message},
                "id": f"call_{uuid4().hex[:8]}",
                "type": "tool_call",
            }
        ]

    if intent == "log_food":
        if base64_image:
            return [
                {
                    "name": "analyze_food_image",
                    "args": {"image_url": base64_image, "user_message": user_message},
                    "id": f"call_{uuid4().hex[:8]}",
                    "type": "tool_call",
                }
            ]
        return [
            {
                "name": "extract_nutrition_data",
                "args": {"user_message": user_message},
                "id": f"call_{uuid4().hex[:8]}",
                "type": "tool_call",
            }
        ]

    if intent == "generate_workout_plan":
        return [
            {
                "name": "extract_plan_data",
                "args": {"intent": intent, "user_message": user_message},
                "id": f"call_{uuid4().hex[:8]}",
                "type": "tool_call",
            }
        ]

    if intent == "log_exercise":
        return [
            {
                "name": "extract_workout_data",
                "args": {"intent": intent, "user_message": user_message},
                "id": f"call_{uuid4().hex[:8]}",
                "type": "tool_call",
            }
        ]

    # 图片且无明确食物意图 → 尝试图片识别
    if base64_image:
        return [
            {
                "name": "analyze_food_image",
                "args": {"image_url": base64_image, "user_message": user_message or "识别这张图片"},
                "id": f"call_{uuid4().hex[:8]}",
                "type": "tool_call",
            }
        ]

    return None


async def supervisor_agent_node(state: AgentState) -> AgentState:
    """Supervisor 主节点：调用 LLM 并决定下一步路由。"""
    model = get_chat_model()

    messages = state.get("messages", [])
    user_message = state.get("user_message", "")

    # ---- LLM 不可用时的确定性兜底路由 ----
    if model is None:
        # 若最后一条消息是 ToolMessage，说明工具已执行完毕，直接结束
        last_msg = messages[-1] if messages else None
        if isinstance(last_msg, ToolMessage):
            return _no_model_response(state)

        tool_calls = _build_fallback_tool_calls(state)
        if tool_calls:
            response = AIMessage(content="", tool_calls=tool_calls)
            return {
                **state,
                "messages": list(messages) + [response],
            }
        return _no_model_response(state)

    if not messages:
        return _no_model_response(state)

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
        # LLM 调用失败 → 也走确定性兜底
        tool_calls = _build_fallback_tool_calls(state)
        if tool_calls:
            fallback_response = AIMessage(content="", tool_calls=tool_calls)
            return {
                **state,
                "messages": list(messages) + [fallback_response],
            }
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
    """LLM 不可用且无法确定性路由时的兜底回复。"""
    return {
        **state,
        "ai_response": "我在。你可以告诉我今天的训练、饮食、体测，或者让我帮你调整接下来的计划。",
        "structured_data": state.get("structured_data", {}),
        "messages": state.get("messages", []),
    }
