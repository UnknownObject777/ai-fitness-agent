from app.agent.planning.safety_guard import SafetyGuard
from app.models.planning import PlanSession, WeeklyPlanDSL


def test_safety_guard_rejects_high_rpe_for_beginner():
    guard = SafetyGuard()
    plan = WeeklyPlanDSL(
        goal="fat_loss",
        days=5,
        sessions=[
            PlanSession(day="Monday", type="strength", duration=60, intensity=0.8, rpeTarget=9.5),
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "beginner", "injuryHistory": []},
            "dynamic": {"weeklyFatigue": 0.2, "hrvTrend": "flat"},
        }
    }

    result = guard.check(state, plan)

    assert result.allowed is False
    assert result.issues[0].code == "rpe_too_high"


def test_safety_guard_adds_injury_constraint_substitution():
    guard = SafetyGuard()
    plan = WeeklyPlanDSL(
        goal="muscle_gain",
        days=3,
        sessions=[
            PlanSession(
                day="Wednesday",
                type="strength",
                duration=45,
                intensity=0.7,
                rpeTarget=7,
                exercises=[{"name": "dumbbell shoulder press"}],
            ),
        ],
    )
    state = {
        "profile": {
            "static": {"trainingExperience": "intermediate", "injuryHistory": ["left shoulder"]},
            "dynamic": {"weeklyFatigue": 0.2, "hrvTrend": "flat"},
        },
        "semanticMemory": {
            "injuryRiskProfile": {
                "rules": [
                    {
                        "bodyRegion": "left shoulder",
                        "contraindicatedPatterns": ["overhead", "shoulder press"],
                        "substitutions": ["band external rotation", "landmine press"],
                        "priority": "hard_constraint",
                    }
                ]
            }
        },
    }

    result = guard.check(state, plan)

    assert result.allowed is False
    assert result.issues[0].code == "injury_contraindication"
    assert "landmine press" in result.issues[0].suggestions
