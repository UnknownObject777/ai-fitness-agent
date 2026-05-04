import base64
import importlib

import httpx
import pytest

from app.config import get_settings
from app.agent.graph import get_agent_graph
from app.agent.llm import get_chat_model
from app.services import db


@pytest.fixture
async def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    monkeypatch.setenv("SPARKY_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    get_chat_model.cache_clear()
    get_agent_graph.cache_clear()
    main = importlib.import_module("app.main")
    importlib.reload(main)
    await db.init_db()
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
        yield api
    get_settings.cache_clear()
    get_chat_model.cache_clear()
    get_agent_graph.cache_clear()


async def test_chat_openai_json_compatibility(client):
    response = await client.post(
        "/api/chat-openai",
        json={
            "sessionId": "session_1",
            "messages": [{"role": "user", "content": "今天卧推 3x8 60kg"}],
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["success"] is True
    assert payload["intent"] == "log_strength_workout"
    assert payload["data"]["training_volume"]["total_sets"] == 3


async def test_sessions_and_logs_routes(client):
    session_response = await client.post("/api/chat-sessions", json={"title": "Check-in"})
    session = session_response.json()["session"]

    patch_response = await client.patch(f"/api/chat-sessions/{session['id']}", json={"archived": True})
    assert patch_response.json()["session"]["archived"] is True

    record_response = await client.post(
        "/api/save-record",
        json={"intent": "log_food", "data": {"food_name": "oats", "calories": 300}, "entryDate": "2026-04-19"},
    )
    record = record_response.json()["record"]
    logs = (await client.get("/api/logs")).json()
    assert any(item["id"] == record["id"] for item in logs)


async def test_upload_image_route(client):
    content = base64.b64encode(b"png").decode("ascii")
    response = await client.post("/api/upload-image", json={"base64Image": f"data:image/png;base64,{content}"})
    payload = response.json()

    assert response.status_code == 200
    assert payload["success"] is True
    assert payload["imageUrl"].startswith("/uploads/")


async def test_plan_preview_blocks_unsafe_payload(client):
    response = await client.post(
        "/api/plans/preview",
        json={
            "userId": "user_1",
            "plan": {
                "goal": "fat_loss",
                "days": 5,
                "sessions": [
                    {"day": "Monday", "type": "strength", "duration": 45, "rpeTarget": 9.5}
                ],
            },
            "state": {
                "profile": {
                    "static": {"trainingExperience": "beginner"},
                    "dynamic": {"weeklyFatigue": 0.2}
                }
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["safety"]["allowed"] is False


async def test_plan_feedback_records_signal(client):
    response = await client.post(
        "/api/plans/feedback",
        json={
            "userId": "user_1",
            "planId": "plan_1",
            "signal": "completed",
            "score": 0.9,
            "communicationStyle": "concise_coaching",
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
