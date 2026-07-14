# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Phase 1 is **built**: a running full-stack app recreating the 6 approved screens. See `README.md` for how to run it. Sources of truth remain `swan_spec_v2.md` (functionality) and `design_handoff/` (visuals) — spec wins on function, mock wins on visuals.

Stack (chosen during build; see `README.md` for rationale):
- **Frontend** `web/` — React + Vite + TypeScript, MapLibre GL (no map token), react-router. Design tokens in `web/src/styles/tokens.css`; screens in `web/src/screens/`.
- **Backend** `server/` — Python + FastAPI + SQLAlchemy + Pydantic, managed with `uv`.
- **DB** — SQLAlchemy over `DATABASE_URL`; **SQLite by default**, Postgres by config with zero code change. Models are deliberately portable (string UUIDs, JSON columns, plain lat/lng floats — no PG-only types). **PostGIS is intentionally deferred to Phase 2** (a migration adds geometry columns when the intelligence layers need real geometry); don't add a PostGIS dependency to make Phase 1 "correct".
- **Auth** — stubbed SSO: `POST /auth/login` signs a session JWT into an httpOnly cookie for a seeded user. The OIDC swap-in seam is isolated in `server/app/routers/auth.py` + `security.py`; a real IdP only changes how the token is *minted*.

### Commands

Backend (`server/`): `uv sync` · `uv run python -m app.seed` (wipes & reseeds — dev convenience) · `uv run uvicorn app.main:app --reload --port 8000`. Frontend (`web/`): `npm install` · `npm run dev` (proxies `/api` → :8000) · `npm run build` (runs `tsc -b` then Vite; use this to type-check).

There is no automated test suite yet; verify changes by running the app and exercising the flow, or with an in-process `httpx` client against the API (as used during the build).

### Reference files (do not treat as runnable code)
- `design_handoff/SWAN Design Explorations.dc.html` — design-tool export, **not** runnable UI. Read it as markup: all styling is inline; read exact values (colours, spacing, radii) directly off the elements. The "2a" section holds all 6 screens as 1440×900 frames tagged `data-screen-label`. When adjusting a screen's visuals, `design_handoff/README.md` §"Screens / Views" gives per-screen layout specs — read that rather than re-deriving from the `.dc.html`.
- Emoji glyphs (flags, transport modes) are placeholders carried into the app; the 16px/1.6px-stroke line icons were recreated in `web/src/components/icons.tsx`.

## Product architecture (from swan_spec_v2.md)

SWAN is a geospatial supply-chain risk platform, deliberately layered so later phases bolt on without a core rewrite:

- **Phase 1 (what the design handoff covers)** — core alert platform: interactive map, manual alert lifecycle, rights-gated approval/publication, email notifications. This is the only phase with UI mocks right now.
- **Phase 2** — data layer framework: ingestion connectors → normalization (Common Signal Schema, §6.2) → AI enrichment (NLP, dedup/clustering, risk scoring, correlation) → Signal Store → feeds either map layers or the Signal Review Queue, which promotes signals into Phase 1 alerts.
- **Phase 3** — external client portal fed from the same alert pipeline, plus public API.

Key domain model, and where each rule lives in code (full detail in spec §5.2–5.4):

- **Alert lifecycle** (`server/app/routers/alerts.py`): `Draft → Submitted → Published → Closed`, with `Rejected` branching from `Submitted` back to editable draft. The **Submit-vs-Publish** decision is computed server-side by `server/app/rights.py::routing_for_locations` and surfaced via `POST /alerts/routing`, which the create form polls to swap its CTA + footer notice: **Submit** when the author lacks publication rights for ≥1 selected location, **Publish** when they hold rights for *all*.
- **`valid_from`/`valid_to` semantics are commonly misread**: they control *map visibility*, not event timing. A blank `valid_to` means "until further notice" (rendered via `valid_to_label`, computed in `server/app/serialize.py`; the map/`scope=map` query filters on today ∈ [from, to]). The feed shows all published alerts; the map shows only currently-live ones — that's why the dashboard "active" count can be lower than the feed count.
- **Locations are repeatable blocks**, each with its own `modes[]` (Sea/Air/Road/Rail/Warehouse) and `flow` (Import/Export/Both). Stored as a JSON list on the alert (`server/app/models.py`), edited by `LocationBlockEditor` in `web/src/screens/CreateAlert.tsx`.
- **Publishing has two independent confirmations** (`web/src/components/PublishDialogs.tsx`, reused by create + approvals): (1) content-correctness, then (2) internal-vs-external choice (Yes / Yes with modification / No). Phase 1 only **stores** the external variant (`Alert.external_variant`); delivery is Phase 3 — don't build delivery mechanics.
- **Rights model is four-dimensional** (Creation, Internal Publication, External Publication, Client scope), each a country list and/or named **profiles**. Effective rights = union of profile countries + explicit list, resolved at read time in `server/app/rights.py` (so editing a `Profile` propagates live — never treat a profile as a point-in-time copy).

## Design tokens

All tokens are implemented as CSS custom properties in `web/src/styles/tokens.css` — edit there, don't hardcode hex values in components. They come from the spec's brand charter (§12) and the mock:

- AGL Blue `#1B365F` (primary chrome/text), AGL Yellow `#EED58E` (primary accent — text on yellow is always navy, never white), AGL Orange `#ED8C00`, AGL Dark Orange `#CF4527` (critical only), AGL Grey `#B2B4BE`, AGL Turquoise `#00A6C1`. Per the charter, secondary colours (orange/grey/turquoise/dark-orange) are **never used for text/labels** — only for map/severity/decoration. Severity ramp: Info=Grey · Watch=Yellow · Warning=Orange · Critical=Dark-Orange (with a lighter `#E88E75` critical *text* variant for legibility, see `web/src/lib/format.ts`).
- Type: **Space Grotesk** (600–700) for display/headings/numbers/buttons; **IBM Plex Sans** (400–600) for body/UI. Glass panels: `rgba(15,27,46,.8–.97)` + `backdrop-filter: blur(12–20px)` + `rgba(255,255,255,.10–.14)` borders — the dominant chrome for every floating panel.

The 6 screens are absolute-positioned at edge-relative offsets (matching the mock's `left:20/right:20/top:88/bottom:20` language) so they fill the viewport rather than a fixed 1440×900 canvas. Only the **Dashboard** renders the live MapLibre map; the other screens use `web/src/components/MapBackdrop.tsx` (a dimmed/blurred static backdrop), exactly as the mock does. Per-screen layout specs live in `design_handoff/README.md` §"Screens / Views".
