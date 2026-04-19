from app.agent.state import AgentState


async def planner_agent_node(state: AgentState) -> AgentState:
    data = {
        "plan_metadata": {
            "goal_orientation": "general_fitness",
            "total_weeks": 4,
            "start_phase": "base_building",
            "rationale": "Based on the current request and recent training context.",
        },
        "weekly_templates": [
            {
                "week_number": 1,
                "sessions": [
                    {
                        "session_id": "A",
                        "focus": "Lower body strength + core",
                        "exercises": [
                            {"name": "Squat", "sets": 3, "reps": 8, "rpe": 7, "notes": "Leave 2 reps in reserve"}
                        ],
                    },
                    {
                        "session_id": "B",
                        "focus": "Upper body push/pull",
                        "exercises": [
                            {"name": "Bench press", "sets": 3, "reps": 8, "rpe": 7, "notes": "Controlled tempo"}
                        ],
                    },
                ],
            }
        ],
    }
    return {
        **state,
        "structured_data": data,
        "ai_response": "先给你一个稳妥的 4 周训练框架，后续可以按恢复和器械条件继续细化。",
    }

