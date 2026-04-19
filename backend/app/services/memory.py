from datetime import UTC, datetime, timedelta
from typing import Any

from app.models.memory import AgentContext, SemanticMemory, UserProfile, WeeklyTrainingStats, WorkingMemory
from app.services.db import DEFAULT_USER_ID, get_episodic_memories, get_semantic_memory, save_semantic_memory


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


async def get_or_init_semantic_memory(user_id: str = DEFAULT_USER_ID) -> dict[str, Any]:
    existing = await get_semantic_memory(user_id)
    if existing:
        return SemanticMemory.model_validate(existing).model_dump(by_alias=True)

    initial = SemanticMemory(userId=user_id)
    payload = initial.model_dump(by_alias=True)
    await save_semantic_memory(user_id, payload)
    return payload


async def update_semantic_memory(
    updates: dict[str, Any],
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    memory = await get_or_init_semantic_memory(user_id)
    profile = UserProfile.model_validate(memory.get("userProfile") or {})

    if isinstance(updates.get("goals"), list):
        profile.goals = _dedupe([*profile.goals, *[str(item) for item in updates["goals"]]])
    if isinstance(updates.get("weakPoints"), list):
        profile.weak_points = _dedupe([*profile.weak_points, *[str(item) for item in updates["weakPoints"]]])
    if isinstance(updates.get("injuryHistory"), list):
        profile.injury_history = _dedupe(
            [*profile.injury_history, *[str(item) for item in updates["injuryHistory"]]]
        )
    if isinstance(updates.get("preferredStyle"), str) and updates["preferredStyle"].strip():
        profile.preferred_style = updates["preferredStyle"].strip()

    memory["userProfile"] = profile.model_dump(by_alias=True)
    if isinstance(updates.get("weeklyTrainingStats"), dict):
        memory["weeklyTrainingStats"] = updates["weeklyTrainingStats"]
    if isinstance(updates.get("strengthModel"), dict):
        memory["strengthModel"] = updates["strengthModel"]
    memory["updatedAt"] = datetime.now(UTC).isoformat()
    await save_semantic_memory(user_id, memory)
    return memory


async def build_agent_context(
    user_message: str,
    session_id: str | None,
    recent_messages: list[dict[str, Any]] | None = None,
) -> AgentContext:
    semantic_memory = SemanticMemory.model_validate(await get_or_init_semantic_memory())
    recent_episodes = await get_episodic_memories(DEFAULT_USER_ID, 10)
    messages = recent_messages or []
    working_memory = WorkingMemory(
        sessionId=session_id,
        recentUserMessages=[
            {"role": str(msg.get("role", "")), "content": str(msg.get("content", ""))}
            for msg in messages[-5:]
        ],
    )

    return AgentContext(
        semanticMemory=semantic_memory,
        recentEpisodes=[
            {
                "date": episode.get("entryDate"),
                "intent": episode.get("intent"),
                "summary": format_episode_summary(episode),
            }
            for episode in recent_episodes
        ],
        workingMemory=working_memory,
        userMessage=user_message,
    )


def format_episode_summary(episode: dict[str, Any]) -> str:
    intent = episode.get("intent")
    data = episode.get("data") or {}
    if intent == "log_food":
        return f"Food log: ate {data.get('food_name') or data.get('name') or 'food'}, about {data.get('calories', 0)} kcal"
    if intent == "log_food_multi":
        total = data.get("total") if isinstance(data.get("total"), dict) else {}
        return f"Food photo log: {len(data.get('items') or [])} items, about {total.get('kcal', 0)} kcal"
    if intent == "log_exercise":
        return f"Exercise log: {data.get('exercise_name') or 'exercise'}, {data.get('duration_minutes', 0)} min"
    if intent == "log_strength_workout":
        return f"Strength workout: {data.get('workout_name') or 'workout'}, {data.get('duration_minutes', 0)} min"
    if intent == "log_measurement":
        return f"Body metrics: weight {data.get('weight_kg', 'unknown')} kg"
    return f"Recorded {intent}"


def format_context_as_system_prompt(ctx: AgentContext) -> str:
    memory = ctx.semantic_memory
    profile = memory.user_profile
    episodes = ctx.recent_episodes
    working = ctx.working_memory

    goals = ", ".join(profile.goals) or "not set"
    weak_points = ", ".join(profile.weak_points) or "none"
    injuries = ", ".join(profile.injury_history) or "none"
    episode_lines = "\n".join(f"- [{item.get('date')}] {item.get('summary')}" for item in episodes)
    if not episode_lines:
        episode_lines = "No recent activity records."
    recent_chat = " | ".join(
        f"[{msg.get('role')}] {msg.get('content', '')[:50]}" for msg in working.recent_user_messages
    )
    if not recent_chat:
        recent_chat = "No recent messages."

    return f"""
## User Memory (Long-term and Short-term)

### Semantic Memory
- Goals: {goals}
- Known weak points: {weak_points}
- Preferred style: {profile.preferred_style}
- Injury history: {injuries}

### Recent Activity
{episode_lines}

### Working Memory
- Session ID: {working.session_id or "new session"}
- Recent messages: {recent_chat}

Use this context to provide personalized, professional, warm fitness and nutrition guidance.
""".strip()


EXERCISE_MUSCLE_MAP: dict[str, dict[str, list[str]]] = {
    "bench": {"primary": ["chest"], "secondary": ["triceps", "front delts"]},
    "press": {"primary": ["shoulders"], "secondary": ["triceps"]},
    "squat": {"primary": ["quads", "glutes"], "secondary": ["hamstrings", "core"]},
    "deadlift": {"primary": ["back", "hamstrings", "glutes"], "secondary": ["forearms", "core"]},
    "row": {"primary": ["back"], "secondary": ["biceps", "rear delts"]},
    "pull-up": {"primary": ["back"], "secondary": ["biceps", "core"]},
    "卧推": {"primary": ["胸部"], "secondary": ["肱三头肌", "肩部前束"]},
    "深蹲": {"primary": ["股四头肌", "臀部"], "secondary": ["腘绳肌", "核心"]},
    "硬拉": {"primary": ["背部", "腘绳肌", "臀部"], "secondary": ["前臂", "核心"]},
    "划船": {"primary": ["背部"], "secondary": ["肱二头肌", "后束"]},
}


def _exercise_mapping(name: str, exercise: dict[str, Any]) -> dict[str, list[str]]:
    lower = name.lower()
    for key, mapping in EXERCISE_MUSCLE_MAP.items():
        if key.lower() in lower:
            return mapping
    muscle_groups = exercise.get("muscle_groups") or exercise.get("muscleGroups")
    if isinstance(muscle_groups, dict):
        return {
            "primary": list(muscle_groups.get("primary") or ["unknown"]),
            "secondary": list(muscle_groups.get("secondary") or []),
        }
    if isinstance(muscle_groups, list):
        return {"primary": list(muscle_groups), "secondary": []}
    return {"primary": ["unknown"], "secondary": []}


def analyze_muscle_groups(workout_data: dict[str, Any]) -> dict[str, Any]:
    muscle_groups: dict[str, dict[str, float]] = {}
    total_volume = 0.0
    total_sets = 0

    for exercise in workout_data.get("exercises") or []:
        if not isinstance(exercise, dict):
            continue
        name = str(exercise.get("name") or exercise.get("exercise_name") or "")
        mapping = _exercise_mapping(name, exercise)
        sets = exercise.get("sets") if isinstance(exercise.get("sets"), list) else []

        for item in sets:
            if not isinstance(item, dict):
                continue
            weight = float(item.get("weight") or item.get("weight_kg") or 0)
            reps = float(item.get("reps") or 0)
            set_volume = weight * reps
            total_volume += set_volume
            total_sets += 1

            for muscle in mapping["primary"]:
                muscle_groups.setdefault(muscle, {"sets": 0, "volumeLoad": 0})
                muscle_groups[muscle]["sets"] += 1
                muscle_groups[muscle]["volumeLoad"] += set_volume
            for muscle in mapping["secondary"]:
                muscle_groups.setdefault(muscle, {"sets": 0, "volumeLoad": 0})
                muscle_groups[muscle]["sets"] += 0.5
                muscle_groups[muscle]["volumeLoad"] += set_volume * 0.5

    return {"muscleGroups": muscle_groups, "totalVolume": total_volume, "totalSets": total_sets}


async def aggregate_weekly_stats(
    user_id: str,
    week_id: str,
    workout_records: list[dict[str, Any]],
) -> dict[str, Any]:
    del user_id
    year, week = [int(part) for part in week_id.split("-W")]
    start_date = get_week_start_date(year, week)
    end_date = start_date + timedelta(days=6)
    muscle_group_volume: dict[str, dict[str, Any]] = {}
    exercise_records: dict[str, dict[str, Any]] = {}

    for record in workout_records:
        data = record.get("data") or {}
        analysis = analyze_muscle_groups(data)
        for muscle, values in analysis["muscleGroups"].items():
            entry = muscle_group_volume.setdefault(
                muscle,
                {"totalSets": 0, "totalReps": 0, "totalVolumeLoad": 0, "workouts": []},
            )
            entry["totalSets"] += values["sets"]
            entry["totalVolumeLoad"] += values["volumeLoad"]
            entry["workouts"].append(record.get("id"))

        for exercise in data.get("exercises") or []:
            if not isinstance(exercise, dict):
                continue
            name = str(exercise.get("name") or exercise.get("exercise_name") or "unknown")
            entry = exercise_records.setdefault(name, {"bestWeight": 0, "bestReps": 0, "totalSets": 0})
            raw_sets = exercise.get("sets") or []
            if isinstance(raw_sets, int):
                raw_sets = [{"weight": exercise.get("weight_kg") or exercise.get("weight") or 0, "reps": exercise.get("reps") or 0} for _ in range(raw_sets)]
            if not isinstance(raw_sets, list):
                raw_sets = []
            for item in raw_sets:
                if not isinstance(item, dict):
                    continue
                weight = float(item.get("weight") or item.get("weight_kg") or 0)
                reps = int(item.get("reps") or 0)
                entry["totalSets"] += 1
                if weight > entry["bestWeight"]:
                    entry["bestWeight"] = weight
                    entry["bestReps"] = reps

    stats = WeeklyTrainingStats(
        weekId=week_id,
        startDate=start_date.isoformat(),
        endDate=end_date.isoformat(),
        totalWorkouts=len(workout_records),
        muscleGroupVolume=muscle_group_volume,
        exerciseRecords=exercise_records,
    )
    return stats.model_dump(by_alias=True)


def get_week_start_date(year: int, week: int) -> datetime:
    january_first = datetime(year, 1, 1, tzinfo=UTC)
    days_offset = (week - 1) * 7 - january_first.weekday()
    return january_first + timedelta(days=days_offset)


def get_week_number(date: datetime) -> int:
    return date.isocalendar().week


def merge_weekly_stats(existing: dict[str, Any], new_stats: dict[str, Any]) -> dict[str, Any]:
    existing["totalWorkouts"] = int(existing.get("totalWorkouts") or 0) + int(new_stats.get("totalWorkouts") or 0)
    existing.setdefault("muscleGroupVolume", {})
    existing.setdefault("exerciseRecords", {})

    for muscle, data in (new_stats.get("muscleGroupVolume") or {}).items():
        if muscle not in existing["muscleGroupVolume"]:
            existing["muscleGroupVolume"][muscle] = data
        else:
            current = existing["muscleGroupVolume"][muscle]
            current["totalSets"] = current.get("totalSets", 0) + data.get("totalSets", 0)
            current["totalVolumeLoad"] = current.get("totalVolumeLoad", 0) + data.get("totalVolumeLoad", 0)
            current.setdefault("workouts", []).extend(data.get("workouts") or [])

    for exercise, data in (new_stats.get("exerciseRecords") or {}).items():
        if exercise not in existing["exerciseRecords"]:
            existing["exerciseRecords"][exercise] = data
        else:
            current = existing["exerciseRecords"][exercise]
            current["totalSets"] = current.get("totalSets", 0) + data.get("totalSets", 0)
            if data.get("bestWeight", 0) > current.get("bestWeight", 0):
                current["bestWeight"] = data.get("bestWeight", 0)
                current["bestReps"] = data.get("bestReps", 0)
    return existing
