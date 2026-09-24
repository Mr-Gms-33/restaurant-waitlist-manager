"""FastAPI application factory.

Implements the backend contract described in `openapi.yaml` at the repo
root, for the `frontend` app. Run it with:

    uv run uvicorn backend.main:create_app --factory --reload

(`--factory` so importing this module doesn't eagerly open a database
connection - useful for tests, which build their own isolated `create_app()`
instances.)

Long-lived state (the SQLAlchemy session factory, the auth manager, the
event broker) is created fresh by `create_app()` and attached to
`app.state`, rather than living in module globals - this lets tests spin up
isolated app instances instead of sharing data between them.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .auth import create_auth_manager
from .db import create_db_engine, create_session_factory, init_schema, resolve_database_url
from .errors import WaitlistError
from .events import EventBroker
from .routers import auth as auth_router
from .routers import events as events_router
from .routers import guest_parties, staff_parties, staff_tables
from .store import WaitlistStore


def _resolve_frontend_dist_dir(override: str | None = None) -> Path:
    """Resolve where static frontend files should be served from.

    Resolution order:
      1. Explicit argument (used by tests/alternate app factories).
      2. FRONTEND_DIST_DIR env var (used by Docker image runtime).
      3. Local dev default: ../../frontend/dist from this file.
    """
    if override:
        return Path(override).resolve()

    env_value = os.environ.get("FRONTEND_DIST_DIR")
    if env_value:
        return Path(env_value).resolve()

    return (Path(__file__).resolve().parents[3] / "frontend" / "dist").resolve()


def _mount_frontend(app: FastAPI, dist_dir: Path) -> None:
    """Serve the compiled frontend if available.

    The API routes are registered first, then this catch-all is added last so
    API/docs paths keep their dedicated handlers. If dist isn't present (normal
    local backend-only development), we skip mounting entirely.
    """
    if not dist_dir.exists():
        return

    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path in {"docs", "redoc", "openapi.json", "health"}:
            raise HTTPException(status_code=404, detail="Not Found")

        requested = (dist_dir / full_path).resolve()
        try:
            requested.relative_to(dist_dir)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Not Found") from exc

        if full_path and requested.is_file():
            return FileResponse(requested)

        index_file = dist_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build not found")


def create_app(*, seed_data: bool = True, database_url: str | None = None) -> FastAPI:
    load_dotenv()  # picks up a local .env (e.g. DATABASE_URL) if present; no-op otherwise

    resolved_url = resolve_database_url(database_url)
    engine = create_db_engine(resolved_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(
        title="Restaurant Waitlist Manager API",
        version="1.0.0",
        description=(
            "Backend implementation of the contract described in openapi.yaml, "
            "backing the frontend app."
        ),
        lifespan=lifespan,
    )

    init_schema(engine)
    session_factory = create_session_factory(engine)

    app.state.database_url = resolved_url
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.event_broker = EventBroker()
    # The staff account always exists - it's a login credential, not demo data.
    app.state.auth_manager = create_auth_manager(seed=True)

    if seed_data:
        with session_factory() as session:
            store = WaitlistStore(session, app.state.event_broker)
            # Only seed a fresh/empty database - avoids duplicating demo data
            # on every restart of a persisted (file/Postgres) database.
            if store.is_empty():
                store.seed()

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

    _mount_frontend(app, _resolve_frontend_dist_dir())

    return app
