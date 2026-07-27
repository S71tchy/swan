# Deploying SWAN (test environment)

A single Docker image runs the whole app: the FastAPI backend serves the API
under `/api` **and** the built React frontend from one origin (so the session
cookie stays same-site — no CORS/cookie surgery). This guide targets **Railway**
for a quick shareable test deployment, backed by a free **Neon** PostgreSQL.

> Long-term target is Azure — see [Moving to Azure later](#moving-to-azure-later).
> Nothing here locks you in: it's a standard container + a `DATABASE_URL`.

## What's in the repo for this

- `Dockerfile` — builds the frontend, then runs the backend serving both.
- `railway.json` — tells Railway to build from the Dockerfile + healthcheck `/health`.
- `.dockerignore` — keeps dev/venv/internal files out of the image.
- Migrations run automatically on every deploy (`alembic upgrade head` in the
  container's start command).

---

## Step 1 — Create the database (Neon)

1. Sign up at **neon.tech**, create a project (pick a region near your testers).
2. Copy the connection string. It looks like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. **Rewrite the scheme** to the psycopg-v3 driver SWAN uses — change
   `postgresql://` to `postgresql+psycopg://`:
   ```
   postgresql+psycopg://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Keep the `?sslmode=require`. Save this as your `DATABASE_URL`.

## Step 2 — Create the Railway service

1. Sign up at **railway.com** → **New Project** → **Deploy from GitHub repo**
   (or **Empty Project** + `railway up` via the CLI if the repo isn't on GitHub).
2. Railway detects `railway.json` + `Dockerfile` and builds the image. Let the
   first build run — it may fail to boot until env vars are set (next step).
3. Under the service's **Settings → Networking**, click **Generate Domain**.
   Note the URL, e.g. `https://swan-production-xxxx.up.railway.app`. You need it
   for the two URL variables below.

## Step 3 — Set environment variables

Service → **Variables** → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `postgresql+psycopg://…` string from Step 1 |
| `SECRET_KEY` | a long random string (e.g. `openssl rand -hex 32`) |
| `COOKIE_SECURE` | `true` |
| `APP_BASE_URL` | your Railway domain (e.g. `https://swan-production-xxxx.up.railway.app`) |
| `FRONTEND_ORIGIN` | same Railway domain |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | *(optional)* real mail; if unset, emails log to the deploy logs instead of sending |

You do **not** set `PORT` (Railway injects it) or `STATIC_DIR` (baked into the image).

Redeploy if it didn't already. On boot the container runs `alembic upgrade head`,
so the schema is created automatically. Check **Deployments → logs** for
`Running upgrade … baseline schema` and the uvicorn startup line.

## Step 4 — Seed demo data (once)

The schema is created by migrations, but it's empty — you need the seeded demo
identities to log in. `seed.py` **wipes and reseeds**, so run it exactly once.

Easiest, from your machine with the Railway CLI (`npm i -g @railway/cli`):

```bash
railway link                       # pick the project/service
railway run --service <svc> bash -c "cd server && uv run python -m app.seed"
```

`railway run` injects the service's env (including `DATABASE_URL`) so this seeds
the Neon database. Alternatively, export the Neon `DATABASE_URL` locally and run
`uv run python -m app.seed` from `server/` directly — same effect.

> ⚠️ Never run this again against a database you care about — it deletes all rows.

## Step 5 — Test & share

Open the Railway domain. You should get the login screen; **Sign in with your
AGL account** logs you in as the seeded demo contributor, and the "sign in as
another identity" link switches between the seeded roles (see the table in
`README.md`). Share the URL with your testers.

---

## Operating notes

- **Redeploys** re-run migrations automatically and are safe; they do **not**
  reseed (data persists in Neon).
- **Logs**: Railway → service → Deployments → View logs. Console-logged emails
  (when SMTP is unset) show up here.
- **Schema changes**: change the models, generate a migration locally
  (`uv run alembic revision --autogenerate -m "…"`), commit it, and the next
  deploy applies it. See `migration.md`.
- **Free-tier limits**: Railway runs on a trial/usage credit; Neon's free tier
  is durable but sleeps idle databases (first request after idle is slow). Fine
  for a test; not for production load.

## Moving to Azure later

The same image and the same env vars carry over — only the platform wrapper
changes:

- **Compute**: push the image to **Azure Container Registry**, run it on
  **Azure Container Apps** (or App Service for Containers). It's the identical
  Dockerfile; set `PORT` to the port Azure expects (Container Apps uses the
  `targetPort` you configure; the container already honours `$PORT`).
- **Database**: **Azure Database for PostgreSQL – Flexible Server**. Build the
  same `postgresql+psycopg://…` URL (append `?sslmode=require`) as `DATABASE_URL`.
- **Config**: the same variables (`SECRET_KEY`, `COOKIE_SECURE=true`,
  `APP_BASE_URL`, `FRONTEND_ORIGIN`, SMTP) go into Container Apps secrets/env.
- Migrations still run on boot; seed once the same way via a one-off exec.

Nothing in the app code needs to change to make that move.
