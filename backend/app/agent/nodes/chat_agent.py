from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_model
from app.agent.state import AgentState


async def chat_agent_node(state: AgentState) -> AgentState:
    model = get_chat_model()
    if model is not None:
        try:
            response = await model.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "You are Sparky, a warm Chinese fitness and nutrition assistant. "
                            "Use the supplied memory context when helpful."
                        )
                    ),
                    HumanMessage(
                        content=f"Memory:\n{state.get('memory_prompt', '')}\nMessage: {state.get('user_message', '')}"
                    ),
                ]
            )
            return {**state, "structured_data": {}, "ai_response": str(response.content)}
        except Exception:
            pass

    return {
        **state,
        "structured_data": {},
        "ai_response": "我在。你可以告诉我今天的训练、饮食、体测，或者让我帮你调整接下来的计划。",
    }
