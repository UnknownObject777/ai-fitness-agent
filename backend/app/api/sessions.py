from fastapi import APIRouter, HTTPException

from app.models.chat import ChatSessionCreate, ChatSessionUpdate
from app.services.db import (
    create_chat_session,
    delete_chat_session,
    get_session_messages,
    list_chat_sessions,
    update_chat_session,
)


router = APIRouter()


@router.get("/chat/{session_id}")
async def get_chat(session_id: str):
    return {"success": True, "messages": await get_session_messages(session_id)}


@router.get("/chat-sessions")
async def get_chat_sessions(scope: str = "active"):
    return {"success": True, "sessions": await list_chat_sessions(scope)}


@router.post("/chat-sessions")
async def post_chat_session(request: ChatSessionCreate):
    return {"success": True, "session": await create_chat_session(request.title)}


@router.patch("/chat-sessions/{session_id}")
async def patch_chat_session(session_id: str, request: ChatSessionUpdate):
    updates = request.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No valid updates provided")
    try:
        return {"success": True, "session": await update_chat_session(session_id, updates)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/chat-sessions/{session_id}")
async def remove_chat_session(session_id: str):
    try:
        await delete_chat_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"success": True}

