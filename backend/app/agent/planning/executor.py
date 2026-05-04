from typing import Any

from app.agent.planning.renderers import render_execution_result
from app.agent.planning.safety_guard import SafetyGuard
from app.agent.tools.registry import FitnessToolRegistry, build_fitness_tool_registry
from app.models.planning import PlanExecutionResult, WeeklyPlanDSL


class WorkoutPlanExecutor:
    def __init__(
        self,
        registry: FitnessToolRegistry | None = None,
        safety_guard: SafetyGuard | None = None,
    ) -> None:
        self.registry = registry or build_fitness_tool_registry()
        self.safety_guard = safety_guard or SafetyGuard()

    async def execute(self, plan: WeeklyPlanDSL, state: dict[str, Any]) -> PlanExecutionResult:
        safety = self.safety_guard.check(state, plan)
        if not safety.allowed:
            result = PlanExecutionResult(plan=plan, safety=safety, toolResults=[])
            result.rendered_markdown = render_execution_result(result)
            return result

        tool_results: list[dict[str, Any]] = []
        exercise_tool = self.registry.get("exercise_library")
        if exercise_tool:
            for session in plan.sessions:
                if session.type == "strength":
                    response = await exercise_tool.handler(
                        {
                            "target_muscles": session.muscles,
                            "equipment": ["bodyweight", "dumbbell", "barbell"],
                        }
                    )
                    tool_results.append({"tool": "exercise_library", "day": session.day, "result": response})

        result = PlanExecutionResult(plan=plan, safety=safety, toolResults=tool_results)
        result.rendered_markdown = render_execution_result(result)
        return result
