"""Database engine/session setup.

Deliberately database-agnostic: `store.py` only ever talks to SQLAlchemy's
ORM/Core query API, never to a specific driver. Switching from SQLite to
Postgres (or anything else SQLAlchemy supports) later is just:

  1. `pip install`/`uv add` the driver (e.g. `psycopg[binary]` for Postgres).
  2. Point `DATABASE_URL` at it, e.g. `postgresql+psycopg://user:pass@host/db`.

No application code needs to change.
"""

from __future__ import annotations

import os
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Shared declarative base for every ORM model (see `db_models.py`)."""


DEFAULT_DATABASE_URL = "sqlite:///./waitlist.db"


def resolve_database_url(override: str | None = None) -> str:
    """The `DATABASE_URL` environment variable wins unless `override` is given
    (used by tests/the app factory to force an isolated database)."""
    return override or os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def create_db_engine(database_url: str) -> Engine:
    """Builds an `Engine` for `database_url`, with the minimal
    dialect-specific tweaks SQLite needs to work well with FastAPI. Any other
    SQLAlchemy-supported URL (Postgres, MySQL, ...) is passed straight through
    with no special-casing.
    """
    connect_args: dict[str, Any] = {}
    engine_kwargs: dict[str, Any] = {}

    if database_url.startswith("sqlite"):
        # FastAPI runs sync route handlers (and our per-request Session) in a
        # thread pool, so a connection may be used by a different thread than
        # the one that created it - SQLite forbids that by default.
        connect_args["check_same_thread"] = False

        if ":memory:" in database_url:
            # Each new connection to an in-memory SQLite DB is a *separate*,
            # empty database. Force the whole engine to share one connection
            # so `init_schema()` and every subsequent request see the same
            # data. Used for tests and `VITE_USE_MOCK_BACKEND`-style demos.
            from sqlalchemy.pool import StaticPool

            engine_kwargs["poolclass"] = StaticPool

    return create_engine(database_url, connect_args=connect_args, **engine_kwargs)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_schema(engine: Engine) -> None:
    """Creates any missing tables. Works against any SQLAlchemy-supported
    database. A real production deployment with evolving schemas would use a
    migration tool (e.g. Alembic) instead of this - out of scope for the
    pilot.
    """
    Base.metadata.create_all(engine)
