"""GET /events - Server-Sent Events stream mirroring `WaitlistStore` mutations.

No authentication (the guest status page, which has no login, needs to
subscribe too). Events carry no payload the client depends on - they are
"something changed, please refetch" signals, matching the frontend's
`WaitlistService.subscribe()` contract.

Implemented with a plain `StreamingResponse` (no extra SSE dependency) since
the format is simple: `event: <name>\ndata: <payload>\n\n` per message.
Subscribes to the app-wide `EventBroker` (see `events.py`) rather than to any
particular database session, since a store instance only lives for one
request.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from starlette.responses import StreamingResponse

from ..dependencies import get_event_broker
from ..events import EventBroker

router = APIRouter(tags=["Realtime"])

_KEEPALIVE_SECONDS = 15


def _sse_message(event: str, data: str = "") -> str:
    return f"event: {event}\ndata: {data}\n\n"


async def _event_stream(request: Request, broker: EventBroker) -> AsyncGenerator[str, None]:
    queue: asyncio.Queue[str] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_change() -> None:
        loop.call_soon_threadsafe(queue.put_nowait, "update")

    unsubscribe = broker.subscribe(on_change)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                message = await asyncio.wait_for(queue.get(), timeout=_KEEPALIVE_SECONDS)
                yield _sse_message("update", message)
            except asyncio.TimeoutError:
                yield _sse_message("ping")
    finally:
        unsubscribe()


@router.get("/events", summary="Live update stream (Server-Sent Events)")
async def subscribe_to_events(
    request: Request, broker: EventBroker = Depends(get_event_broker)
) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(request, broker),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
