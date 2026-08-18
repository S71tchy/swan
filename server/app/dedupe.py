"""Duplicate detection for the two things operators create by hand: gazetteer
places and custom zones.

Deliberately **not** a uniqueness constraint on name. Real gazetteers are full of
honest collisions — Santiago is in Chile, Cuba, the Dominican Republic, Spain and
Cape Verde; Victoria is in Seychelles, Canada and Hong Kong; Tripoli is Libya and
Lebanon — so a unique index on name would refuse real data. Worse, it would give
the *feeling* of a duplicate check while the duplicates that actually happen walk
straight through it: nobody types "Strait of Hormuz" twice, they type "Hormuz
Strait", or re-add "Lagos — Apapa" as "Lagos Port".

So this matches on several weak signals instead, and the result is advice: the
routers refuse once and accept the same request with `confirm_duplicate`, which
means an operator can always record a genuine collision but never create one by
accident, and the API cannot quietly accumulate duplicates either.

Why it matters beyond tidiness: marker clustering keys on `location.code`, so a
duplicated place puts two markers on one port and splits its alerts between them.
Search and the analytics breakdowns fragment the same way. A duplicate quietly
halves the picture rather than looking wrong.

The point-in-polygon test at the bottom is used *only* here. It is not a way to
derive a zone's countries — those stay declared (see models.Zone); this is one
shape against another, not geography against rights.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6371008.8

# Places within this distance, in the same country, are almost certainly the
# same port however they are spelled — the signal a name check cannot see.
PLACE_PROXIMITY_M = 3000.0

# Token overlap above which two names are "the same thing, said differently".
NAME_SIMILARITY = 0.5

# Only connectives are dropped. Geographic nouns stay: dropping "strait" would
# make "Strait of Gibraltar" and "Gibraltar" identical, which is a judgement for
# the operator to make, not one to bake in.
_STOPWORDS = {"of", "the", "de", "la", "le", "du", "des", "el", "and", "at", "in", "on"}

_WORD_RE = re.compile(r"[a-z0-9]+")


@dataclass
class Match:
    code: str
    name: str
    reason: str          # human-readable, shown verbatim in the editor
    distance_m: float | None = None


def fold(value: str) -> str:
    """Lower-case, strip diacritics, drop punctuation.

    Same folding idea as `lib/alertSearch.ts` and `CountrySelect` use on the
    client, and for the same reason: "Côte" and "Cote" are one word to anyone
    typing quickly.
    """
    decomposed = unicodedata.normalize("NFKD", value or "")
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return stripped.lower()


def tokens(value: str) -> set[str]:
    return {w for w in _WORD_RE.findall(fold(value)) if w not in _STOPWORDS}


def name_similarity(a: str, b: str) -> float:
    """Jaccard overlap of the significant words, with containment promoted.

    Word-set rather than character-distance so word order stops mattering:
    "Strait of Hormuz" and "Hormuz Strait" are the same two words either way,
    while an edit-distance would rate them far apart.
    """
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    if ta == tb:
        return 1.0
    # One name fully containing the other ("Hormuz" inside "Strait of Hormuz")
    # is a strong signal that Jaccard alone dilutes when the longer name has
    # several extra words.
    if ta <= tb or tb <= ta:
        return max(0.75, len(ta & tb) / len(ta | tb))
    return len(ta & tb) / len(ta | tb)


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres (haversine)."""
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lng2 - lng1)
    h = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


