"""Alembic environment for SWAN.

The database URL and target metadata are taken from the application itself
(app.config.settings + app.database.Base) so migrations always track the live
models and honour the same DATABASE_URL as the running app — no duplicated
connection string in alembic.ini.
"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Import the app's settings + metadata. `app` is importable because
# pyproject sets pythonpath = ["."] and alembic runs from the server/ dir.
from app.config import settings
from app.database import Base
import app.models  # noqa: F401 — registers all tables on Base.metadata

# Alembic Config object (values from alembic.ini).
config = context.config

# Feed the app's DATABASE_URL to Alembic, overriding the ini placeholder so the
# real environment variable wins in every environment (dev SQLite / prod PG).
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# SQLite can't ALTER most columns in place; batch mode rewrites the table so the
# same migration scripts run on both SQLite (dev) and PostgreSQL (prod).
_render_as_batch = settings.database_url.startswith("sqlite")


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a DBAPI connection (`alembic upgrade --sql`)."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_render_as_batch,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=_render_as_batch,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
