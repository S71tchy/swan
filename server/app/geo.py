"""Geometry helpers for custom zones.

Deliberately dependency-free and PostGIS-free. Zones are stored as GeoJSON in a
JSON column, exactly as `locations` already is, which keeps the Phase 2 PostGIS
migration a migration rather than a rewrite — and means these few functions are
all the geometry the server needs.

What is *not* here is any point-in-polygon or intersection test, and that is a
design decision rather than an omission: a zone's country list is **declared** by
whoever creates it, not derived from its shape. Rights are a statement about
authority, and deriving them from geometry would mean dragging a vertex silently
changes who may approve an alert. The drawing UI suggests countries from the map;
a human confirms them.
"""
from __future__ import annotations

from math import asin, atan2, cos, degrees, pi, radians, sin

EARTH_RADIUS_M = 6371008.8  # IUGG mean radius

MIN_RADIUS_M = 100.0
MAX_RADIUS_M = 2_000_000.0  # 2000 km — larger than any strait, smaller than a hemisphere
MAX_VERTICES = 500


class GeometryError(ValueError):
    """Bad geometry, with a message meant to be shown to the person drawing."""


def _wrap_lng(lng: float) -> float:
    """Normalise to [-180, 180]. A circle drawn near the dateline otherwise
    produces longitudes like 182, which renderers place on the wrong side."""
    return ((lng + 180.0) % 360.0) - 180.0


def circle_polygon(lat: float, lng: float, radius_m: float, steps: int = 72) -> dict:
    """A GeoJSON Polygon approximating a circle of `radius_m` around a point.

    Uses the great-circle destination formula rather than a flat
    degrees-per-metre approximation, so the shape stays a circle *on the map* at
    high latitudes instead of turning into an ellipse. 72 steps puts the vertex
    error well under a pixel at the zooms this app draws at.

    A radius zone stores its centre and radius as the source of truth and this
    polygon as derived output — regenerated on every save, never hand-edited, so
    the zone stays editable as a radius instead of collapsing into a polygon the
    first time someone saves it.
    """
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise GeometryError("Centre is outside valid coordinates")
    if not (MIN_RADIUS_M <= radius_m <= MAX_RADIUS_M):
        raise GeometryError(
            f"Radius must be between {MIN_RADIUS_M:.0f} m and {MAX_RADIUS_M / 1000:.0f} km"
        )

    lat_r, lng_r = radians(lat), radians(lng)
    d = radius_m / EARTH_RADIUS_M
    ring: list[list[float]] = []
    for i in range(steps + 1):  # +1 closes the ring
        brng = 2 * pi * i / steps
        lat2 = asin(sin(lat_r) * cos(d) + cos(lat_r) * sin(d) * cos(brng))
        lng2 = lng_r + atan2(
            sin(brng) * sin(d) * cos(lat_r), cos(d) - sin(lat_r) * sin(lat2)
        )
        ring.append([round(_wrap_lng(degrees(lng2)), 6), round(degrees(lat2), 6)])
    ring[-1] = list(ring[0])  # exact closure, not merely a near-repeat
    return {"type": "Polygon", "coordinates": [ring]}


def validate_polygon(geometry: dict | None) -> dict:
    """Check a GeoJSON Polygon and return it normalised (closed ring, wrapped
    longitudes). Only the outer ring is kept: SWAN zones are areas of concern,
    not cadastral parcels, and a hole would have no meaning for the rights or
    rendering questions the geometry is asked."""
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise GeometryError("Geometry must be a GeoJSON Polygon")
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or not coords:
        raise GeometryError("Polygon has no coordinates")
    ring = coords[0]
    if not isinstance(ring, list) or len(ring) < 3:
        raise GeometryError("A zone needs at least three points")
    if len(ring) > MAX_VERTICES:
        raise GeometryError(f"A zone may have at most {MAX_VERTICES} points")

    clean: list[list[float]] = []
    for pos in ring:
        if not isinstance(pos, (list, tuple)) or len(pos) < 2:
            raise GeometryError("Each point must be a [longitude, latitude] pair")
        lng, lat = float(pos[0]), float(pos[1])
        if not (-90 <= lat <= 90):
            raise GeometryError(f"Latitude {lat} is outside -90..90")
        clean.append([round(_wrap_lng(lng), 6), round(lat, 6)])

    if clean[0] != clean[-1]:
        clean.append(list(clean[0]))
    if len(clean) < 4:  # 3 distinct points + closure
        raise GeometryError("A zone needs at least three distinct points")
    return {"type": "Polygon", "coordinates": [clean]}


def polygon_centroid(geometry: dict) -> tuple[float, float]:
    """(lat, lng) representative point for a polygon.

    A zone needs coordinates for the same reason a nationwide block does:
    clustering, `flyTo` and `MapSearch` all assume every location block has a
    lat/lng, and a block without one simply disappears from the map rather than
    failing loudly.

    Area-weighted (shoelace) centroid, falling back to the bounding-box centre
    for degenerate rings — a zero-area sliver would otherwise divide by zero.
    """
    ring = geometry["coordinates"][0]
    area2 = 0.0
    cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area2) < 1e-12:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (round((min(ys) + max(ys)) / 2, 6), round((min(xs) + max(xs)) / 2, 6))
    factor = 1 / (3 * area2)
    return (round(cy * factor, 6), round(cx * factor, 6))


def bbox(geometry: dict) -> list[float]:
    """[west, south, east, north] — what the map needs to frame a zone."""
    ring = geometry["coordinates"][0]
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return [min(xs), min(ys), max(xs), max(ys)]
