from typing import Any


class BiometricBridge:
    name = "biometric"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"type": "biometric", "payload": payload}
