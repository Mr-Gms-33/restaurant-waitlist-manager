# E2E Tests (Playwright + Docker Compose)

This folder contains browser end-to-end tests that run against the full stack
defined in `../docker-compose.yaml` (app + Postgres).

## Install

```powershell
cd e2e
npm.cmd install
npx playwright install
```

## Run

```powershell
cd e2e
npm.cmd test
```

The test harness will:
- start `docker compose` with an isolated project name
- pick a free host port automatically (via `APP_PORT`)
- wait for `/health`
- run the Playwright tests
- tear down containers and volumes

## Current scenario

`tests/session-sync.spec.ts` validates two-client realtime behavior:
1. staff logs in (session 1)
2. a join link/session is created
3. guest opens the link in a second browser session (session 2)
4. guest changes state (`I'm here`)
5. staff session sees the update
