from app.models.session import (
    ActivePlan,
    DynamicFitnessProfile,
    FitnessSessionState,
    GoalContext,
    StaticFitnessProfile,
    UserFitnessProfile,
    WearableSnapshot,
)


def test_fitness_session_state_splits_static_and_dynamic_profile():
    state = FitnessSessionState(
        userId="user_1",
        profile=UserFitnessProfile(
            static=StaticFitnessProfile(
                age=32,
                sex="male",
                heightCm=176,
                injuryHistory=["left shoulder impingement"],
                jointLimits=["avoid deep overhead pressing"],
            ),
            dynamic=DynamicFitnessProfile(
                weeklyFatigue=0.72,
                hrvTrend="down",
                readinessScore=0.43,
            ),
        ),
        currentPlan=ActivePlan(planId="plan_1", phase="base", week=2, status="active"),
        goals=GoalContext(primaryGoal="fat_loss", secondaryGoals=["strength"], targetDate="2026-08-01"),
        latestBiometrics=WearableSnapshot(
            source="garmin",
            capturedAt="2026-05-04T09:00:00+08:00",
            heartRateAvg=78,
            hrvMs=42,
            sleepScore=61,
        ),
    )

    payload = state.model_dump(by_alias=True)

    assert payload["profile"]["static"]["injuryHistory"] == ["left shoulder impingement"]
    assert payload["profile"]["dynamic"]["weeklyFatigue"] == 0.72
    assert payload["profile"]["dynamic"]["hrvTrend"] == "down"
    assert payload["goals"]["primaryGoal"] == "fat_loss"
