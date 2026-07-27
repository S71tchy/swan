from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import admin, alerts, approvals, auth, meta, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # SQLite dev: create tables on boot (idempotent, zero-friction).
    # Postgres/prod: the schema is owned by Alembic (`alembic upgrade head`), so
    # skip create_all — it would create un-versioned tables that migrations then
    # can't stamp/track.
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="SWAN API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,  # required for the session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# The whole API lives under /api so it can coexist with the built frontend on a
# single origin in production (see the SPA handler below). In dev, Vite proxies
# /api → this app, so the frontend uses the same paths in both modes.
for r in (auth.router, alerts.router, approvals.router, users.router, meta.router, admin.router):
    app.include_router(r, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "swan-api"}


# --------------------------------------------------------------------------- #
# Single-origin frontend serving (production).
#
# When a built frontend (web/dist) is present, serve its static assets and fall
# back to index.html for client-side routes — so the API and the React app share
# one origin and the session cookie stays same-site. In local dev the dist dir
# doesn't exist, so this is skipped and Vite serves the app on :5173 instead.
# --------------------------------------------------------------------------- #
def _resolve_static_dir() -> Path | None:
    if settings.static_dir:
        p = Path(settings.static_dir)
    else:
        # server/app/main.py -> repo root -> web/dist
        p = Path(__file__).resolve().parents[2] / "web" / "dist"
    p = p.resolve()
    return p if (p / "index.html").is_file() else None


_DIST = _resolve_static_dir()

if _DIST is not None:
    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        """Serve a static file when it exists, else the SPA shell for client
        routes. API/docs paths are never handled here (they're matched by their
        own routes first; this guard is belt-and-suspenders)."""
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "health")):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (_DIST / full_path).resolve()
        # Path-traversal guard: never serve outside the dist directory.
        if full_path and candidate.is_relative_to(_DIST) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
