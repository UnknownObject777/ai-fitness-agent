from typing import Any, Protocol


NormalizedPayload = dict[str, Any]


class Bridge(Protocol):
    name: str

    async def handle(self, payload: dict[str, Any]) -> NormalizedPayload:
        ...
