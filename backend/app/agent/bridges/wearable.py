from typing import Any


class WearableBridge:
    name = "wearable"

    def normalize(self, source: str, payload: dict[str, Any]) -> dict[str, Any]:
        if source == "apple_health":
            captured_at = payload.get("startDate")
            avg = payload.get("averageHeartRate")
            peak = payload.get("maxHeartRate")
            hrv = payload.get("hrvSDNN")
            sleep = payload.get("sleepAnalysisScore")
        elif source == "garmin":
            captured_at = payload.get("timestamp")
            avg = payload.get("avgHr")
            peak = payload.get("maxHr")
            hrv = payload.get("lastNightHrv")
            sleep = payload.get("sleepScore")
        elif source == "xiaomi":
            captured_at = payload.get("time")
            avg = payload.get("heart_rate_avg")
            peak = payload.get("heart_rate_max")
            hrv = payload.get("hrv")
            sleep = payload.get("sleep_score")
        else:
            captured_at = payload.get("capturedAt")
            avg = payload.get("heartRateAvg")
            peak = payload.get("heartRatePeak")
            hrv = payload.get("hrvMs")
            sleep = payload.get("sleepScore")

        return {
            "source": source,
            "capturedAt": captured_at,
            "heartRateAvg": avg,
            "heartRatePeak": peak,
            "hrvMs": hrv,
            "sleepScore": sleep,
            "steps": payload.get("steps"),
        }
