<div align="center">

# Restaurant Waitlist Manager

**Operational waitlist product**

Full-stack waitlist management for restaurants — FastAPI backend, React frontend, and Docker delivery.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Portfolio](https://img.shields.io/badge/Portfolio-mounir--gmamsi-1b3550?style=for-the-badge&logo=netlify&logoColor=white)](https://mounir-gmamsi.netlify.app/)

</div>

---

## Overview

Restaurant Waitlist Manager helps restaurants manage guest queues digitally. The system follows an OpenAPI contract, with a FastAPI backend, PostgreSQL persistence, and a TypeScript React client for day-to-day waitlist operations.

---

## What the product delivers

| Capability | Description |
|------------|-------------|
| Waitlist operations | Add, update and track waiting guests |
| API contract | OpenAPI-driven backend implementation |
| Staff UI | React application for operational use |
| Persistence | Relational storage for waitlist state |
| Local delivery | Docker Compose end-to-end stack |
| Quality | Backend and frontend tests |

---

## Technology stack

### Backend

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-222222?style=flat-square)

### Frontend

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)

### Platform

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white)

| Layer | Technologies |
|-------|----------------|
| API | FastAPI, SQLAlchemy, PostgreSQL, Uvicorn |
| UI | React, TypeScript, Vite |
| Contract | OpenAPI (`openapi.yaml`) |
| Ops | Docker Compose, Makefile |

---

## Solution flow

| Step | Stage | Technologies |
|:----:|-------|--------------|
| 1 | Staff updates waitlist in UI | React, TypeScript |
| 2 | API validates against contract | FastAPI, OpenAPI |
| 3 | Persist queue state | SQLAlchemy, PostgreSQL |
| 4 | Refresh UI status | REST JSON |
| 5 | Run stack locally | Docker Compose |

```mermaid
flowchart TD
  A[1. Waitlist UI] --> B[2. FastAPI endpoints]
  B --> C[3. PostgreSQL state]
  C --> D[4. Updated queue view]
```

---

## Repository structure

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI service (uv / pyproject) |
| `frontend/` | React + Vite client |
| `openapi.yaml` | API contract |
| `docker-compose.yml` | Local stack |
| `e2e/` | End-to-end tests |

---

## Run locally

```bash
docker compose up --build
```

See `Makefile` and backend/frontend READMEs for development workflows.

---

## Author

**Mounir Gmamsi**  
[Portfolio](https://mounir-gmamsi.netlify.app/) · [GitHub](https://github.com/Mr-Gms-33) · [LinkedIn](https://www.linkedin.com/in/mounir-gmamsi-1595951b3)
