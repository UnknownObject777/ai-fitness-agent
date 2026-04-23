"""
Pytest configuration and fixtures for backend tests.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock
from typing import Generator
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db():
    """Mock database connection."""
    mock = Mock()
    mock.execute = Mock()
    mock.fetchone = Mock(return_value=None)
    mock.fetchall = Mock(return_value=[])
    mock.commit = Mock()
    return mock


@pytest.fixture
def sample_user():
    """Sample user data for tests."""
    return {
        "id": "user_123",
        "name": "Test User",
        "age": 30,
        "weight_kg": 70.0,
        "height_cm": 175.0,
        "gender": "male",
        "fitness_goal": "muscle_gain",
        "experience_level": "intermediate"
    }


@pytest.fixture
def sample_workout_log():
    """Sample workout log data for tests."""
    return {
        "id": "workout_123",
        "user_id": "user_123",
        "date": "2026-01-15",
        "exercise_name": "Bench Press",
        "muscle_group": "chest",
        "sets": 4,
        "reps": 10,
        "weight_kg": 80.0,
        "rpe": 8,
        "notes": "Felt strong today",
        "created_at": "2026-01-15T08:30:00Z"
    }


@pytest.fixture
def sample_meal_log():
    """Sample meal log data for tests."""
    return {
        "id": "meal_123",
        "user_id": "user_123",
        "date": "2026-01-15",
        "meal_type": "lunch",
        "food_name": "Grilled Chicken Salad",
        "calories": 450,
        "protein_g": 35.0,
        "carbs_g": 25.0,
        "fat_g": 20.0,
        "quantity": 1.0,
        "unit": "serving",
        "notes": "With olive oil dressing",
        "created_at": "2026-01-15T12:30:00Z"
    }


@pytest.fixture
def sample_body_metrics():
    """Sample body metrics data for tests."""
    return {
        "id": "metric_123",
        "user_id": "user_123",
        "date": "2026-01-15",
        "weight_kg": 70.0,
        "body_fat_pct": 15.5,
        "muscle_mass_kg": 58.0,
        "bmi": 22.9,
        "waist_cm": 80.0,
        "chest_cm": 100.0,
        "arms_cm": 35.0,
        "thighs_cm": 55.0,
        "notes": "Monthly check-in",
        "created_at": "2026-01-15T09:00:00Z"
    }


@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response for tests."""
    return {
        "intent": "log_strength_workout",
        "data": {
            "exercise_name": "Squat",
            "muscle_group": "legs",
            "sets": 3,
            "reps": 8,
            "weight_kg": 100.0
        },
        "message": "已记录你的深蹲训练！"
    }


@pytest.fixture
def sample_chat_message():
    """Sample chat message data for tests."""
    return {
        "id": "msg_123",
        "session_id": "session_123",
        "role": "user",
        "content": "我今天做了深蹲3组，每组8次，100公斤",
        "created_at": "2026-01-15T10:00:00Z"
    }


@pytest.fixture
def sample_session():
    """Sample chat session data for tests."""
    return {
        "id": "session_123",
        "user_id": "user_123",
        "title": "健身咨询",
        "created_at": "2026-01-15T10:00:00Z",
        "updated_at": "2026-01-15T10:30:00Z"
    }
