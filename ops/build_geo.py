"""Rebuild SWAN's world geography from Natural Earth.

The map's detail overlay, the country catalogue the rights model validates
against, and the ISO3/centroid tables the nationwide highlight needs are all
*the same geography seen three ways*. Deriving them in one pass from one source
is the only way they can't drift: a country present in the picker but missing
from the ISO3 table paints no polygon and fails silently (see
`warnOnUnmatchedCountries` in web/src/lib/mapOverlay.ts).

Run from the repo root:

    python ops/build_geo.py [--flags] [--cache DIR]

Writes (all overwritten wholesale — they are generated, never hand-edited):

  web/public/geo/world_provinces.geojson   admin-1 boundaries + labels
  web/public/geo/world_cities.geojson      populated places (dots + labels)
  server/app/country_data.py               ISO2 -> display name
  web/src/lib/countryData.ts               ISO2 -> ISO3, ISO2 -> [lng, lat]

With --flags it also downloads any missing circular country flags into
web/public/flags/. That's a separate switch because it's ~200 small HTTP
requests and the UI degrades gracefully without them (CountryFlag falls back to
a neutral disc showing the code).

Source: Natural Earth 10m, public domain, via the nvkelso/natural-earth-vector
mirror. Downloads are cached in --cache (default: a temp dir) so re-runs are
free.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict

NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
ADMIN0 = "ne_10m_admin_0_countries.geojson"
ADMIN1 = "ne_10m_admin_1_states_provinces.geojson"
PLACES = "ne_10m_populated_places.geojson"

FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags/"

# Douglas-Peucker tolerance in degrees for the province boundaries.
#
# The unsimplified 10m admin-1 set is 1.30M vertices / ~22 MB, which is not
# something to parse on the main thread at map load. At 0.01 deg (~1.1 km) it
# drops to 0.38M / ~6.6 MB (~1.9 MB over the wire gzipped) — roughly twice the
# Africa-only file it replaces, for five times the features.
#
# Why this value and not lower: the dashboard tops out around z8, where 1.1 km
# is under two pixels. Why not higher: simplification is per-ring, so a shared
# border between two provinces is simplified twice, independently, and can
# diverge by up to the tolerance in each direction. At 0.01 that stays sub-pixel
# for most of the zoom range on a 0.4-0.62 opacity hairline; at 0.04 it starts
# showing as doubled borders when zoomed in.
PROVINCE_TOLERANCE = 0.01
COORD_PRECISION = 3  # ~110 m; matches the file this replaces

# Natural Earth carries these as populated places, but they are research bases
# with no bearing on supply chains and they clutter the poles.
SKIP_FEATURECLA = {"Scientific station", "Meteorological Station", "Historic place"}

# Antarctica has an ISO code and a polygon and no logistics. Everything else
# with an ISO 3166-1 alpha-2 code is kept, dependencies included: Hong Kong,
# Puerto Rico and Réunion are real places to raise an alert about.
SKIP_COUNTRIES = {"AQ"}

# When Natural Earth files more than one polygon under one ISO2 (Clipperton
# under FR, Baikonur under KZ, the Coral Sea Islands under AU), the sovereign
# entry is the one we want for the name, the ISO3 and the label point.
TYPE_RANK = {
    "Sovereign country": 0,
    "Country": 1,
    "Sovereignty": 2,
    "Disputed": 3,
    "Indeterminate": 4,
    "Dependency": 5,
    "Lease": 6,
}

# Display names we keep as they already were, against Natural Earth's NAME_EN.
# Changing an existing country's name silently rewrites what every historical
# alert appears to say, so the 54 African names this project shipped with win.
NAME_OVERRIDES = {
    "CD": "DR Congo",
    "CG": "Congo (Rep.)",
    "CI": "Côte d'Ivoire",
    "CV": "Cabo Verde",
    "GM": "Gambia",
    "ST": "São Tomé and Príncipe",
    "SZ": "Eswatini",
    "TZ": "Tanzania",
    # Outside Africa, a few NAME_EN values are the long-form constitutional name
    # where the short one is what anyone would look for in a picker.
    "GB": "United Kingdom",
    "US": "United States",
    "AE": "United Arab Emirates",
    "KR": "South Korea",
    "KP": "North Korea",
    "RU": "Russia",
    "IR": "Iran",
    "SY": "Syria",
    "LA": "Laos",
    "VN": "Vietnam",
    "BO": "Bolivia",
    "VE": "Venezuela",
}


# --------------------------------------------------------------------------- #
# Fetching
# --------------------------------------------------------------------------- #
def fetch(cache: str, name: str) -> dict:
    path = os.path.join(cache, name)
    if not os.path.exists(path) or os.path.getsize(path) < 1000:
        os.makedirs(cache, exist_ok=True)
        print(f"  downloading {name} ...", flush=True)
        urllib.request.urlretrieve(NE_BASE + name, path)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #
def simplify(points: list, tolerance: float) -> list:
    """Douglas-Peucker, iterative.

    Iterative rather than recursive on purpose: some coastline rings run to tens
    of thousands of vertices and the recursive form blows Python's stack.
    """
    n = len(points)
    if n < 3:
        return points
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    tol2 = tolerance * tolerance
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        span = dx * dx + dy * dy
        worst = -1.0
        worst_i = -1
        for k in range(i + 1, j):
            px, py = points[k]
            if span == 0:
                ex, ey = px - ax, py - ay
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / span
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                ex = px - (ax + t * dx)
                ey = py - (ay + t * dy)
            d = ex * ex + ey * ey
            if d > worst:
                worst, worst_i = d, k
        if worst > tol2:
            keep[worst_i] = True
            stack.append((i, worst_i))
            stack.append((worst_i, j))
    return [points[k] for k in range(n) if keep[k]]


def round_ring(ring: list) -> list:
    return [[round(x, COORD_PRECISION), round(y, COORD_PRECISION)] for x, y in ring]


def simplify_geometry(geom: dict, tolerance: float) -> dict | None:
    """Simplify a (Multi)Polygon, never dropping a feature entirely.

    A ring that collapses below the four points a closed ring needs is kept at
    full detail instead of being discarded — those are small islands, so they
    cost almost nothing, and silently losing Malta or Singapore from the overlay
    is a worse trade than a few hundred extra vertices.
    """
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    out = []
    for poly in polys:
        rings = []
        for index, ring in enumerate(poly):
            simple = simplify(ring, tolerance)
            if len(simple) < 4:
                simple = ring  # too small to simplify — keep it verbatim
            if simple[0] != simple[-1]:
                simple = simple + [simple[0]]
            if len(simple) < 4:
                if index == 0:
                    rings = None
                    break
                continue
            rings.append(round_ring(simple))
        if rings:
            out.append(rings)
    if not out:
        return None
    if len(out) == 1:
        return {"type": "Polygon", "coordinates": out[0]}
    return {"type": "MultiPolygon", "coordinates": out}


def count_vertices(geom: dict) -> int:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return sum(len(ring) for poly in polys for ring in poly)


# --------------------------------------------------------------------------- #
# Countries
# --------------------------------------------------------------------------- #
def iso2_of(props: dict) -> str | None:
    """ISO 3166-1 alpha-2, preferring the _EH ('de facto') variant.

    Natural Earth stores -99 in ISO_A2 for a handful of countries whose codes
    are politically contested in its main field; ISO_A2_EH carries the code
    anyone actually uses. Without this, France and Norway drop out entirely.
    """
    for key in ("ISO_A2_EH", "ISO_A2"):
        value = props.get(key)
        if value and value not in ("-99", "-1"):
            return value.upper()
    return None


def build_countries(admin0: dict) -> dict[str, dict]:
    """ISO2 -> {name, iso3, centroid} for every country we recognise."""
    grouped: dict[str, list] = defaultdict(list)
    for feature in admin0["features"]:
        code = iso2_of(feature["properties"])
        if code and code not in SKIP_COUNTRIES:
            grouped[code].append(feature)

    countries: dict[str, dict] = {}
    for code, features in grouped.items():
        features.sort(key=lambda f: TYPE_RANK.get(f["properties"].get("TYPE"), 9))
        props = features[0]["properties"]
        name = NAME_OVERRIDES.get(code) or props.get("NAME_EN") or props.get("NAME") or code
        # LABEL_X/LABEL_Y are Natural Earth's own cartographic label anchors —
        # points chosen to sit *inside* the landmass. That is exactly what a
        # nationwide marker needs, and why these are not computed from the
        # `places` gazetteer, which is ports and would land inland countries at
        # sea (see the note in web/src/lib/countries.ts).
        lng, lat = props.get("LABEL_X"), props.get("LABEL_Y")
        if lng is None or lat is None:
            lng, lat = fallback_centroid(features[0]["geometry"])
        countries[code] = {
            "name": name,
            "iso3": props.get("ADM0_A3") or code,
            "centroid": [round(float(lng), 2), round(float(lat), 2)],
        }
    return dict(sorted(countries.items(), key=lambda kv: kv[1]["name"]))


def fallback_centroid(geom: dict) -> tuple[float, float]:
    """Centre of the largest ring's bounding box. Only used if LABEL_X is absent."""
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    best, best_ring = -1.0, None
    for poly in polys:
        ring = poly[0]
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        area = (max(xs) - min(xs)) * (max(ys) - min(ys))
        if area > best:
            best, best_ring = area, ring
    xs = [p[0] for p in best_ring]
    ys = [p[1] for p in best_ring]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


