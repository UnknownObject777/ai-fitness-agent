from typing import Any

from app.models.planning import SafetyIssue, SafetyResult, WeeklyPlanDSL


class SafetyGuard:
    def check(self, state: dict[str, Any], plan: WeeklyPlanDSL) -> SafetyResult:
        issues: list[SafetyIssue] = []
        profile = state.get("profile") or {}
        static = profile.get("static") or {}
        dynamic = profile.get("dynamic") or {}
        training_experience = static.get("trainingExperience") or static.get("training_experience") or "unknown"
        fatigue = float(dynamic.get("weeklyFatigue") or 0)

        if training_experience == "beginner":
            for session in plan.sessions:
                if session.rpe_target > 8:
                    issues.append(
                        SafetyIssue(
                            code="rpe_too_high",
                            message=f"{session.day} targets RPE {session.rpe_target}, which is too high for a beginner.",
                            severity="blocker",
                            suggestions=["cap RPE at 7.5", "reduce load", "add rest intervals"],
                        )
                    )

        if fatigue >= 0.75 and plan.days >= 5:
            issues.append(
                SafetyIssue(
                    code="frequency_recovery_conflict",
                    message="Weekly fatigue is high and planned frequency leaves too little recovery.",
                    severity="blocker",
                    suggestions=["reduce to 3 training days", "replace HIIT with mobility"],
                )
            )

        injury_rules = (
            (state.get("semanticMemory") or {})
            .get("injuryRiskProfile", {})
            .get("rules", [])
        )
        for rule in injury_rules:
            patterns = [str(item).lower() for item in rule.get("contraindicatedPatterns") or []]
            substitutions = [str(item) for item in rule.get("substitutions") or []]
            for session in plan.sessions:
                exercise_names = " ".join(str(item.get("name") or "").lower() for item in session.exercises)
                if any(pattern in exercise_names for pattern in patterns):
                    issues.append(
                        SafetyIssue(
                            code="injury_contraindication",
                            message=f"{session.day} contains a pattern blocked by {rule.get('bodyRegion')}.",
                            severity="blocker",
                            suggestions=substitutions,
                        )
                    )

        return SafetyResult(allowed=not any(issue.severity == "blocker" for issue in issues), issues=issues)
