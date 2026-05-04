from app.models.planning import PlanExecutionResult, SafetyResult, WeeklyPlanDSL


def render_safety_result(safety: SafetyResult) -> str:
    if safety.allowed:
        return "SafetyGuard: allowed"
    lines = ["SafetyGuard: blocked"]
    for issue in safety.issues:
        lines.append(f"- {issue.code}: {issue.message}")
        if issue.suggestions:
            lines.append(f"  Suggestions: {', '.join(issue.suggestions)}")
    return "\n".join(lines)


def render_plan(plan: WeeklyPlanDSL) -> str:
    lines = [f"Plan goal: {plan.goal}", f"Training days: {plan.days}"]
    for session in plan.sessions:
        lines.append(f"- {session.day}: {session.type}, {session.duration} min, RPE {session.rpe_target}")
    return "\n".join(lines)


def render_execution_result(result: PlanExecutionResult) -> str:
    return "\n\n".join([render_safety_result(result.safety), render_plan(result.plan)])
