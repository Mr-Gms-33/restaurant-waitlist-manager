from __future__ import annotations

import os
import shutil
import socket
import subprocess
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx
import pytest


def _free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@dataclass
class ComposeStack:
    base_url: str
    compose_file: Path
    project_name: str
    env: dict[str, str]

    def run_compose(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            ["docker", "compose", "-f", str(self.compose_file), "-p", self.project_name, *args],
            capture_output=True,
            text=True,
            env=self.env,
        )
        if check and result.returncode != 0:
            message = (
                f"docker compose {' '.join(args)} failed with exit code {result.returncode}\n"
                f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
            )
            raise AssertionError(message)
        return result


def _wait_for_health(base_url: str, timeout_seconds: int = 180) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: str | None = None
    while time.monotonic() < deadline:
        try:
            response = httpx.get(f"{base_url}/health", timeout=5.0)
            if response.status_code == 200 and response.json().get("status") == "ok":
                return
            last_error = f"Unexpected status {response.status_code}: {response.text}"
        except Exception as exc:  # pragma: no cover - diagnostic path
            last_error = str(exc)
        time.sleep(2)
    raise AssertionError(f"App never became healthy at {base_url}/health. Last error: {last_error}")


@pytest.fixture(scope="session")
def docker_compose_stack() -> ComposeStack:
    if os.environ.get("RUN_DOCKER_COMPOSE_TESTS") != "1":
        pytest.skip("Set RUN_DOCKER_COMPOSE_TESTS=1 to run docker-compose integration tests.")

    if shutil.which("docker") is None:
        pytest.skip("Docker CLI is not installed or not on PATH.")

    repo_root = Path(__file__).resolve().parents[2]
    compose_yaml = repo_root / "docker-compose.yaml"
    compose_yml = repo_root / "docker-compose.yml"
    if compose_yaml.exists():
        compose_file = compose_yaml
    elif compose_yml.exists():
        compose_file = compose_yml
    else:
        pytest.skip("No docker-compose.yaml/.yml file found at repository root.")

    app_port = _free_tcp_port()
    project_name = f"sdip_it_{uuid.uuid4().hex[:8]}"
    env = os.environ.copy()
    env["APP_PORT"] = str(app_port)

    stack = ComposeStack(
        base_url=f"http://127.0.0.1:{app_port}",
        compose_file=compose_file,
        project_name=project_name,
        env=env,
    )

    stack.run_compose("up", "--build", "-d")
    _wait_for_health(stack.base_url)
    yield stack
    stack.run_compose("down", "-v", "--remove-orphans", check=False)


def _staff_headers(base_url: str) -> dict[str, str]:
    response = httpx.post(
        f"{base_url}/api/v1/auth/login",
        json={"username": "staff", "password": "waitlist123"},
        timeout=10.0,
    )
    assert response.status_code == 200, response.text
    token = response.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.docker_integration
def test_stack_serves_frontend_and_api(docker_compose_stack: ComposeStack) -> None:
    root = httpx.get(f"{docker_compose_stack.base_url}/", timeout=10.0)
    assert root.status_code == 200
    assert "<!doctype html>" in root.text.lower()

    health = httpx.get(f"{docker_compose_stack.base_url}/health", timeout=10.0)
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    unauthorized = httpx.get(f"{docker_compose_stack.base_url}/api/v1/tables", timeout=10.0)
    assert unauthorized.status_code == 401


@pytest.mark.docker_integration
def test_guest_to_staff_flow(docker_compose_stack: ComposeStack) -> None:
    base_url = docker_compose_stack.base_url
    headers = _staff_headers(base_url)

    join = httpx.post(
        f"{base_url}/api/v1/parties",
        json={"name": "Compose Guest", "partySize": 2, "contact": "555-7777"},
        timeout=10.0,
    )
    assert join.status_code == 201, join.text
    party = join.json()
    assert party["status"] == "waiting"

    wait_time = httpx.patch(
        f"{base_url}/api/v1/parties/{party['id']}/wait-time",
        json={"minutes": 12},
        headers=headers,
        timeout=10.0,
    )
    assert wait_time.status_code == 200, wait_time.text
    assert wait_time.json()["estimatedWaitMinutes"] == 12

    tables = httpx.get(f"{base_url}/api/v1/tables", headers=headers, timeout=10.0)
    assert tables.status_code == 200, tables.text
    available = next((t for t in tables.json() if t["status"] == "available"), None)
    assert available is not None, "Expected at least one available seeded table"

    assign = httpx.post(
        f"{base_url}/api/v1/parties/{party['id']}/assign-table",
        json={"tableId": available["id"]},
        headers=headers,
        timeout=10.0,
    )
    assert assign.status_code == 200, assign.text
    body = assign.json()
    assert body["party"]["status"] == "table_ready"
    assert body["table"]["status"] == "occupied"


@pytest.mark.docker_integration
def test_data_persists_across_app_restart(docker_compose_stack: ComposeStack) -> None:
    base_url = docker_compose_stack.base_url

    create = httpx.post(
        f"{base_url}/api/v1/parties",
        json={"name": f"Persist-{uuid.uuid4().hex[:6]}", "partySize": 3, "contact": "555-8888"},
        timeout=10.0,
    )
    assert create.status_code == 201, create.text
    party_id = create.json()["id"]

    docker_compose_stack.run_compose("restart", "app")
    _wait_for_health(base_url)

    lookup = httpx.get(f"{base_url}/api/v1/parties/{party_id}", timeout=10.0)
    assert lookup.status_code == 200, lookup.text
    assert lookup.json()["id"] == party_id