# --------------------------------------------------------------------------- #
# Writers
# --------------------------------------------------------------------------- #
BANNER_PY = '"""Generated by ops/build_geo.py from Natural Earth 10m — do not edit by hand.\n\nRe-run `python ops/build_geo.py` to refresh. Kept in its own module so\napp/reference.py stays readable prose about the rights model rather than {n}\nlines of country names.\n"""\n'

BANNER_TS = """/* Generated by ops/build_geo.py from Natural Earth 10m — do not edit by hand.
 *
 * Re-run `python ops/build_geo.py` to refresh. Consumed through lib/countries.ts,
 * which documents what each table is for; this file is only the data.
 */
"""


def write_country_py(path: str, countries: dict[str, dict]) -> None:
    lines = [BANNER_PY.replace("{n}", str(len(countries))), "from __future__ import annotations", "", ""]
    lines.append("COUNTRY_NAMES: dict[str, str] = {")
    for code, meta in countries.items():
        name = meta["name"].replace('"', '\\"')
        lines.append(f'    "{code}": "{name}",')
    lines.append("}")
    lines.append("")
    _write(path, "\n".join(lines))


def write_country_ts(path: str, countries: dict[str, dict]) -> None:
    lines = [BANNER_TS, "export const ISO3: Record<string, string> = {"]
    for code, meta in countries.items():
        lines.append(f"  {code}: '{meta['iso3']}',")
    lines.append("}")
    lines.append("")
    lines.append("export const CENTROID: Record<string, [number, number]> = {")
    for code, meta in countries.items():
        lng, lat = meta["centroid"]
        lines.append(f"  {code}: [{lng}, {lat}],")
    lines.append("}")
    lines.append("")
    _write(path, "\n".join(lines))


