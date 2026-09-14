"""Restaurant Waitlist Manager backend.

Implements the API described in `openapi.yaml` at the repo root. See
`backend.main.create_app` for the FastAPI application factory.
"""

from .main import create_app

__all__ = ["create_app"]
