from __future__ import annotations

from fastapi.testclient import TestClient


def join(client: TestClient, name="Party", party_size=2, contact="555-1"):
    return client.post(
        "/api/v1/parties", json={"name": name, "partySize": party_size, "contact": contact}
    ).json()


def test_list_tables_requires_auth(client: TestClient):
    assert client.get("/api/v1/tables").status_code == 401


def test_add_table(client: TestClient, staff_headers):
    response = client.post(
        "/api/v1/tables", json={"name": "T9", "capacity": 6}, headers=staff_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "T9"
    assert body["capacity"] == 6
    assert body["status"] == "available"
    assert body["partyId"] is None


def test_add_table_rejects_non_positive_capacity(client: TestClient, staff_headers):
    response = client.post(
        "/api/v1/tables", json={"name": "T9", "capacity": 0}, headers=staff_headers
    )
    assert response.status_code == 400


def test_remove_table(client: TestClient, staff_headers):
    table = client.post(
        "/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers
    ).json()

    response = client.delete(f"/api/v1/tables/{table['id']}", headers=staff_headers)
    assert response.status_code == 204

    tables = client.get("/api/v1/tables", headers=staff_headers).json()
    assert table["id"] not in [t["id"] for t in tables]


def test_remove_table_conflicts_when_assigned(client: TestClient, staff_headers):
    party = join(client)
    table = client.post(
        "/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers
    ).json()
    client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )

    response = client.delete(f"/api/v1/tables/{table['id']}", headers=staff_headers)
    assert response.status_code == 409


def test_update_table_status(client: TestClient, staff_headers):
    table = client.post(
        "/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers
    ).json()

    response = client.patch(
        f"/api/v1/tables/{table['id']}/status", json={"status": "unavailable"}, headers=staff_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"


def test_update_table_status_conflicts_when_assigned(client: TestClient, staff_headers):
    party = join(client)
    table = client.post(
        "/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers
    ).json()
    client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )

    response = client.patch(
        f"/api/v1/tables/{table['id']}/status", json={"status": "unavailable"}, headers=staff_headers
    )
    assert response.status_code == 409


def test_release_table_unassigns_party(client: TestClient, staff_headers):
    party = join(client)
    table = client.post(
        "/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers
    ).json()
    client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )

    response = client.post(f"/api/v1/tables/{table['id']}/release", headers=staff_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "available"
    assert response.json()["partyId"] is None

    updated_party = client.get(f"/api/v1/parties/{party['id']}").json()
    assert updated_party["tableId"] is None


def test_table_not_found_returns_404(client: TestClient, staff_headers):
    response = client.post("/api/v1/tables/does-not-exist/release", headers=staff_headers)
    assert response.status_code == 404
