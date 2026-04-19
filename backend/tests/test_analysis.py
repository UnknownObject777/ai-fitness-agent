import importlib

import httpx
import pytest

from app.config import get_settings
from app.services import db
from app.services.nutrition_api_service import search_food_logics
from app.services.nutrition_service import get_nutrition_analysis
from app.services.training_analytics import get_body_metrics_trend, get_workout_trends


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    monkeypatch.setenv("SPARKY_UPLOAD_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def seed_activity():
    await db.save_record(
        "log_strength_workout",
        {"workout_name": "bench", "duration_minutes": 45, "exercises": [{"name": "bench press", "sets": [{"weight": 60, "reps": 8}]}]},
        "2026-04-19",
    )
    await db.save_record("log_food", {"food_name": "oats", "calories": 389, "protein": 17, "carbs": 66, "fat": 7}, "2026-04-19")
    await db.save_record("log_measurement", {"weight_kg": 70}, "2026-04-19")


async def test_analysis_services_return_frontend_shapes():
    await seed_activity()
    workout = await get_workout_trends("user_1", "30d")
    nutrition = await get_nutrition_analysis("user_1", "30d")
    body = await get_body_metrics_trend("user_1", "90d")
    foods = await search_food_logics("鸡")

    assert workout["summary"]["totalWorkouts"] >= 1
    assert workout["trendPoints"][0]["totalVolume"] == 480
    assert nutrition["summary"]["daysLogged"] >= 1
    assert body[0]["weight_kg"] == 70
    assert foods


async def test_analysis_api_routes(tmp_path, monkeypatch):
    await seed_activity()
    main = importlib.import_module("app.main")
    importlib.reload(main)
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        workout = (await client.get("/api/analysis/workout-trends")).json()
        nutrition = (await client.get("/api/analysis/nutrition")).json()
        dictionary = (await client.get("/api/dictionary/foods?q=鸡")).json()

    assert workout["success"] is True
    assert nutrition["success"] is True
    assert dictionary["data"]
