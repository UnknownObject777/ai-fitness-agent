"""
聊天 API 路由：对接 LangGraph Agent 的入口

提供两个接口：
  - GET  /api/system-prompt   获取当前系统提示（调试用）
  - POST /api/chat-openai     主聊天接口，支持 SSE 流式输出和普通 JSON 响应

SSE 流式事件：
  - on_chat_model_stream：LLM 生成的 token，实时推送给前端
  - on_tool_start / on_tool_end：工具调用开始/结束事件，增加透明度
  - final_payload：最终结构化响应（包含 intent、data、entryDate 等）

Agent 图通过 get_agent_graph() 获取单例，状态由 ChatRequest 中的消息和会话信息构建。
"""

import json

from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse

from app.agent.graph import get_agent_graph
from app.agent.prompts.system import SYSTEM_PROMPT
from app.models.chat import ChatRequest


router = APIRouter()


@router.get("/system-prompt")
async def system_prompt():
    """返回当前系统提示文本。"""
    return {"prompt": SYSTEM_PROMPT}


def _initial_state(request: ChatRequest):
    """将前端 ChatRequest 转换为 LangGraph AgentState 的初始状态。"""
    latest = request.messages[-1] if request.messages else None
    return {
        "user_message": latest.content if latest else "",
        "session_id": request.session_id,
        "base64_image": request.base64_image,
        "image_key": request.image_key,
        "chat_history": [message.model_dump() for message in request.messages],
    }


@router.post("/chat-openai")
async def chat_openai(
    request: ChatRequest,
    accept: str | None = Header(default=None),
):
    """
    主聊天接口。

    - 若请求头包含 text/event-stream，返回 SSE 流（实时 token + 工具事件 + 最终 payload）
    - 否则返回完整 JSON 响应
    """
    graph = get_agent_graph()
    state = _initial_state(request)

    if accept and "text/event-stream" in accept:
        async def event_stream():
            final_payload = {}
            async for event in graph.astream_events(state, version="v2"):
                kind = event["event"]
                name = event.get("name", "")

                # 流式输出 LLM token
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        yield f"data: {json.dumps({'token': content}, ensure_ascii=False)}\n\n"

                # 工具调用透明度事件
                elif kind == "on_tool_start":
                    tool_name = event["data"]["input"].get("name", "unknown") if isinstance(event["data"]["input"], dict) else "tool"
                    yield f"data: {json.dumps({'tool_start': tool_name}, ensure_ascii=False)}\n\n"

                elif kind == "on_tool_end":
                    tool_name = event.get("name", "tool")
                    yield f"data: {json.dumps({'tool_end': tool_name}, ensure_ascii=False)}\n\n"

                # 捕获图执行结束时的最终状态
                elif kind == "on_chain_end" and name == "LangGraph":
                    final_state = event["data"]["output"]
                    final_payload = final_state.get("response_payload", {})

            # 发送最终结构化 payload
            yield f"event: final_payload\ndata: {json.dumps(final_payload, ensure_ascii=False)}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    final_state = await graph.ainvoke(state)
    return final_state["response_payload"]
