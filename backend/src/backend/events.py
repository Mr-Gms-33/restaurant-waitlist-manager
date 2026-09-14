"""In-memory pub/sub for "something changed, please refetch" notifications.

Deliberately separate from the database: `WaitlistStore` calls `notify()`
after every successful mutation, and `GET /events` (SSE) subscribes to relay
that to connected clients. A multi-instance deployment would swap this for
something like Redis pub/sub behind the same `subscribe()`/`notify()` shape;
nothing else in the app would need to change.
"""

from __future__ import annotations

from typing import Callable

Listener = Callable[[], None]


class EventBroker:
    def __init__(self) -> None:
        self._listeners: list[Listener] = []

    def subscribe(self, listener: Listener) -> Callable[[], None]:
        self._listeners.append(listener)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def notify(self) -> None:
        for listener in list(self._listeners):
            listener()