def write_geojson(path: str, features: list) -> int:
    payload = {"type": "FeatureCollection", "features": features}
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    _write(path, text)
    return len(text.encode("utf-8"))


def _write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


# --------------------------------------------------------------------------- #
# Flags
# --------------------------------------------------------------------------- #
def sync_flags(directory: str, codes: list[str]) -> tuple[int, list[str]]:
    os.makedirs(directory, exist_ok=True)
    added, missing = 0, []
    for code in codes:
        target = os.path.join(directory, f"{code.lower()}.svg")
        if os.path.exists(target):
            continue
        try:
            with urllib.request.urlopen(FLAG_BASE + f"{code.lower()}.svg", timeout=30) as response:
                data = response.read()
        except Exception:
            missing.append(code)
            continue
        with open(target, "wb") as fh:
            fh.write(data)
        added += 1
    return added, missing


# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "swan-ne"))
    parser.add_argument("--flags", action="store_true", help="download missing country flags")
    parser.add_argument("--root", default=os.getcwd(), help="repo root (default: cwd)")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(os.path.join(root, "web", "public")):
        print(f"error: {root} does not look like the repo root (no web/public)", file=sys.stderr)
        return 2

    print("Natural Earth source:")
    admin0 = fetch(args.cache, ADMIN0)
    admin1 = fetch(args.cache, ADMIN1)
    places = fetch(args.cache, PLACES)

    # ---- countries -------------------------------------------------------- #
    countries = build_countries(admin0)
    write_country_py(os.path.join(root, "server", "app", "country_data.py"), countries)
    write_country_ts(os.path.join(root, "web", "src", "lib", "countryData.ts"), countries)
    print(f"countries: {len(countries)}")

    # ---- provinces -------------------------------------------------------- #
    province_features = []
    raw_vertices = kept_vertices = 0
    for feature in admin1["features"]:
        props = feature["properties"]
        code = (props.get("iso_a2") or "").upper()
        if code in SKIP_COUNTRIES:
            continue
        raw_vertices += count_vertices(feature["geometry"])
        geom = simplify_geometry(feature["geometry"], PROVINCE_TOLERANCE)
        if geom is None:
            continue
        kept_vertices += count_vertices(geom)
        province_features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": props.get("name") or props.get("name_en") or "",
                    "country": countries.get(code, {}).get("name") or props.get("admin") or "",
                    "iso": code,
                },
                "geometry": geom,
            }
        )
    size = write_geojson(
        os.path.join(root, "web", "public", "geo", "world_provinces.geojson"), province_features
    )
    print(
        f"provinces: {len(province_features)} features, "
        f"{raw_vertices:,} -> {kept_vertices:,} vertices, {size / 1e6:.2f} MB"
    )

    # ---- cities ----------------------------------------------------------- #
    by_iso3 = {meta["iso3"]: code for code, meta in countries.items()}
    city_features = []
    for feature in places["features"]:
        props = feature["properties"]
        if props.get("FEATURECLA") in SKIP_FEATURECLA:
            continue
        code = iso2_of(props) or by_iso3.get(props.get("ADM0_A3") or "")
        if code in SKIP_COUNTRIES:
            continue
        lng, lat = feature["geometry"]["coordinates"][:2]
        city_features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": props.get("NAME") or "",
                    "country": (countries.get(code or "", {}) or {}).get("name")
                    or props.get("ADM0NAME")
                    or "",
                    "iso": code or "",
                    "rank": props.get("SCALERANK"),
                    "pop": props.get("POP_MAX"),
                    "cap": 1 if str(props.get("FEATURECLA", "")).startswith("Admin-0 capital") else 0,
                },
                "geometry": {"type": "Point", "coordinates": [round(lng, 4), round(lat, 4)]},
            }
        )
    size = write_geojson(
        os.path.join(root, "web", "public", "geo", "world_cities.geojson"), city_features
    )
    print(f"cities: {len(city_features)} features, {size / 1e6:.2f} MB")

    # ---- flags ------------------------------------------------------------ #
    if args.flags:
        added, missing = sync_flags(
            os.path.join(root, "web", "public", "flags"), list(countries.keys())
        )
        print(f"flags: +{added} downloaded, {len(missing)} unavailable")
        if missing:
            print("  no flag published for: " + ", ".join(sorted(missing)))
            print("  (CountryFlag falls back to a code disc, so this is cosmetic)")
    else:
        print("flags: skipped (pass --flags to sync)")

    print("\nNext: python ops/generate.py ops/grant_admin_rights.sql ops/seed_places.sql")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
