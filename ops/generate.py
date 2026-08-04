"""Generate the Neon grant SQL straight from app.reference, so the country and
place lists can't drift from what the app validates against.

Run from the repo root, with the server package importable:

    PYTHONPATH=server python ops/generate.py ops/grant_admin_rights.sql ops/seed_places.sql

The country list itself comes from app/country_data.py, which ops/build_geo.py
generates from Natural Earth — so re-run build_geo.py first if the catalogue is
what changed.
"""
import json
import sys

from app.reference import COUNTRY_CATALOGUE, PLACES, STANDARD_PROFILES

USER_IDS = [
    "8f0407fc-7d82-4279-84f8-702dbdf0eed3",
    "9b15cf10-beb5-4cfd-9c1c-baa71f8bf8a9",
]

ALL = list(COUNTRY_CATALOGUE.keys())


def lit(value) -> str:
    """A JSON literal safe for a Postgres json column."""
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::json"


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


out = []
w = out.append

w("-- =====================================================================")
w("--  SWAN — grant full administrator rights to two self-registered users")
w(f"--  Generated from app/reference.py · {len(ALL)} countries")
w("--  Safe to re-run (idempotent). Run in the Neon SQL Editor.")
w("-- =====================================================================")
w("")
w("-- ---------------------------------------------------------------------")
w("-- 0. Pre-flight: confirm both ids exist BEFORE granting anything.")
w("--    An UPDATE against a wrong id succeeds silently on 0 rows, so check")
w("--    this returns exactly 2 rows first.")
w("-- ---------------------------------------------------------------------")
w("SELECT id, email, name, status, role_label FROM users WHERE id IN (")
w(",\n".join(f"  {q(u)}" for u in USER_IDS))
w(");")
w("")
w("BEGIN;")
w("")
w("-- ---------------------------------------------------------------------")
w("-- 1. Standard rights profiles.")
w("--    `seed.py` normally creates these; if it never ran, the profiles table")
w("--    is empty and the WORLD profile below wouldn't resolve to anything.")
w("-- ---------------------------------------------------------------------")
w("INSERT INTO profiles (name, countries, embeds_rights_manager) VALUES")
rows = []
for name, cfg in STANDARD_PROFILES.items():
    rows.append(
        f"  ({q(name)}, {lit(cfg['countries'])}, {str(cfg['embeds_rights_manager']).lower()})"
    )
w(",\n".join(rows))
w("ON CONFLICT (name) DO UPDATE SET")
w("  countries             = EXCLUDED.countries,")
w("  embeds_rights_manager = EXCLUDED.embeds_rights_manager;")
w("")
w("-- ---------------------------------------------------------------------")
w("-- 2. Promote the two accounts to full administrators.")
w("--")
w("--    status='active'        lifts the 'pending' flag self-registration sets")
w("--    can_create             the Create-alert dimension")
w("--    is_rights_manager      admin sections + orphaned-alert escalation")
w("--    profiles=['WORLD']     nice perimeter label, and grants internal reach")
w("--    the three country lists are ALSO set explicitly, so the accounts keep")
w("--    full rights even if someone later narrows the WORLD profile.")
w("--    (external publication ignores profiles by design — rights.py:29 — so")
w("--     the explicit external list is the only thing that grants it.)")
w("-- ---------------------------------------------------------------------")
w("UPDATE users SET")
w("  status                 = 'active',")
w("  role_label             = 'Rights Manager',")
w("  can_create             = true,")
w("  is_rights_manager      = true,")
w(f"  internal_pub_countries = {lit(ALL)},")
w(f"  external_pub_countries = {lit(ALL)},")
w(f"  client_scope           = {lit(ALL)},")
w("  profiles               = '[\"WORLD\"]'::json")
w("WHERE id IN (")
w(",\n".join(f"  {q(u)}" for u in USER_IDS))
w(");")
w("")
w("COMMIT;")
w("")
w("-- ---------------------------------------------------------------------")
w(f"-- 3. Verify (should return 2 rows, both {len(ALL)} / {len(ALL)} / {len(ALL)} / t / t / active).")
w("-- ---------------------------------------------------------------------")
w("SELECT")
w("  email, name, status, role_label, can_create, is_rights_manager,")
w("  json_array_length(internal_pub_countries) AS internal_n,")
w("  json_array_length(external_pub_countries) AS external_n,")
w("  json_array_length(client_scope)           AS clients_n,")
w("  profiles")
w("FROM users")
w("WHERE id IN (")
w(",\n".join(f"  {q(u)}" for u in USER_IDS))
w(");")
w("")

grant_sql = "\n".join(out)

# ---- Part 2: the gazetteer -------------------------------------------------
p = []
p.append("-- =====================================================================")
p.append("--  SWAN — seed the `places` gazetteer (location master data)")
p.append("--  The create-alert location picker types ahead against this table.")
p.append("--  Empty table = no location can ever be chosen = no alert can be made.")
p.append("--  Safe to re-run (idempotent).")
p.append("-- =====================================================================")
p.append("")
p.append("INSERT INTO places (code, name, country, lat, lng, aliases, created_at) VALUES")
prows = []
for pl in PLACES:
    prows.append(
        f"  ({q(pl['code'])}, {q(pl['name'])}, {q(pl['country'])}, "
        f"{pl['lat']}, {pl['lng']}, {lit(pl.get('aliases', []))}, "
        f"(now() AT TIME ZONE 'utc'))"
    )
p.append(",\n".join(prows))
p.append("ON CONFLICT (code) DO UPDATE SET")
p.append("  name    = EXCLUDED.name,")
p.append("  country = EXCLUDED.country,")
p.append("  lat     = EXCLUDED.lat,")
p.append("  lng     = EXCLUDED.lng,")
p.append("  aliases = EXCLUDED.aliases;")
p.append("")
p.append(f"-- Verify: expect {len(PLACES)}")
p.append("SELECT count(*) AS places FROM places;")
p.append("")

places_sql = "\n".join(p)

open(sys.argv[1], "w", encoding="utf-8").write(grant_sql)
open(sys.argv[2], "w", encoding="utf-8").write(places_sql)
print(f"countries={len(ALL)} profiles={len(STANDARD_PROFILES)} places={len(PLACES)}")
