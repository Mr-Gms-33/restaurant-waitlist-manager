# Restaurant Waitlist Manager - Backend

FastAPI implementation of the contract described in [`../openapi.yaml`](../openapi.yaml),
built to back the `waitlist-app` frontend (`../waitlist-app`).

## Stack

- **FastAPI** + **Pydantic v2** (camelCase JSON in/out, matching the frontend's
  `src/types/domain.ts`)
- **In-memory store** (`src/backend/store.py`) - no database. Restarting the
  server resets all data back to the seeded demo data.
- **Bearer-token auth** for staff endpoints (`src/backend/auth.py`) - PBKDF2
  password hashing, random opaque session tokens (no external auth deps).
- **Server-Sent Events** (`GET /api/v1/events`) for live updates, mirroring
  the frontend's `WaitlistService.subscribe()`.

## Project layout

```
src/backend/
  main.py          # FastAPI app factory, CORS, error handling, router wiring
  models.py        # Pydantic schemas (camelCase) matching openapi.yaml
  store.py         # In-memory data + business rules (parties, tables)
  auth.py          # Password hashing + bearer token issuance/validation
  dependencies.py  # FastAPI DI: get_store, get_auth_manager, get_current_staff
  errors.py        # Domain errors -> HTTP status codes
  routers/
    auth.py            # POST /auth/login
    guest_parties.py   # Guest endpoints (no auth)
    staff_parties.py   # Staff queue management (auth required)
    staff_tables.py    # Staff table management (auth required)
    events.py          # GET /events (SSE)
tests/
  test_store.py         # Unit tests for the in-memory store
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
uv run uvicorn backend.main:app --reload --port 8000
```

- API base URL: `http://127.0.0.1:8000/api/v1`
- Interactive docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

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

- State is in-memory and per-process: fine for the pilot/demo, not for a
  multi-instance deployment.
- CORS is wide open (`allow_origins=["*"]`) to make local frontend
  development friction-free; tighten this before any real deployment.
