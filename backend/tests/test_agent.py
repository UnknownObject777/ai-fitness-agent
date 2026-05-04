import pytest

from app.agent.graph import get_agent_graph
from app.agent.llm import get_chat_model
from app.config import get_settings
from app.services import db


@pytest.fixture(autouse=True)
async def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SPARKY_DATABASE_PATH", str(tmp_path / "fitness.sqlite"))
    get_settings.cache_clear()
    get_chat_model.cache_clear()
    get_agent_graph.cache_clear()
    await db.init_db()
    yield
    get_agent_graph.cache_clear()
    get_chat_model.cache_clear()
    get_settings.cache_clear()


async def test_graph_routes_strength_workout_and_writes_chat():
    graph = get_agent_graph()
    result = await graph.ainvoke(
        {
            "user_message": "今天卧推 3x8 60kg",
            "session_id": "session_1",
            "base64_image": None,
            "image_key": None,
            "chat_history": [{"role": "user", "content": "今天卧推 3x8 60kg"}],
        }
    )

    payload = result["response_payload"]
    assert payload["intent"] == "log_strength_workout"
    assert payload["data"]["training_volume"]["total_sets"] == 3

    messages = await db.get_session_messages("session_1")
    assert [message["role"] for message in messages] == ["user", "assistant"]


async def test_graph_routes_food_image_to_multifood_payload():
    graph = get_agent_graph()
    result = await graph.ainvoke(
        {
            "user_message": "帮我识别这顿饭",
            "session_id": "session_1",
            "base64_image": "data:image/png;base64,abc",
            "image_key": "meal.png",
            "chat_history": [],
        }
    )

    payload = result["response_payload"]
    assert payload["intent"] == "log_food_multi"
    assert payload["needs_user_confirmation"] is True
    assert payload["items"]


async def test_graph_routes_planner():
    graph = get_agent_graph()
    result = await graph.ainvoke(
        {
            "user_message": "给我做一个一周训练计划",
            "session_id": "session_1",
            "chat_history": [],
        }
    )

    payload = result["response_payload"]
    assert payload["intent"] == "generate_workout_plan"
    assert payload["data"]["weekly_templates"]


from app.agent.bridges.router import route_modality
from app.agent.nodes.supervisor_agent import SYSTEM_PROMPT_TEMPLATE
from app.agent.nodes.memory_updater import _infer_intent


def test_supervisor_prompt_contains_safety_first_constraints():
    assert "SafetyGuard" in SYSTEM_PROMPT_TEMPLATE
    assert "Medical contraindications" in SYSTEM_PROMPT_TEMPLATE
    assert "never override" in SYSTEM_PROMPT_TEMPLATE


def test_image_food_route_is_available_to_tool_executor():
    assert route_modality(True, False, "帮我识别午餐照片") == "nutrition_image"


def test_memory_updater_infers_plan_intent_from_plan_execution():
    intent = _infer_intent(
        {
            "plan_execution": {
                "plan": {"goal": "fat_loss", "sessions": []},
                "safety": {"allowed": True},
            }
        }
    )

    assert intent == "generate_workout_plan"
