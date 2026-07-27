from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# SQLite needs check_same_thread off for FastAPI's threadpool; Postgres ignores it.
_is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}

# Pool tuning only matters for a networked DB (Postgres). SQLite uses a
# non-pooling connection, so these kwargs are skipped there.
engine_kwargs: dict = {"connect_args": connect_args, "future": True}
if not _is_sqlite:
    # pool_pre_ping transparently discards connections dropped by the server or a
    # proxy (managed Postgres closes idle ones), avoiding stale-connection errors.
    engine_kwargs.update(pool_pre_ping=True, pool_size=5, max_overflow=10, pool_recycle=1800)

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
