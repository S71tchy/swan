# SWAN — Strategic Warning & Alert Network (Phase 1)

AGL's internal disruption-awareness platform. This repo implements **Phase 1**: the
core alert platform — login → live world map → live feed → alert creation →
approval/publication → profile — built to the approved "Ops Deck" design for now.

- **Frontend**: React + Vite + TypeScript, MapLibre GL (no map token needed).
- **Backend**: Python + FastAPI + SQLAlchemy (+ Pydantic).
- **Database**: SQLAlchemy over `DATABASE_URL` — SQLite out of the box; point at
  PostgreSQL with zero code change. (PostGIS geometry is a Phase-2 migration; see
  `CLAUDE.md`.)
- **Auth**: stubbed SSO (dev login endpoint + signed session cookie), with an OIDC
  swap-in seam. Seeded identities of differing rights let you exercise every flow.

## Prerequisites

- Python ≥ 3.11 with [`uv`](https://docs.astral.sh/uv/) (`pip install uv`)
- Node ≥ 18 with npm

## Quick start (one command)

From the repo root:

```bash
npm install                   # installs the dev launcher (concurrently)
npm run setup                 # uv sync (backend) + npm install (frontend)
cp server/.env.example server/.env
npm run seed                  # create + seed the database
npm run dev                   # starts BOTH services with interleaved [api]/[web] logs
```

Then open **http://localhost:5173**. `npm run dev` streams both services to one
terminal (blue `[api]`, magenta `[web]`); Ctrl+C stops both.

Other root scripts: `npm run dev:api` / `npm run dev:web` run a single service.

### PowerShell launcher (recommended on Windows for testing)

`start-dev.ps1` does the same but also **frees stale ports first** (avoids the
`WinError 10013` port-in-use error) and cleans up on exit:

```powershell
./start-dev.ps1            # start both, stream [api]/[web] logs
./start-dev.ps1 -Seed      # reseed the database, then start
./start-dev.ps1 -ApiPort 8001 -WebPort 5174
```

Ctrl+C stops both services and releases the ports.

## Run it manually (two terminals)

**1. Backend** (`server/`):

```bash
cd server
uv sync                       # install deps into .venv
cp .env.example .env          # SQLite default — no DB server needed
uv run python -m app.seed     # create + seed the database (idempotent; wipes & reseeds)
uv run uvicorn app.main:app --reload --port 8000
```

API is now at http://localhost:8000 (interactive docs at `/api/docs`, ReDoc at `/api/redoc`, raw spec at `/api/openapi.json` — all reachable through the Vite dev proxy too, and linked from Settings → API & integrations).

**2. Frontend** (`web/`):

```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to the backend
on :8000, so the session cookie is same-origin.

### Using Postgres instead of SQLite

No code changes required — the models are DB-agnostic. On Postgres the schema is
owned by **Alembic** (not the app's boot-time `create_all`, which is SQLite-only).
Set `DATABASE_URL`, create the schema, then seed once:

```
DATABASE_URL=postgresql+psycopg://swan:swan@localhost:5432/swan
```

```bash
uv run alembic upgrade head   # create/upgrade the schema (versioned)
uv run python -m app.seed     # initial data ONCE — this wipes & reseeds
```

> ⚠️ Use the `postgresql+psycopg://` scheme (psycopg **v3**). A bare
> `postgresql://` selects psycopg2, which isn't installed, and fails.

After a model change, generate and apply a migration:

```bash
uv run alembic revision --autogenerate -m "describe the change"   # review the file
uv run alembic upgrade head
```

**Full production migration runbook:** [`migration.md`](./migration.md).

## Demo identities

Click **"Sign in with your AGL account"** to sign in as **Awa Kouassi** (Field
Contributor, publishes only in Côte d'Ivoire). Use the small **"demo: sign in as
another identity"** link on the login card to switch to:

| Identity | Rights | Shows off |
|---|---|---|
| **Awa Kouassi** | Create; internal publish **CI** only | Submit-for-approval routing (e.g. a Nigeria alert routes to approval) |
| **C. Diallo** | Profile **WEST-AFRICA** (approves CI/NG/GH/SN/CM) | The approval queue with pending submissions |
| **R. Manager** | Rights Manager, **WORLD** | Manager view / broadest perimeter |
| …and the branch authors (M. Nunes, Y. Traoré, etc.) | | |

## The Phase-1 flow to try

1. **Map dashboard** — click a severity-coded marker to open the alert detail panel.
2. **Create alert** — pick a **Nigeria** location (e.g. Lagos — Apapa) as Awa; the
   footer notice and primary button switch to **"Submit for approval"** because she
   lacks Nigeria rights. Pick a **Côte d'Ivoire** location instead and it becomes
   **"Publish"** (which opens the content-confirm → internal/external dialogs).
3. **Approvals** — sign in as **C. Diallo**, open Approvals, and Publish or Reject a
   submission. "Edit then publish" lets you amend before publishing.
4. **Live feed** — filter by scope (All / My perimeter) and severity.
5. **My profile** — identity, activity, notification toggles, and the read-only
   four-dimension rights matrix + publication perimeter.

## Layout

```
server/            FastAPI backend
  app/
    main.py        app + CORS + router wiring
    models.py      SQLAlchemy models (User, Profile, Alert, AuditLog)
    schemas.py     Pydantic API contract
    rights.py      four-dimension rights engine (Submit-vs-Publish, perimeter)
    routers/       auth, alerts (lifecycle), approvals, users, meta
    seed.py        seeds the mock's users, profiles, and alerts
    reference.py   country catalogue, standard profiles, gazetteer
web/               React + Vite frontend
  src/
    screens/       Login, Dashboard, Feed, CreateAlert, Approvals, Profile
    components/     shell (TopBar, LeftRail), panels, dialogs, primitives
    lib/           map style, formatting/severity helpers
    api.ts         typed fetch client
    types.ts       mirrors schemas.py
design_handoff/    the approved design (source of visual truth)
swan_spec_v2.md    the functional specification (source of functional truth)
```

## Notes

- The map uses MapLibre's free demo vector tiles. Offline, the navy background still
  renders and lat/lng markers stay correctly projected.
- Everything (create/submit/approve/publish/reject/close, rights changes) is written
  to an immutable `audit_log` table per spec §10.
- External publication in Phase 1 only **stores** the variant/intent; client delivery
  is Phase 3.
