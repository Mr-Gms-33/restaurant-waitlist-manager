# Restaurant Waitlist Manager - Frontend

React + TypeScript + Vite frontend for the pilot restaurant waitlist app (see
[`../restaurant-waitlist-scope.md`](../restaurant-waitlist-scope.md) and
[`../openapi.yaml`](../openapi.yaml)).

## Services layer

Every backend call goes through the `WaitlistService` interface
(`src/services/WaitlistService.ts`). Two implementations exist:

- **`HttpWaitlistService`** (`src/services/httpWaitlistService.ts`) - talks to
  the real FastAPI backend in `../backend`, over `fetch`/SSE. **This is the
  default.**
- **`MockWaitlistService`** (`src/services/mockWaitlistService.ts`) - an
  in-memory mock, so the UI can run/be tested with no backend at all.

`src/services/index.ts` decides which one `getWaitlistService()` returns,
based on `VITE_USE_MOCK_BACKEND`. UI code never imports either implementation
directly - only `useWaitlistService()` / `getWaitlistService()`.

Staff authentication (`src/services/authStore.ts`, `src/hooks/useAuth.ts`) is
handled separately from `WaitlistService`, since the mock backend has no real
auth: it calls the backend's `POST /auth/login` directly and stores the
resulting bearer token, which `HttpWaitlistService` attaches to every
staff-only request.

## Running it

1. Start the backend (see `../backend/README.md`):
   ```powershell
   cd ../backend
   uv run uvicorn backend.main:create_app --factory --reload --port 8000
   ```
2. Copy `.env.example` to `.env.local` if you need to point at a different
   backend URL (defaults to `http://localhost:8000/api/v1`).
3. Start the frontend:
   ```powershell
   npm install
   npm run dev
   ```
4. Guest join page: `http://localhost:5173/`. Staff dashboard:
   `http://localhost:5173/staff` (login with `staff` / `waitlist123`, the
   backend's seeded demo account).

### Running without a backend

Set `VITE_USE_MOCK_BACKEND=true` (in `.env.local`) to run entirely against
the in-memory mock - no backend, no login required, useful for offline UI
work or demos.

## Tests

```powershell
npm test
```

Covers the mock service, the HTTP service (with a mocked `fetch`/
`EventSource`), the auth store, and the guest/staff pages.

## Tooling notes

Built with Vite + React + TypeScript + Oxlint + Vitest. Run `npm run lint` to
lint, `npm run build` to type-check and produce a production build.
