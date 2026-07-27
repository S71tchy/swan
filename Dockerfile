# syntax=docker/dockerfile:1
# SWAN single-image build: compiles the React frontend, then runs the FastAPI
# backend which serves both the API (/api) and the built app from one origin.

# --- Stage 1: build the React/Vite frontend -> /web/dist -------------------- #
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: Python runtime ------------------------------------------------ #
FROM python:3.12-slim AS app
# uv for fast, locked dependency installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app/server

# Install deps first (cached until the lockfile changes). --no-dev drops
# httpx/pytest; alembic + psycopg ship because they're runtime deps.
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev

# Backend source, then the built frontend where the app auto-detects it.
COPY server/ ./
COPY --from=web /web/dist /app/web/dist

ENV PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/web/dist

EXPOSE 8000

# Apply migrations, then serve. $PORT is provided by Railway (fallback 8000 for
# a plain `docker run`). alembic upgrade is idempotent, so it's safe every boot.
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
