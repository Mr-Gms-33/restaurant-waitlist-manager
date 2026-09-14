from __future__ import annotations

from fastapi.testclient import TestClient

from backend.auth import hash_password, verify_password
from .conftest import DEFAULT_STAFF_PASSWORD, DEFAULT_STAFF_USERNAME


def test_hash_password_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


def test_hash_password_uses_a_random_salt():
    a = hash_password("same-password")
    b = hash_password("same-password")
    assert a != b, "two hashes of the same password should differ (random salt)"


def test_login_succeeds_with_correct_credentials(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": DEFAULT_STAFF_USERNAME, "password": DEFAULT_STAFF_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["staffName"]


def test_login_fails_with_wrong_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": DEFAULT_STAFF_USERNAME, "password": "not-the-password"},
    )
    assert response.status_code == 401


def test_login_fails_with_unknown_username(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "ghost", "password": "whatever"},
    )
    assert response.status_code == 401


def test_staff_endpoint_rejects_missing_token(client: TestClient):
    response = client.get("/api/v1/parties")
    assert response.status_code == 401


def test_staff_endpoint_rejects_bad_token(client: TestClient):
    response = client.get("/api/v1/parties", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_staff_endpoint_accepts_valid_token(client: TestClient, staff_headers: dict[str, str]):
    response = client.get("/api/v1/parties", headers=staff_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_guest_endpoints_do_not_require_a_token(client: TestClient):
    response = client.post(
        "/api/v1/parties",
        json={"name": "Anon", "partySize": 2, "contact": "555-0000"},
    )
    assert response.status_code == 201
