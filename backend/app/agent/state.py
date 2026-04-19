from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    user_message: str
    session_id: str
    base64_image: str | None
    image_key: str | None
    chat_history: list[dict[str, Any]]

    semantic_memory: dict[str, Any]
    episodic_memory: list[dict[str, Any]]
    working_memory: dict[str, Any]
    memory_prompt: str

    detected_intent: str
    intent_confidence: float
    structured_data: dict[str, Any]
    profile_update: dict[str, Any] | None
    entry_date: str | None

    ai_response: str
    response_payload: dict[str, Any]

