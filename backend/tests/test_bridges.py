from app.agent.bridges.router import route_modality
from app.agent.bridges.wearable import WearableBridge


def test_wearable_bridge_normalizes_vendor_payloads_to_domain_schema():
    bridge = WearableBridge()

    apple = bridge.normalize(
        "apple_health",
        {
            "averageHeartRate": 74,
            "maxHeartRate": 158,
            "hrvSDNN": 48,
            "sleepAnalysisScore": 82,
            "startDate": "2026-05-04T07:00:00+08:00",
        },
    )
    garmin = bridge.normalize(
        "garmin",
        {
            "avgHr": 76,
            "maxHr": 162,
            "lastNightHrv": 45,
            "sleepScore": 78,
            "timestamp": "2026-05-04T07:05:00+08:00",
        },
    )

    assert apple["source"] == "apple_health"
    assert apple["heartRateAvg"] == 74
    assert garmin["hrvMs"] == 45
    assert set(apple.keys()) == set(garmin.keys())


def test_modality_router_selects_visual_paths():
    assert route_modality(has_image=True, has_video=False, user_message="午餐照片") == "nutrition_image"
    assert route_modality(has_image=False, has_video=True, user_message="帮我看深蹲姿态") == "video_analysis"
    assert route_modality(has_image=False, has_video=False, user_message="今天练胸") == "text"
