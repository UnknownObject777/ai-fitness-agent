import base64
import importlib

import httpx
import pytest

from app.config import get_settings
from app.services import db


@pytest.fixture
async def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    monkeypatch.setenv("SPARKY_UPLOAD_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    main = importlib.import_module("app.main")
    importlib.reload(main)
    await db.init_db()
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
        yield api
    get_settings.cache_clear()


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
