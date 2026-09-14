"""Domain-level errors raised by the in-memory store.

Routers translate these into HTTP responses (see `backend.main.register_exception_handlers`)
using each error's `status_code`, so business rules live in one place (the
store) instead of being duplicated across every router.
"""

from __future__ import annotations


class WaitlistError(Exception):
    """Base class for all domain errors. Carries the HTTP status code to use."""

    status_code: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(WaitlistError):
    """Raised when a party/table id doesn't exist."""

    status_code = 404


class ValidationError(WaitlistError):
    """Raised when input fails a business rule (e.g. negative wait time)."""

    status_code = 400


class ConflictError(WaitlistError):
    """Raised when an operation conflicts with current state (e.g. table taken)."""

    status_code = 409
