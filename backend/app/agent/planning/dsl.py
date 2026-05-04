from app.models.planning import PlanSession, WeeklyPlanDSL


def create_weekly_plan(goal: str, days: int) -> WeeklyPlanDSL:
    return WeeklyPlanDSL(goal=goal, days=days, sessions=[])


def add_session(plan: WeeklyPlanDSL, session: PlanSession) -> WeeklyPlanDSL:
    next_plan = plan.model_copy(deep=True)
    next_plan.sessions.append(session)
    return next_plan
