"""Tests for the SSE event stream.

Exercised directly against `_event_stream` and an `EventBroker` (rather than
through two concurrent HTTP requests) because `TestClient`'s synchronous
portal can't run a long-lived streaming request and a second mutating
request at the same time without deadlocking.
"""

from __future__ import annotations

import asyncio

import pytest

from backend.events import EventBroker
from backend.routers.events import _event_stream


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeRequest:
    """Minimal stand-in for `starlette.Request`, just enough for `_event_stream`."""

    async def is_disconnected(self) -> bool:
        return False


@pytest.mark.anyio
async def test_event_stream_emits_update_after_a_notify():
    broker = EventBroker()
    request = _FakeRequest()
    stream = _event_stream(request, broker)  # type: ignore[arg-type]

    async def notify_soon():
        await asyncio.sleep(0.05)
        broker.notify()

    asyncio.create_task(notify_soon())

    message = await asyncio.wait_for(stream.__anext__(), timeout=2)
    assert "event: update" in message

    await stream.aclose()


@pytest.mark.anyio
async def test_event_stream_sends_a_keepalive_ping_when_idle(monkeypatch):
    import backend.routers.events as events_module

    monkeypatch.setattr(events_module, "_KEEPALIVE_SECONDS", 0.05)

    broker = EventBroker()
    request = _FakeRequest()
    stream = _event_stream(request, broker)  # type: ignore[arg-type]

    message = await asyncio.wait_for(stream.__anext__(), timeout=2)
    assert "event: ping" in message

    await stream.aclose()
