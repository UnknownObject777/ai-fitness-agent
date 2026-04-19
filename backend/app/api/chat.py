import json

from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse

from app.agent.graph import get_agent_graph
from app.agent.prompts.system import SYSTEM_PROMPT
from app.models.chat import ChatRequest


router = APIRouter()


@router.get("/system-prompt")
async def system_prompt():
    return {"prompt": SYSTEM_PROMPT}


def _initial_state(request: ChatRequest):
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
    graph = get_agent_graph()
    state = _initial_state(request)

    if accept and "text/event-stream" in accept:
        async def event_stream():
            final_state = await graph.ainvoke(state)
            payload = final_state["response_payload"]
            if payload.get("response"):
                yield f"data: {json.dumps({'token': payload['response']}, ensure_ascii=False)}\n\n"
            yield f"event: final_payload\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    final_state = await graph.ainvoke(state)
    return final_state["response_payload"]

