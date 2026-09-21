# Restaurant Waitlist Manager - Frontend

React + TypeScript + Vite frontend for the pilot restaurant waitlist app (see
[`../restaurant-waitlist-scope.md`](../restaurant-waitlist-scope.md) and
[`../openapi.yaml`](../openapi.yaml)).

## Stack

- **React 19 + TypeScript + Vite** - guest join/status pages and a staff
  dashboard, sharing one route tree (`src/App.tsx`).
- **Services layer** (`src/services/WaitlistService.ts`) - every backend
  call goes through this interface, so the UI never talks to `fetch`/SSE
  directly (see [Services layer](#services-layer) below).
- **Bearer-token staff auth** (`src/services/authStore.ts`,
  `src/hooks/useAuth.ts`) - persisted in `localStorage`, attached to staff
  requests by `HttpWaitlistService`.
- **Server-Sent Events** - `HttpWaitlistService` subscribes to the backend's
  `GET /events` stream so guest/staff views refresh live without polling.
- **Tests:** Vitest + React Testing Library.

## Project layout

```
src/
  App.tsx                 # Route tree: guest join/status, staff login/dashboard
  main.tsx                # Entry point, wraps App in ServiceProvider
  types/domain.ts          # Party, RestaurantTable, statuses, input DTOs
  services/
    WaitlistService.ts        # The interface - the contract every screen depends on
    httpWaitlistService.ts    # Real implementation - fetch + SSE against the backend
    mockWaitlistService.ts    # In-memory implementation - no backend needed
    authStore.ts               # Staff login/logout, token persistence, expiry
    ServiceProvider.tsx         # React context exposing the active WaitlistService
    index.ts                    # Picks Http vs Mock based on VITE_USE_MOCK_BACKEND
  hooks/
    useAuth.ts               # Reactive wrapper around authStore
    useParties.ts, useParty.ts, useTables.ts   # Reactive wrappers around WaitlistService
  pages/
    GuestJoinPage.tsx        # Guest: join the waitlist
    GuestStatusPage.tsx      # Guest: live queue position / table-ready status
    StaffLoginPage.tsx       # Staff: login form
    StaffDashboardPage.tsx   # Staff: manage queue + tables
  components/
    PartyQueueTable.tsx, TableGrid.tsx, StatusBadge.tsx, RequireStaffAuth.tsx
  utils/time.ts             # Wait-time/deadline formatting helpers
```

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

1. Start the backend (see [`../backend/README.md`](../backend/README.md)):
   ```powershell
   cd ../backend
   uv run uvicorn backend.main:create_app --factory --reload --port 8000
   ```
2. Copy `.env.example` to `.env.local` if you need to point at a different
   backend URL (defaults to `http://localhost:8000/api/v1`). **This must
   match the port the backend is actually running on**, and Vite only reads
   `.env.local` at startup - restart `npm run dev` after changing it.
3. Start the frontend:
   ```powershell
   npm install
   npm.cmd run dev
   ```
   (Use `npm.cmd` rather than `npm` if your shell blocks running
   `npm.ps1`, e.g. PowerShell's default execution policy.)
4. Guest join page: `http://localhost:5173/`. Staff dashboard:
   `http://localhost:5173/staff` (login with `staff` / `waitlist123`, the
   backend's seeded demo account).

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Base URL of the backend API + SSE endpoint |
| `VITE_USE_MOCK_BACKEND` | `false` | `true` runs entirely against the in-memory mock (no backend, no login) |

### Running without a backend

Set `VITE_USE_MOCK_BACKEND=true` (in `.env.local`) to run entirely against
the in-memory mock - no backend, no login required, useful for offline UI
work or demos.

## Tests

```powershell
npm.cmd test
```

Covers the mock service, the HTTP service (with a mocked `fetch`/
`EventSource`), the auth store, and the guest/staff pages.

## Tooling notes

Built with Vite + React + TypeScript + Oxlint + Vitest. Run `npm run lint` to
lint, `npm run build` to type-check and produce a production build.

## Notes / limitations

- No production build/deploy config is set up yet - `npm run build` produces
  a static `dist/`, but there's no hosting/CI wiring for the pilot.
- `VITE_API_BASE_URL` is baked in at build time (Vite env var), so a
  production build targets one fixed backend URL.
- The staff dashboard has a single shared account (no per-staff roles or
  permissions) - matches the backend's current auth model.
