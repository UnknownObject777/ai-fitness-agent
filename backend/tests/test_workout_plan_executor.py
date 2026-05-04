from app.agent.planning.executor import WorkoutPlanExecutor
from app.agent.tools.registry import build_fitness_tool_registry
from app.models.planning import PlanSession, WeeklyPlanDSL


async def test_executor_blocks_unsafe_plan_before_tool_execution():
    executor = WorkoutPlanExecutor(registry=build_fitness_tool_registry())
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=5,
        sessions=[PlanSession(day="Monday", type="strength", duration=45, rpeTarget=9.5)],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "beginner"},
            "dynamic": {"weeklyFatigue": 0.2},
        }
    }

    result = await executor.execute(plan, state)

    assert result.safety.allowed is False
    assert result.tool_results == []
    assert "rpe_too_high" in result.rendered_markdown


async def test_executor_runs_domain_tools_for_safe_plan():
    executor = WorkoutPlanExecutor(registry=build_fitness_tool_registry())
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=3,
        sessions=[
            PlanSession(
                day="Monday",
                type="strength",
                duration=45,
                rpeTarget=7,
                muscles=["chest"],
            )
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "intermediate", "injuryHistory": []},
            "dynamic": {"weeklyFatigue": 0.2},
        }
    }

    result = await executor.execute(plan, state)

    assert result.safety.allowed is True
    assert result.tool_results[0]["tool"] == "exercise_library"
    assert "Monday" in result.rendered_markdown
