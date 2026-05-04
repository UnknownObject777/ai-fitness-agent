from app.models.memory import SemanticMemory
from app.models.session import (
    ActivePlan,
    DynamicFitnessProfile,
    FitnessSessionState,
    GoalContext,
    StaticFitnessProfile,
    UserFitnessProfile,
)
from app.services.db import DEFAULT_USER_ID, get_episodic_memories
from app.services.memory import get_or_init_semantic_memory


class FitnessSessionManager:
    async def load_state(
        self,
        user_id: str = DEFAULT_USER_ID,
        session_id: str | None = None,
        chat_history: list[dict] | None = None,
    ) -> FitnessSessionState:
        del session_id, chat_history
        semantic = SemanticMemory.model_validate(await get_or_init_semantic_memory(user_id))
        profile = semantic.user_profile
        recent = await get_episodic_memories(user_id, 10)
        primary_goal = profile.goals[0] if profile.goals else "general_fitness"

        return FitnessSessionState(
            userId=user_id,
            profile=UserFitnessProfile(
                static=StaticFitnessProfile(
                    injuryHistory=profile.injury_history,
                    trainingExperience="unknown",
                ),
                dynamic=DynamicFitnessProfile(
                    weeklyFatigue=float((semantic.weekly_training_stats or {}).get("fatigueScore") or 0),
                    hrvTrend=str((semantic.recovery_pattern or {}).get("hrvTrend") or "unknown"),
                ),
            ),
            history=recent,
            currentPlan=ActivePlan(status="none"),
            goals=GoalContext(primaryGoal=primary_goal),
            latestBiometrics=None,
        )
