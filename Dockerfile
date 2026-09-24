FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build


FROM python:3.12-slim AS app

# uv is used by this repo's backend dependency workflow.
COPY --from=ghcr.io/astral-sh/uv:0.8.15 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/sdip \
    FRONTEND_DIST_DIR=/app/frontend_dist

WORKDIR /app/backend
COPY backend/ ./
RUN uv sync --frozen --no-dev

COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "backend.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
