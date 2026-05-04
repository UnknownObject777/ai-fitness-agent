import pytest

from app.config import get_settings
from app.services import db
from app.services.procedural_memory import record_feedback_signal, retrieve_prompt_strategy


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    await db.init_db()
    yield
    get_settings.cache_clear()


async def test_feedback_signal_updates_prompt_strategy_weight():
    await record_feedback_signal(
        user_id="user_1",
        plan_id="plan_1",
        signal="completed",
        score=0.9,
        communication_style="concise_coaching",
    )

    strategy = await retrieve_prompt_strategy("user_1")

    assert strategy["preferredStyle"] == "concise_coaching"
    assert strategy["confidence"] == 0.6
