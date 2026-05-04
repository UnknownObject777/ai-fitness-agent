from app.services.context_budget import build_budgeted_context


def test_budgeted_context_always_includes_full_injury_profile():
    context = build_budgeted_context(
        injury_risk_profile={
            "rules": [
                {"bodyRegion": "left shoulder", "contraindicatedPatterns": ["overhead"], "priority": "hard_constraint"}
            ]
        },
        current_goal={"primaryGoal": "fat_loss", "phase": "base"},
        prompt_strategy={"preferredStyle": "concise_coaching"},
        recent_sets=[{"exerciseName": "bench press", "weightKg": 80, "reps": 8}],
        fatigue={"weeklyFatigue": 0.7, "hrvTrend": "down"},
        strength_model={"bench press": {"estimated1RM": 101.3, "confidence": 0.35}},
        similar_episodes=[{"summary": "Similar high-fatigue upper body day"}],
        max_tokens=2000,
    )

    system = context["systemPrompt"]
    session = context["sessionPrompt"]
    dynamic = context["dynamicRecall"]

    assert "left shoulder" in system
    assert "hard_constraint" in system
    assert "fat_loss" in system
    assert "bench press" in session
    assert "Similar high-fatigue" in dynamic
    assert context["estimatedTokens"] <= 2000
