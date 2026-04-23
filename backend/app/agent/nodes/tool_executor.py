"""
Tool Executor 节点：执行 Supervisor 发起的工具调用

职责：
1. 从最后一条 AIMessage 中解析 tool_calls
2. 根据工具名查找对应工具函数并异步执行
3. 将工具结果封装为 ToolMessage 追加到 messages 列表
4. 若调用的是数据提取类工具（extract_*），将提取结果同步写入 state["structured_data"]

特殊处理：
- analyze_food_image：当用户未提供 image_url 时，自动从 state["base64_image"] 注入
"""

import json
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

from app.agent.state import AgentState
from app.agent.tools import TOOLS_BY_NAME, _analyze_food_image_internal


async def tool_executor_node(state: AgentState) -> AgentState:
    """执行工具调用并将结果回写到状态。"""
    messages = state.get("messages", [])
    if not messages:
        return state

    last_msg = messages[-1]
    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return state

    tool_messages: list[ToolMessage] = []
    tool_call_results: dict[str, Any] = {}
    has_extraction = False

    for tc in last_msg.tool_calls:
        tool_name = tc.get("name") or tc.get("function", {}).get("name", "")
        args = tc.get("args") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}

        # 对食物图像识别做特殊处理：自动注入 state 中的 base64_image
        if tool_name == "analyze_food_image":
            image_url = args.get("image_url") or state.get("base64_image") or ""
            user_msg = args.get("user_message", state.get("user_message", "识别这张图片中的食物"))
            result = await _analyze_food_image_internal(user_msg, image_url)
        else:
            tool = TOOLS_BY_NAME.get(tool_name)
            if tool is None:
                result = {"error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = await tool.ainvoke(args)
                except Exception as e:
                    result = {"error": str(e)}

        # 追踪提取类工具的结果，用于后续 structured_data 回填
        if tool_name in {"extract_workout_data", "extract_nutrition_data", "extract_plan_data"}:
            if isinstance(result, dict):
                has_extraction = True
                tool_call_results[tool_name] = result
                if result.get("entry_date"):
                    state["entry_date"] = result["entry_date"]

        if tool_name == "save_record" and isinstance(result, dict):
            tool_call_results["save_record"] = result

        tool_messages.append(
            ToolMessage(
                content=json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else str(result),
                tool_call_id=tc.get("id", ""),
                name=tool_name,
            )
        )

    # 合并提取数据到 structured_data，供前端展示和保存
    structured_data = dict(state.get("structured_data") or {})
    for tool_name, result in tool_call_results.items():
        if tool_name in {"extract_workout_data", "extract_nutrition_data", "extract_plan_data"} and "data" in result:
            structured_data = result["data"]

    return {
        **state,
        "messages": messages + tool_messages,
        "structured_data": structured_data if has_extraction else state.get("structured_data", {}),
    }
