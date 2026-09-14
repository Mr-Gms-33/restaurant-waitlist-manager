"""FastAPI application factory.

Implements the backend contract described in `openapi.yaml` at the repo
root, for the `waitlist-app` frontend. Run it with:

    uv run uvicorn backend.main:app --reload

State (the in-memory store, the auth manager) is created fresh by
`create_app()` and attached to `app.state`, rather than living in module
globals - this lets tests spin up isolated app instances instead of sharing
data between them.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import create_auth_manager
from .errors import WaitlistError
from .routers import auth as auth_router
from .routers import events as events_router
from .routers import guest_parties, staff_parties, staff_tables
from .store import create_store


def create_app(*, seed_data: bool = True) -> FastAPI:
    app = FastAPI(
        title="Restaurant Waitlist Manager API",
        version="1.0.0",
        description=(
            "Backend implementation of the contract described in openapi.yaml, "
            "backing the waitlist-app frontend."
        ),
    )

    app.state.store = create_store(seed=seed_data)
    # The staff account always exists - it's a login credential, not demo data.
    app.state.auth_manager = create_auth_manager(seed=True)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(WaitlistError)
    def handle_waitlist_error(_: Request, exc: WaitlistError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.message})

    api = "/api/v1"
    app.include_router(auth_router.router, prefix=api)
    app.include_router(guest_parties.router, prefix=api)
    app.include_router(staff_parties.router, prefix=api)
    app.include_router(staff_tables.router, prefix=api)
    app.include_router(events_router.router, prefix=api)

    @app.get("/health", tags=["Health"], summary="Liveness check")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
