from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.schemas import DomainResult
from app.agent.state import AgentState


async def planner_agent_node(state: AgentState) -> AgentState:
    model = get_chat_model()
    if model is not None:
        try:
            result = await model.with_structured_output(DomainResult).ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Create or update a workout plan. Respond in Chinese. "
                            "Use data keys plan_metadata and weekly_templates, with sessions and exercises."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Intent: {state.get('detected_intent')}\n"
                            f"Memory:\n{state.get('memory_prompt', '')}\n"
                            f"Message: {state.get('user_message', '')}"
                        )
                    ),
                ]
            )
            if not result.data.get("weekly_templates"):
                raise ValueError("structured plan data missing weekly_templates")
            return {
                **state,
                "structured_data": result.data,
                "ai_response": result.response,
                "profile_update": result.profile_update,
                "entry_date": result.entry_date or state.get("entry_date"),
            }
        except Exception:
            pass

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
