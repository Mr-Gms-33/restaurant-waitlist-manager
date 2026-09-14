"""FastAPI dependency-injection wiring.

Long-lived state (the SQLAlchemy session factory, the auth manager, the
event broker) lives on `app.state`, set up once in `backend.main.create_app`.
`WaitlistStore` itself is *not* long-lived - a fresh instance wrapping a
fresh `Session` is created per request and the session is closed once the
request finishes, via `get_db_session`.
"""

from __future__ import annotations

from typing import Iterator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .auth import AuthManager, StaffUser
from .events import EventBroker
from .store import WaitlistStore

bearer_scheme = HTTPBearer(auto_error=False)


def get_db_session(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def get_event_broker(request: Request) -> EventBroker:
    return request.app.state.event_broker


def get_store(
    session: Session = Depends(get_db_session),
    broker: EventBroker = Depends(get_event_broker),
) -> WaitlistStore:
    return WaitlistStore(session, broker)


def get_auth_manager(request: Request) -> AuthManager:
    return request.app.state.auth_manager


def get_current_staff(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_manager: AuthManager = Depends(get_auth_manager),
) -> StaffUser:
    """Requires a valid, unexpired staff bearer token. Raises 401 otherwise."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = auth_manager.get_user_for_token(credentials.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
