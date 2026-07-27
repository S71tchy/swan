# SQLite → PostgreSQL migration runbook

How to move SWAN from the dev default (SQLite) to PostgreSQL for production.
The app was built for this: the engine is config-driven, models use only
portable types, and Alembic already owns the schema. This is mostly ops, not
code surgery.

> **You do not need to change any application code to switch databases.** Only
> `DATABASE_URL` (env) changes. The one-time prep below (Alembic + pool tuning)
> is already committed.

---

## Already done (in the repo)

- `psycopg` v3 (the Postgres driver) is a dependency — see `server/pyproject.toml`.
- The engine reads `settings.database_url` and only pools when it's *not* SQLite
  (`server/app/database.py`).
- Alembic is wired to the app's settings + models; a baseline migration exists
  (`server/alembic/versions/…_baseline_schema.py`).
- Boot-time `create_all` is **SQLite-only**; on Postgres the schema is owned by
  Alembic (`server/app/main.py`).

So the steps below are provisioning, configuration, and running the migration.

---

## Step 1 — Provision Postgres

Use managed Postgres (RDS / Cloud SQL / Azure DB / Neon / Supabase) unless you
have a reason not to. Create:

- a database, e.g. `swan`
- an application role with privileges on it, e.g. `swan_app`

Note the host, port (usually 5432), database name, user, and password.

## Step 2 — Set `DATABASE_URL` (mind the driver scheme!)

⚠️ **This is the #1 gotcha.** We ship **psycopg v3**, not psycopg2. A bare
`postgresql://…` URL makes SQLAlchemy reach for psycopg2 and fail. You must use
the explicit driver in the scheme:

```bash
export DATABASE_URL="postgresql+psycopg://swan_app:PASSWORD@your-host:5432/swan"
```

Set it as a **real environment variable** in the prod host / container / secrets
manager — do not commit it in a `.env`. (The same variable name works locally in
`server/.env` for testing against Postgres.)

While you're setting prod config, also set:

- `SECRET_KEY` — a strong random value (not the dev default)
- `APP_BASE_URL` / `FRONTEND_ORIGIN` — the real prod URLs (used for email deep
  links + CORS)
- `SMTP_*` — real mail credentials if sending email

## Step 3 — Create the schema with Alembic

From `server/` (with `DATABASE_URL` pointing at Postgres):

```bash
uv run alembic upgrade head
```

This creates all tables and stamps the schema version. **Do not** rely on the
app's boot-time `create_all` for Postgres — it's intentionally skipped there.

## Step 4 — Load initial data (ONCE)

```bash
uv run python -m app.seed
```

⚠️ **`seed.py` wipes and reseeds.** Run it against Postgres **only** for the
initial fill, never again on a live database. The SQLite dev data is throwaway;
there's no need to copy it over.

> If you ever genuinely need to migrate real rows from SQLite, use `pgloader`
> (`pgloader ./server/swan.db postgresql://…`). You almost certainly don't for a
> first production stand-up.

## Step 5 — Run the app

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Multiple workers are now safe (SQLite's single-writer limit is gone). Put it
behind a process manager / reverse proxy as usual. Connection pooling
(`pool_pre_ping`, size 5, overflow 10, 30-min recycle) is already configured for
Postgres in `app/database.py`.

## Step 6 — Smoke test

- `GET /health` returns ok.
- Log in, view the map/feed, create + publish an alert, confirm an email fires
  (or logs to console if SMTP is unset).

---

## Future schema changes (once on Postgres)

Never hand-edit tables. Change the SQLAlchemy models, then:

```bash
uv run alembic revision --autogenerate -m "describe the change"
# review the generated file in server/alembic/versions/ — always eyeball it
uv run alembic upgrade head
```

Deploy = `alembic upgrade head` before the new app version starts serving.

Useful commands:

```bash
uv run alembic current      # what revision is the DB on
uv run alembic history      # list migrations
uv run alembic downgrade -1 # roll back one (if a migration goes wrong)
```

---

## Known follow-ups (optional, not blockers)

- **Timezone-naive datetimes.** Timestamp columns are `DateTime` (→ `TIMESTAMP
  WITHOUT TIME ZONE`) while the app writes tz-aware UTC values. SQLite is loose
  about this; Postgres is stricter. If you want clean tz handling, switch the
  timestamp columns to `DateTime(timezone=True)` and generate a follow-up
  migration **before** building reporting on those fields.
- **`JSON` vs `JSONB`.** The `JSON` columns work as-is. If you later want to
  query/index *inside* them in SQL, migrate them to `JSONB`.
- **PostGIS** stays deferred to Phase 2 (geometry columns arrive with the
  intelligence layer) — don't add it now.
