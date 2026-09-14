from __future__ import annotations

from fastapi.testclient import TestClient


def join(client: TestClient, name="Jane Doe", party_size=2, contact="555-0199"):
    response = client.post(
        "/api/v1/parties",
        json={"name": name, "partySize": party_size, "contact": contact},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_join_waitlist_creates_a_waiting_party(client: TestClient):
    party = join(client)
    assert party["status"] == "waiting"
    assert party["name"] == "Jane Doe"
    assert party["partySize"] == 2
    assert party["estimatedWaitMinutes"] is None
    assert party["tableId"] is None
    assert party["id"]


def test_join_waitlist_rejects_missing_name(client: TestClient):
    response = client.post("/api/v1/parties", json={"name": "", "partySize": 2, "contact": "555"})
    assert response.status_code == 400
    assert "error" in response.json()


def test_join_waitlist_rejects_non_positive_party_size(client: TestClient):
    response = client.post("/api/v1/parties", json={"name": "Bo", "partySize": 0, "contact": "555"})
    assert response.status_code == 400
    assert "positive" in response.json()["error"]


def test_get_party_returns_404_for_unknown_id(client: TestClient):
    response = client.get("/api/v1/parties/does-not-exist")
    assert response.status_code == 404


def test_get_party_returns_the_party(client: TestClient):
    party = join(client)
    response = client.get(f"/api/v1/parties/{party['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == party["id"]


def test_queue_position_increments_for_each_new_party(client: TestClient):
    a = join(client, name="A")
    b = join(client, name="B")
    c = join(client, name="C")

    assert client.get(f"/api/v1/parties/{a['id']}/queue-position").json()["position"] == 1
    assert client.get(f"/api/v1/parties/{b['id']}/queue-position").json()["position"] == 2
    assert client.get(f"/api/v1/parties/{c['id']}/queue-position").json()["position"] == 3


def test_confirm_arrival_transitions_waiting_to_arrival_confirmed(client: TestClient):
    party = join(client)
    response = client.post(f"/api/v1/parties/{party['id']}/confirm-arrival")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "arrival_confirmed"
    assert body["arrivalConfirmedAt"] is not None


def test_confirm_arrival_conflicts_once_seated(client: TestClient, staff_headers: dict[str, str]):
    party = join(client)
    client.patch(
        f"/api/v1/parties/{party['id']}/status", json={"status": "seated"}, headers=staff_headers
    )
    response = client.post(f"/api/v1/parties/{party['id']}/confirm-arrival")
    assert response.status_code == 409


def test_leave_waitlist_removes_the_party(client: TestClient):
    party = join(client)
    response = client.delete(f"/api/v1/parties/{party['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/v1/parties/{party['id']}").status_code == 404


def test_leave_waitlist_frees_an_assigned_table(client: TestClient, staff_headers: dict[str, str]):
    party = join(client, party_size=2)
    table = client.post("/api/v1/tables", json={"name": "T1", "capacity": 2}, headers=staff_headers).json()
    client.post(
        f"/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": table["id"]},
        headers=staff_headers,
    )

    client.delete(f"/api/v1/parties/{party['id']}")

    tables = client.get("/api/v1/tables", headers=staff_headers).json()
    assert tables[0]["status"] == "available"
    assert tables[0]["partyId"] is None
