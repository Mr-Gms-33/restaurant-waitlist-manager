# Restaurant Waitlist Manager - Frontend

React + TypeScript + Vite frontend for the pilot restaurant waitlist app.
See [`restaurant-waitlist-scope.md`](restaurant-waitlist-scope.md) for the
product scope and [`openapi.yaml`](openapi.yaml) for the API contract this
app talks to (implemented by [`backend/`](backend)).

This file consolidates everything about the frontend in one place: stack,
project layout, architecture, environment variables, running, and testing.

## Stack

- **React 19** + **TypeScript**
- **Vite** - dev server and build tool
- **React Router** - client-side routing (guest pages, staff pages)
- **Vitest** + **React Testing Library** - unit/component tests
- **Oxlint** - linting

## Project layout

```
waitlist-app/
  src/
    types/domain.ts            Core domain types shared by the UI and every
                                WaitlistService implementation (Party,
                                RestaurantTable, statuses, input DTOs)
    services/
      WaitlistService.ts       The interface - the single contract every
                                backend call goes through
      mockWaitlistService.ts   In-memory implementation (no backend needed)
      httpWaitlistService.ts   Real implementation - talks to the FastAPI
                                backend over fetch + Server-Sent Events
      authStore.ts             Staff auth state (bearer token), backed by
                                localStorage, talks to POST /auth/login
      ServiceProvider.tsx      React context that provides the active
                                WaitlistService to the component tree
      index.ts                 Chooses mock vs. HTTP implementation based on
                                VITE_USE_MOCK_BACKEND; exposes the singleton
    hooks/
      useAuth.ts                React hook over authStore (useSyncExternalStore)
      useParty.ts, useParties.ts, useTables.ts
                                 Hooks that call WaitlistService and
                                 re-fetch whenever it notifies a change
    components/
      RequireStaffAuth.tsx      Route guard - redirects to /staff/login if
                                 not authenticated
      PartyQueueTable.tsx, TableGrid.tsx, StatusBadge.tsx
                                 Presentational pieces of the staff dashboard
    pages/
      GuestJoinPage.tsx          "/" - join the waitlist (name, party size, contact)
      GuestStatusPage.tsx        "/status/:partyId" - live queue position,
                                  wait estimate, "I'm here" button
      StaffLoginPage.tsx         "/staff/login" - staff sign-in form
      StaffDashboardPage.tsx     "/staff" (auth required) - manage the queue
                                  and tables
    utils/time.ts                Formatting helpers (relative time, deadlines)
    App.tsx                      Route definitions
    main.tsx                     Entry point (ServiceProvider + Router setup)
    vite-env.d.ts                Type definitions for import.meta.env vars
  .env.example                   Documented environment variables
  .env.local                     Local overrides (gitignored)
```

## Architecture: the services layer

Every backend interaction goes through the `WaitlistService` interface
(`src/services/WaitlistService.ts`):

```ts
interface WaitlistService {
  // Guest-facing
  joinWaitlist(input: JoinWaitlistInput): Promise<Party>;
  getParty(partyId: string): Promise<Party | null>;
  confirmArrival(partyId: string): Promise<Party>;
  leaveWaitlist(partyId: string): Promise<void>;
  getQueuePosition(partyId: string): Promise<number | null>;

  // Staff-facing: parties
  listParties(): Promise<Party[]>;
  updateWaitTime(partyId: string, minutes: number): Promise<Party>;
  updatePartyStatus(partyId: string, status: PartyStatus): Promise<Party>;
  reorderParties(orderedIds: string[]): Promise<Party[]>;
  assignTable(partyId: string, tableId: string): Promise<{ party: Party; table: RestaurantTable }>;
  releaseTable(tableId: string): Promise<RestaurantTable>;

  // Staff-facing: tables
  listTables(): Promise<RestaurantTable[]>;
  addTable(input: AddTableInput): Promise<RestaurantTable>;
  removeTable(tableId: string): Promise<void>;
  updateTableStatus(tableId: string, status: TableStatus): Promise<RestaurantTable>;

  // Realtime
  subscribe(listener: () => void): () => void;
}
```

Two implementations exist:

- **`HttpWaitlistService`** - talks to the real FastAPI backend over
  `fetch`, and to `GET /events` (Server-Sent Events) for realtime updates.
  **This is the default.**
- **`MockWaitlistService`** - a fully in-memory implementation (with
  simulated latency and its own pub/sub), so the UI can run and be tested
  with zero backend.

