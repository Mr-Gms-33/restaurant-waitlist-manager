"""POST /auth/login - the one endpoint not in the original OpenAPI guest/staff
split, added because staff need a way to obtain the bearer token every other
Staff endpoint requires. See `openapi.yaml`'s `Auth` tag.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthManager
from ..dependencies import get_auth_manager
from ..models import LoginRequest, TokenResponse

router = APIRouter(tags=["Auth"])


@router.post("/auth/login", response_model=TokenResponse, summary="Staff login")
def login(
    body: LoginRequest,
    auth_manager: AuthManager = Depends(get_auth_manager),
) -> TokenResponse:
    user = auth_manager.authenticate(body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token, expires_at = auth_manager.issue_token(user)
    return TokenResponse(access_token=token, token_type="bearer", expires_at=expires_at, staff_name=user.name)
