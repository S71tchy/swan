from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.include_router(auth.router)
app.include_router(alerts.router)
app.include_router(approvals.router)
app.include_router(users.router)
app.include_router(meta.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "swan-api"}
