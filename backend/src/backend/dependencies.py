"""FastAPI dependency-injection wiring.

State (the store, the auth manager) lives on `app.state`, set up once in
`backend.main.create_app`. This keeps every test able to spin up a fresh,
isolated app/store/auth-manager triple instead of sharing global state.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import AuthManager, StaffUser
from .store import WaitlistStore

bearer_scheme = HTTPBearer(auto_error=False)


def get_store(request: Request) -> WaitlistStore:
    return request.app.state.store


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
