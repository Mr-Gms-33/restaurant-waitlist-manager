"""Staff authentication: hashed passwords + opaque bearer tokens.

Kept dependency-free (no `passlib`/`jose`) so the backend has a minimal
footprint: passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib `hashlib`,
a NIST-recommended KDF) and sessions are random, expiring, in-memory
bearer tokens - conceptually the same as a real backend's JWT/session
cookie, just simple enough to read end-to-end.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

TOKEN_TTL = timedelta(hours=12)
_PBKDF2_ITERATIONS = 200_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Returns `salt_hex$hash_hex`, suitable for storing/comparing later."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, digest_hex = hashed.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


@dataclass
class StaffUser:
    id: str
    username: str
    name: str
    hashed_password: str


@dataclass
class AuthManager:
    """Holds staff accounts and issued bearer tokens, all in memory."""

    users_by_username: dict[str, StaffUser] = field(default_factory=dict)
    # token -> (staff_id, expires_at)
    _tokens: dict[str, tuple[str, datetime]] = field(default_factory=dict)

    def seed_default_staff(self) -> None:
        """Creates the pilot's single staff account: username `staff`, password `waitlist123`."""
        self.register(username="staff", name="Pilot Staff", password="waitlist123")

    def register(self, username: str, name: str, password: str) -> StaffUser:
        user = StaffUser(
            id=f"staff_{secrets.token_hex(4)}",
            username=username,
            name=name,
            hashed_password=hash_password(password),
        )
        self.users_by_username[username] = user
        return user

    def authenticate(self, username: str, password: str) -> Optional[StaffUser]:
        user = self.users_by_username.get(username)
        if user is None:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def issue_token(self, user: StaffUser) -> tuple[str, datetime]:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + TOKEN_TTL
        self._tokens[token] = (user.id, expires_at)
        return token, expires_at

    def get_user_for_token(self, token: str) -> Optional[StaffUser]:
        entry = self._tokens.get(token)
        if entry is None:
            return None
        staff_id, expires_at = entry
        if datetime.now(timezone.utc) >= expires_at:
            del self._tokens[token]
            return None
        return next((u for u in self.users_by_username.values() if u.id == staff_id), None)

    def revoke_token(self, token: str) -> None:
        self._tokens.pop(token, None)


def create_auth_manager(seed: bool = True) -> AuthManager:
    manager = AuthManager()
    if seed:
        manager.seed_default_staff()
    return manager
