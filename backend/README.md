# Restaurant Waitlist Manager - Backend

FastAPI implementation of the contract described in [`../openapi.yaml`](../openapi.yaml),
built to back the `waitlist-app` frontend (`../waitlist-app`).

## Stack

- **FastAPI** + **Pydantic v2** (camelCase JSON in/out, matching the frontend's
  `src/types/domain.ts`)
- **SQLAlchemy + SQLite** (`src/backend/db.py`, `src/backend/db_models.py`,
  `src/backend/store.py`) for parties/tables - data persists across
  restarts. Database-agnostic: pick any SQLAlchemy-supported database via
  `DATABASE_URL` (see [Database](#database) below).
- **Bearer-token auth** for staff endpoints (`src/backend/auth.py`) - PBKDF2
  password hashing, random opaque session tokens (no external auth deps).
- **Server-Sent Events** (`GET /api/v1/events`) for live updates, mirroring
  the frontend's `WaitlistService.subscribe()`.

## Project layout

```
src/backend/
  main.py          # FastAPI app factory, CORS, error handling, router wiring
  models.py        # Pydantic schemas (camelCase) matching openapi.yaml
  db.py            # SQLAlchemy engine/session factory, schema creation
  db_models.py     # SQLAlchemy ORM models (parties, tables tables)
  store.py         # Business rules over the database (parties, tables)
  events.py        # In-memory pub/sub used for the SSE stream
  auth.py          # Password hashing + bearer token issuance/validation
  dependencies.py  # FastAPI DI: get_db_session, get_store, get_auth_manager, get_current_staff
  errors.py        # Domain errors -> HTTP status codes
  routers/
    auth.py            # POST /auth/login
    guest_parties.py   # Guest endpoints (no auth)
    staff_parties.py   # Staff queue management (auth required)
    staff_tables.py    # Staff table management (auth required)
    events.py          # GET /events (SSE)
tests/
  test_store.py         # Unit tests for the SQLAlchemy-backed store
  test_auth.py           # Password hashing + login + auth dependency
  test_guest_flow.py     # Guest endpoints end-to-end
  test_staff_parties.py  # Staff queue endpoints end-to-end
  test_staff_tables.py   # Staff table endpoints end-to-end
  test_events.py         # SSE stream
```

## Running it

```powershell
cd backend
uv sync
uv run uvicorn backend.main:create_app --factory --reload --port 8000
```

(`--factory` because `backend.main` exposes an app *factory*, not a
module-level `app` instance - this keeps importing the module side-effect
free, which is what lets tests build isolated, in-memory-database app
instances.)

- API base URL: `http://127.0.0.1:8000/api/v1`
- Interactive docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Database

Storage is SQLAlchemy-backed and database-agnostic: `store.py` only ever
uses SQLAlchemy's ORM/Core query API, never anything driver-specific, so any
SQLAlchemy-supported database works without code changes.

Configure it with the `DATABASE_URL` environment variable (a `.env` file in
`backend/` is also picked up automatically - see `.env.example`):

```powershell
# Default if unset - a local SQLite file, created next to wherever the
# server is run from. Data persists across restarts.
$env:DATABASE_URL = "sqlite:///./waitlist.db"

# Postgres, once a driver is installed (e.g. `uv add "psycopg[binary]"`):
$env:DATABASE_URL = "postgresql+psycopg://user:password@localhost:5432/waitlist"
```

Tables are created automatically on startup (`Base.metadata.create_all`); a
brand-new/empty database is seeded with demo parties and tables, but an
existing one is left alone on restart. There's no migration tool wired up
yet (out of scope for the pilot) - a schema change on a persisted database
would need a tool like Alembic.

## Default staff login

Seeded automatically on startup (this is a demo credential, not meant for
production):

- **username:** `staff`
- **password:** `waitlist123`

```powershell
curl -X POST http://127.0.0.1:8000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"staff","password":"waitlist123"}'
```

Use the returned `accessToken` as `Authorization: Bearer <token>` on every
`Staff` endpoint.

## Tests

```powershell
uv run pytest
```

## Notes / limitations

- Realtime updates (`GET /events`) use an in-memory pub/sub per process
  (`events.py`); fine for a single-instance pilot/demo, but a multi-instance
  deployment would need something like Redis pub/sub instead.
- No migration tool - schema changes against a persisted database need a
  manual migration or a tool like Alembic.
- CORS is wide open (`allow_origins=["*"]`) to make local frontend
  development friction-free; tighten this before any real deployment.
