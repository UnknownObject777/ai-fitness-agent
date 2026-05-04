from typing import Any


class VideoAnalysisBridge:
    name = "video_analysis"

    async def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "type": "video_analysis",
            "formScore": 0.0,
            "findings": [],
            "payload": payload,
        }
