from app.agent.state import AgentState


async def chat_agent_node(state: AgentState) -> AgentState:
    return {
        **state,
        "structured_data": {},
        "ai_response": "我在。你可以告诉我今天的训练、饮食、体测，或者让我帮你调整接下来的计划。",
    }