`src/services/index.ts`'s `getWaitlistService()` returns whichever one is
configured (see [Environment variables](#environment-variables) below); UI
code never imports either implementation directly, only
`useWaitlistService()` / `getWaitlistService()`. This is what let this app's
backend go from "doesn't exist" -> mock -> real FastAPI service without any
page or component changing.

### Staff authentication

Handled separately from `WaitlistService` (`src/services/authStore.ts`,
`src/hooks/useAuth.ts`), since the mock backend has no real auth:

- `authStore.login(username, password)` calls the backend's
  `POST /auth/login` directly and stores the resulting bearer token +
  expiry + staff name in `localStorage` (survives page reloads).
- `authStore.getToken()` returns `null` once the token has expired.
- `HttpWaitlistService` reads `authStore.getToken()` and attaches
  `Authorization: Bearer <token>` to every staff-only request.
- `RequireStaffAuth` wraps `/staff` and redirects to `/staff/login` if
  `useAuth().isAuthenticated` is false.

### Realtime updates

`WaitlistService.subscribe(listener)` registers a callback fired whenever
party/table data changes (from this tab, or - for `HttpWaitlistService` -
from the backend via SSE, meaning changes from staff or other devices show
up live). The hooks (`useParties`, `useParty`, `useTables`) re-fetch on
notification rather than trusting the event to carry the new data.

## Environment variables

Defined in `.env.example` (copy to `.env.local`, which is gitignored, for
local overrides) and typed in `src/vite-env.d.ts`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Base URL of the FastAPI backend's API. Must match wherever the backend is actually running - see `backend/README.md`. |
| `VITE_USE_MOCK_BACKEND` | `false` | Set to `"true"` to run entirely against the in-memory mock instead of the real backend - no backend process needed, no login required. Useful offline or for isolated UI work/demos. |

Vite only reads `.env*` files at dev-server startup - after changing one,
restart `npm.cmd run dev` for it to take effect.

## Running it

1. Start the backend first (see [`backend/README.md`](backend/README.md)):
   ```powershell
   cd backend
   uv run uvicorn backend.main:create_app --factory --reload --port 8000
   ```
2. Copy `.env.example` to `.env.local` if you need to point at a different
   backend URL than the default.
3. Start the frontend:
   ```powershell
   cd waitlist-app
   npm install
   npm.cmd run dev
   ```
   (Use `npm.cmd` rather than `npm` on Windows if PowerShell's script
   execution policy blocks `npm.ps1` - see
   [about_Execution_Policies](https://go.microsoft.com/fwlink/?LinkID=135170).)
4. Open it:
   - Guest join page: `http://localhost:5173/`
   - Staff dashboard: `http://localhost:5173/staff` (login `staff` /
     `waitlist123`, the backend's seeded demo account)

### Running without a backend

Set `VITE_USE_MOCK_BACKEND=true` in `.env.local`, restart the dev server -
the whole app now runs against `MockWaitlistService`, no backend or login
required.

## Tests

```powershell
npm.cmd test        # single run (vitest run)
npm.cmd run test:watch   # watch mode
```

Covers: `MockWaitlistService`, `HttpWaitlistService` (with mocked
`fetch`/`EventSource`), `authStore` (login/expiry/persistence), and the
guest/staff pages (`RequireStaffAuth`, `StaffLoginPage`, etc.) via React
Testing Library.

## Other scripts

```powershell
npm.cmd run build     # tsc -b && vite build - type-checks then builds for production
npm.cmd run preview   # serve the production build locally
npm.cmd run lint      # oxlint
```

## Domain model

Shared by the UI and every `WaitlistService` implementation
(`src/types/domain.ts`):

```ts
type PartyStatus = 'waiting' | 'arrival_confirmed' | 'table_ready' | 'seated' | 'cancelled' | 'no_show';
type TableStatus = 'available' | 'occupied' | 'unavailable';

interface Party {
  id: string;
  name: string;
  partySize: number;
  contact: string;
  status: PartyStatus;
  estimatedWaitMinutes: number | null;   // set manually by staff
  tableId: string | null;
  arrivalDeadline: string | null;        // ISO timestamp
  arrivalConfirmedAt: string | null;     // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  partyId: string | null;
}
```

`ARRIVAL_CONFIRMATION_WINDOW_MINUTES` (15) is the amount of time a guest has
to tap "I'm here" after staff sets a wait estimate, matching the backend's
`ARRIVAL_CONFIRMATION_WINDOW_MINUTES` in `backend/src/backend/store.py`.

## Notes / limitations

- No offline support - if the backend/network is unreachable, calls fail
  with a friendly "Could not reach the server. Is the backend running?"
  message (see `authStore.login` and `httpWaitlistService.ts`).
- No guest accounts - a party is only identifiable by its `partyId` (from
  the URL after joining); losing that URL means losing track of the party
  from the guest side (staff can still see it on the dashboard).
- Single staff account, no roles/permissions - out of scope for the pilot
  (see `restaurant-waitlist-scope.md`).
