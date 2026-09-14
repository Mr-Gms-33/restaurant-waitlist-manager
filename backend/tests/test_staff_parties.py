from __future__ import annotations

from fastapi.testclient import TestClient


def join(client: TestClient, name="Nora Kim", party_size=2, contact="555-1"):
    return client.post(
        "/api/v1/parties", json={"name": name, "partySize": party_size, "contact": contact}
    ).json()


def add_table(client: TestClient, headers, name="T1", capacity=2):
    return client.post("/api/v1/tables", json={"name": name, "capacity": capacity}, headers=headers).json()


def test_list_parties_requires_auth(client: TestClient):
    assert client.get("/api/v1/parties").status_code == 401


def test_list_parties_returns_seeded_demo_data(seeded_client: TestClient):
    # `seeded_client`'s app has its own auth manager, seeded with the same default account.
    login = seeded_client.post(
        "/api/v1/auth/login", json={"username": "staff", "password": "waitlist123"}
    ).json()
    headers = {"Authorization": f"Bearer {login['accessToken']}"}

    response = seeded_client.get("/api/v1/parties", headers=headers)
    assert response.status_code == 200
    names = [p["name"] for p in response.json()]
    assert "Alicia Moreno" in names
    assert "Devon Blake" in names


def test_update_wait_time_sets_minutes_and_deadline(client: TestClient, staff_headers):
    party = join(client)
    response = client.patch(
        f"/api/v1/parties/{party['id']}/wait-time", json={"minutes": 20}, headers=staff_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["estimatedWaitMinutes"] == 20
    assert body["arrivalDeadline"] is not None


def test_update_wait_time_rejects_negative_minutes(client: TestClient, staff_headers):
    party = join(client)
    response = client.patch(
        f"/api/v1/parties/{party['id']}/wait-time", json={"minutes": -5}, headers=staff_headers
    )
    assert response.status_code == 400


def test_update_party_status(client: TestClient, staff_headers):
    party = join(client)
    response = client.patch(
        f"/api/v1/parties/{party['id']}/status", json={"status": "cancelled"}, headers=staff_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_reorder_parties(client: TestClient, staff_headers):
    a = join(client, name="A")
    b = join(client, name="B")
    c = join(client, name="C")

    response = client.put(
        "/api/v1/parties/order",
        json={"orderedIds": [c["id"], a["id"], b["id"]]},
        headers=staff_headers,
    )
    assert response.status_code == 200
    assert [p["id"] for p in response.json()] == [c["id"], a["id"], b["id"]]


def test_reorder_parties_rejects_mismatched_ids(client: TestClient, staff_headers):
    join(client, name="A")
    response = client.put(
        "/api/v1/parties/order", json={"orderedIds": ["bogus"]}, headers=staff_headers
    )
    assert response.status_code == 400


def test_assign_table_marks_party_table_ready_and_table_occupied(client: TestClient, staff_headers):
    party = join(client, party_size=2)
    table = add_table(client, staff_headers, name="T1", capacity=2)

    response = client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["party"]["status"] == "table_ready"
    assert body["party"]["tableId"] == table["id"]
    assert body["table"]["status"] == "occupied"
    assert body["table"]["partyId"] == party["id"]


def test_assign_table_conflicts_when_table_not_available(client: TestClient, staff_headers):
    party1 = join(client, name="P1")
    party2 = join(client, name="P2")
    table = add_table(client, staff_headers)

    client.post(
        f"/api/v1/parties/{party1['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )
    response = client.post(
        f"/api/v1/parties/{party2['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )
    assert response.status_code == 409


def test_cancelling_a_party_frees_its_table(client: TestClient, staff_headers):
    party = join(client, party_size=2)
    table = add_table(client, staff_headers)
    client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )

    client.patch(
        f"/api/v1/parties/{party['id']}/status", json={"status": "no_show"}, headers=staff_headers
    )

    tables = client.get("/api/v1/tables", headers=staff_headers).json()
    assert tables[0]["status"] == "available"
    assert tables[0]["partyId"] is None
