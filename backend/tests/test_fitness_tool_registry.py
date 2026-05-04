from app.agent.tools.registry import build_fitness_tool_registry


def test_fitness_registry_exposes_core_domain_tools_with_schema():
    registry = build_fitness_tool_registry()

    names = registry.names()
    schema = registry.json_schema()

    assert "exercise_library" in names
    assert "injury_risk_assessor" in names
    assert "recovery_advisor" in names
    assert "competition_planner" in names
    assert schema["exercise_library"]["description"]
    assert "target_muscles" in schema["exercise_library"]["parameters"]["properties"]