# --------------------------------------------------------------------------- #
# Places
# --------------------------------------------------------------------------- #
def find_place_duplicates(existing, name: str, country: str, lat, lng, exclude_code=None) -> list[Match]:
    """Places that look like the one about to be created.

    Scoped to the same country on purpose: that is what lets Santiago (CL) and
    Santiago (CU) coexist while still catching the same port entered twice.
    """
    out: list[Match] = []
    cc = (country or "").upper()
    for p in existing:
        if exclude_code and p.code == exclude_code:
            continue
        if (p.country or "").upper() != cc:
            continue

        dist = None
        if lat is not None and lng is not None and p.lat is not None and p.lng is not None:
            dist = distance_m(float(lat), float(lng), p.lat, p.lng)

        sim = name_similarity(name, p.name)
        if sim >= NAME_SIMILARITY:
            reason = (
                f"Same name as {p.code}"
                if sim >= 0.99
                else f"Name is very close to {p.code} ({p.name})"
            )
            out.append(Match(code=p.code, name=p.name, reason=reason, distance_m=dist))
        elif dist is not None and dist <= PLACE_PROXIMITY_M:
            out.append(
                Match(
                    code=p.code,
                    name=p.name,
                    reason=f"{p.name} is {dist / 1000:.1f} km away — likely the same place",
                    distance_m=dist,
                )
            )
    out.sort(key=lambda m: (m.distance_m if m.distance_m is not None else 1e12))
    return out


# --------------------------------------------------------------------------- #
# Zones
# --------------------------------------------------------------------------- #
def _ring(geometry) -> list[list[float]]:
    try:
        return geometry["coordinates"][0]
    except (TypeError, KeyError, IndexError):
        return []


def point_in_ring(lng: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray casting. Used only to spot a zone drawn on top of another one."""
    inside = False
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y0 > lat) != (y1 > lat):
            x_at = x0 + (lat - y0) * (x1 - x0) / ((y1 - y0) or 1e-12)
            if x_at > lng:
                inside = not inside
    return inside


def approx_radius_m(geometry, radius_m=None) -> float:
    """A single number for "how big is this zone", for comparing two of them.

    Half the bounding-box diagonal. Crude, and deliberately so: it only has to
    separate "a 60 km strait" from "a 600 km sea area" well enough to decide
    whether two shapes are plausibly the same thing.
    """
    if radius_m:
        return float(radius_m)
    ring = _ring(geometry)
    if len(ring) < 3:
        return 0.0
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return distance_m(min(ys), min(xs), max(ys), max(xs)) / 2


def find_zone_duplicates(existing, name: str, geometry, lat, lng, radius_m=None, exclude_code=None) -> list[Match]:
    """Zones that look like the one about to be created.

    Not scoped by country — a zone may declare none at all, and two people
    drawing the same strait will not necessarily declare the same perimeter.
    Geometry is the reliable signal here.
    """
    out: list[Match] = []
    mine_r = approx_radius_m(geometry, radius_m)
    for z in existing:
        if exclude_code and z.code == exclude_code:
            continue

        sim = name_similarity(name, z.name)
        if sim >= NAME_SIMILARITY:
            out.append(
                Match(
                    code=z.code,
                    name=z.name,
                    reason=(
                        f"Same name as {z.code}"
                        if sim >= 0.99
                        else f"Name is very close to {z.code} ({z.name})"
                    ),
                )
            )
            continue

        if lat is None or lng is None or z.lat is None or z.lng is None:
            continue
        gap = distance_m(float(lat), float(lng), z.lat, z.lng)
        theirs_r = approx_radius_m(z.geometry, z.radius_m)

        # Drawn on top of an existing zone: the centre of one sits inside the
        # other. The clearest "same strait, different vertices" signal there is.
        ring = _ring(z.geometry)
        if ring and point_in_ring(float(lng), float(lat), ring):
            out.append(
                Match(code=z.code, name=z.name, reason=f"Centre falls inside {z.name}", distance_m=gap)
            )
            continue

        # Otherwise: near-coincident centres AND comparable size. Size matters —
        # a 5 km anchorage inside a 500 km sea area is a legitimate second zone,
        # not a duplicate of it.
        bigger = max(mine_r, theirs_r)
        if bigger <= 0:
            continue
        ratio = min(mine_r, theirs_r) / bigger if bigger else 0
        if gap <= max(2000.0, bigger * 0.25) and ratio >= 0.5:
            out.append(
                Match(
                    code=z.code,
                    name=z.name,
                    reason=f"Nearly the same area as {z.name} ({gap / 1000:.1f} km apart, similar size)",
                    distance_m=gap,
                )
            )
    out.sort(key=lambda m: (m.distance_m if m.distance_m is not None else 1e12))
    return out
