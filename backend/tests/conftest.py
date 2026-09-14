from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app

DEFAULT_STAFF_USERNAME = "staff"
DEFAULT_STAFF_PASSWORD = "waitlist123"


@pytest.fixture
def app():
    """A fresh app with an empty store (no demo parties/tables), for deterministic tests.

    Each test gets its own isolated in-memory SQLite database (never touches
    the real `waitlist.db` file).
    """
    return create_app(seed_data=False, database_url="sqlite:///:memory:")


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture
def seeded_app():
    """A fresh app pre-populated with demo data, like the one the frontend talks to."""
    return create_app(seed_data=True, database_url="sqlite:///:memory:")


@pytest.fixture
def seeded_client(seeded_app) -> TestClient:
    return TestClient(seeded_app)


@pytest.fixture
def staff_token(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": DEFAULT_STAFF_USERNAME, "password": DEFAULT_STAFF_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


@pytest.fixture
def staff_headers(staff_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {staff_token}"}
