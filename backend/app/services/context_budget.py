import json
from typing import Any


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _json_line(label: str, value: Any) -> str:
    return f"- {label}: {json.dumps(value, ensure_ascii=False, separators=(',', ':'))}"


def build_budgeted_context(
    injury_risk_profile: dict[str, Any],
    current_goal: dict[str, Any],
    prompt_strategy: dict[str, Any],
    recent_sets: list[dict[str, Any]],
    fatigue: dict[str, Any],
    strength_model: dict[str, Any],
    similar_episodes: list[dict[str, Any]],
    max_tokens: int = 2000,
) -> dict[str, Any]:
    system_lines = [
        "## System Memory",
        _json_line("InjuryRiskProfile", injury_risk_profile),
        _json_line("CurrentGoal", current_goal),
        _json_line("PromptStrategy", prompt_strategy),
    ]
    session_lines = [
        "## Session Memory",
        _json_line("RecentSameTypeSetRecords", recent_sets[:3]),
        _json_line("FatigueAndHRV", fatigue),
        _json_line("StrengthModel", strength_model),
    ]
    dynamic_lines = [
        "## Dynamic Recall",
        _json_line("SimilarHistoricalEpisodes", similar_episodes[:3]),
    ]

    system_prompt = "\n".join(system_lines)
    session_prompt = "\n".join(session_lines)
    dynamic_recall = "\n".join(dynamic_lines)
    estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    if estimated > max_tokens:
        dynamic_recall = "## Dynamic Recall\n- SimilarHistoricalEpisodes: []"
        estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    if estimated > max_tokens:
        session_prompt = "\n".join(
            [
                "## Session Memory",
                _json_line("RecentSameTypeSetRecords", recent_sets[:1]),
                _json_line("FatigueAndHRV", fatigue),
                _json_line("StrengthModel", strength_model),
            ]
        )
        estimated = estimate_tokens(system_prompt + session_prompt + dynamic_recall)

    return {
        "systemPrompt": system_prompt,
        "sessionPrompt": session_prompt,
        "dynamicRecall": dynamic_recall,
        "estimatedTokens": estimated,
    }
