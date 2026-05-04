from typing import Any


class StateBridge:
    name = "state"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "state", "payload": payload}
