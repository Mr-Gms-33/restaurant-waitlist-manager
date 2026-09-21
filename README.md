# Restaurant Waitlist Manager

A waitlist management tool for an independent restaurant pilot: guests join
remotely and track their status from their phone, staff manage the queue and
tables from a live dashboard. See
[`restaurant-waitlist-scope.md`](restaurant-waitlist-scope.md) for the full
product scope, and [`openapi.yaml`](openapi.yaml) for the API contract
shared by both apps below.

## Repo layout

```
backend/          FastAPI backend implementing openapi.yaml
frontend/         React + TypeScript + Vite frontend (guest + staff UI)
openapi.yaml      API contract - every endpoint, request/response, auth
restaurant-waitlist-scope.md   Product scope / MVP definition
```

Each app has its own README with full setup/run/test instructions:
[`backend/README.md`](backend/README.md) and
[`frontend/README.md`](frontend/README.md).

## Stack

- **Frontend:** React, TypeScript, Vite. A `WaitlistService` interface
  decouples the UI from the backend, with a real HTTP implementation and an
  in-memory mock (for offline UI work/tests).
- **Backend:** FastAPI + Pydantic (camelCase JSON matching the frontend's
  types), SQLAlchemy + SQLite for storage (database-agnostic - swappable to
  Postgres via one environment variable), bearer-token staff auth, and
  Server-Sent Events for live updates.
- **Tests:** Vitest + React Testing Library (frontend), Pytest (backend).

## Quickstart

1. **Backend** (see [`backend/README.md`](backend/README.md) for details):
   ```powershell
   cd backend
   uv sync
   uv run uvicorn backend.main:create_app --factory --reload --port 8000
   ```
   - API: `http://localhost:8000/api/v1`
   - Docs: `http://localhost:8000/docs`
   - Seeded staff login: `staff` / `waitlist123`

2. **Frontend** (see [`frontend/README.md`](frontend/README.md) for
   details), in a second terminal:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   - Guest join page: `http://localhost:5173/`
   - Staff dashboard: `http://localhost:5173/staff`

   If you change the backend's port, update
   `frontend/.env.local` (copy from `.env.example`) to match -
   `VITE_API_BASE_URL` must point at the running backend.

## Tests

```powershell
cd backend && uv run pytest
cd frontend && npm test
```

## Notes

- This is a single-instance pilot setup: in-memory SSE pub/sub, no auth
  roles beyond one staff account, wide-open CORS. See each app's README for
  specific limitations and next steps (e.g. Postgres, Alembic migrations,
  multi-instance realtime).
