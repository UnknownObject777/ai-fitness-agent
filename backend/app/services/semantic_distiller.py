from copy import deepcopy
from typing import Any

from app.models.memory import SemanticMemory


def _estimate_1rm_epley(weight_kg: float, reps: int) -> float:
    return weight_kg * (1 + reps / 30)


def distill_strength_event(memory: SemanticMemory, event: dict[str, Any]) -> SemanticMemory:
    next_memory = memory.model_copy(deep=True)
    exercise = str(event.get("exerciseName") or event.get("name") or "unknown")
    weight = float(event.get("weightKg") or event.get("weight_kg") or event.get("weight") or 0)
    reps = int(event.get("reps") or 1)
    estimate = round(_estimate_1rm_epley(weight, reps), 2)
    current = deepcopy(next_memory.strength_model.get(exercise))

    if not current:
        next_memory.strength_model[exercise] = {
            "estimated1RM": estimate,
            "confidence": 0.35,
            "samples": 1,
            "method": "epley_bayesian_smoothing",
        }
        return next_memory

    samples = int(current.get("samples") or 1) + 1
    old_confidence = float(current.get("confidence") or 0.35)
    smoothing = min(0.65, 0.25 + samples * 0.05)
    blended = current["estimated1RM"] * (1 - smoothing) + estimate * smoothing
    next_memory.strength_model[exercise] = {
        "estimated1RM": round(blended, 2),
        "confidence": min(0.95, round(old_confidence + 0.12, 2)),
        "samples": samples,
        "method": "epley_bayesian_smoothing",
    }
    return next_memory


def distill_injury_event(memory: SemanticMemory, event: dict[str, Any]) -> SemanticMemory:
    next_memory = memory.model_copy(deep=True)
    profile = dict(next_memory.injury_risk_profile or {"rules": []})
    rules = list(profile.get("rules") or [])
    body_region = str(event.get("bodyRegion") or event.get("body_region") or "unknown")
    note = str(event.get("note") or "")
    patterns = ["overhead"] if "shoulder" in body_region.lower() or "press" in note.lower() else ["high_load"]
    rules.insert(
        0,
        {
            "bodyRegion": body_region,
            "contraindicatedPatterns": patterns,
            "substitutions": ["reduce range of motion", "use bands", "lower RPE target"],
            "priority": "hard_constraint",
            "source": "injury_event",
        },
    )
    profile["rules"] = rules
    next_memory.injury_risk_profile = profile
    return next_memory
