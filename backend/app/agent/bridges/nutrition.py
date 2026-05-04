from typing import Any


class NutritionBridge:
    name = "nutrition"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "nutrition", "payload": payload}
