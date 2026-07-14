from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import alerts, approvals, auth, meta, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on boot. For Postgres, prefer Alembic migrations in prod;
    # create_all is convenient for SQLite dev and idempotent.
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "swan-api"}
