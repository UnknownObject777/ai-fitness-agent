from app.models.memory import SemanticMemory
from app.services.semantic_distiller import distill_strength_event, distill_injury_event


def test_strength_model_updates_estimate_and_confidence_without_overwrite():
    memory = SemanticMemory(userId="user_1")

    updated = distill_strength_event(
        memory,
        {
            "exerciseName": "bench press",
            "weightKg": 80,
            "reps": 8,
            "rpe": 8,
        },
    )

    estimate = updated.strength_model["bench press"]

    assert round(estimate["estimated1RM"], 1) == 101.3
    assert estimate["confidence"] == 0.35

    updated_again = distill_strength_event(
        updated,
        {
            "exerciseName": "bench press",
            "weightKg": 82.5,
            "reps": 6,
            "rpe": 8,
        },
    )

    assert updated_again.strength_model["bench press"]["confidence"] > estimate["confidence"]
    assert updated_again.strength_model["bench press"]["estimated1RM"] != estimate["estimated1RM"]


def test_injury_event_becomes_hard_constraint_rule():
    memory = SemanticMemory(userId="user_1")

    updated = distill_injury_event(
        memory,
        {"bodyRegion": "left shoulder", "severity": 0.9, "note": "pain during dumbbell shoulder press"},
    )

    rules = updated.injury_risk_profile["rules"]

    assert rules[0]["bodyRegion"] == "left shoulder"
    assert "overhead" in rules[0]["contraindicatedPatterns"]
    assert rules[0]["priority"] == "hard_constraint"
