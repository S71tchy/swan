"""Static reference data: country catalogue, standard profiles, and a small
gazetteer of African ports/cities used both by the create-form location search
(a stub for the Phase 2 geocoder) and by the seed data."""
from __future__ import annotations

# ISO2 -> display name + flag emoji (placeholder glyphs per the mock).
COUNTRY_CATALOGUE: dict[str, dict] = {
    "MZ": {"name": "Mozambique", "flag": "🇲🇿"},
    "CI": {"name": "Côte d'Ivoire", "flag": "🇨🇮"},
    "CD": {"name": "DRC", "flag": "🇨🇩"},
    "ZA": {"name": "South Africa", "flag": "🇿🇦"},
    "KE": {"name": "Kenya", "flag": "🇰🇪"},
    "EG": {"name": "Egypt", "flag": "🇪🇬"},
    "NG": {"name": "Nigeria", "flag": "🇳🇬"},
    "GH": {"name": "Ghana", "flag": "🇬🇭"},
    "ZM": {"name": "Zambia", "flag": "🇿🇲"},
    "TZ": {"name": "Tanzania", "flag": "🇹🇿"},
    "SN": {"name": "Senegal", "flag": "🇸🇳"},
    "CM": {"name": "Cameroon", "flag": "🇨🇲"},
}

# Standard rights profiles (spec §4.2). name -> country list (+ manager flag).
STANDARD_PROFILES: dict[str, dict] = {
    "WORLD": {
        "countries": list(COUNTRY_CATALOGUE.keys()),
        "embeds_rights_manager": True,
    },
    "WEST-AFRICA": {
        "countries": ["CI", "NG", "GH", "SN", "CM"],
        "embeds_rights_manager": False,
    },
    "SOUTHERN-AFRICA": {
        "countries": ["ZA", "MZ", "ZM"],
        "embeds_rights_manager": False,
    },
    "EAST-AFRICA": {
        "countries": ["KE", "TZ"],
        "embeds_rights_manager": False,
    },
}

# Illustrative neighbours per home country, used to populate the profile-screen
# "Submit for approval" rows for locations the user cannot publish.
REGION_NEIGHBOURS: dict[str, list[str]] = {
    "CI": ["NG", "GH"],
    "MZ": ["ZA", "ZM"],
    "ZA": ["MZ", "KE"],
    "KE": ["TZ", "ZA"],
    "NG": ["CI", "GH"],
}

# Gazetteer: geocoded places for the create-form location picker + seed markers.
# (name, LOCODE-ish code, ISO2 country, lat, lng)
PLACES: list[dict] = [
    {"name": "Beira", "code": "MZBEW", "country": "MZ", "lat": -19.83, "lng": 34.84},
    {"name": "Maputo", "code": "MZMPM", "country": "MZ", "lat": -25.97, "lng": 32.57},
    {"name": "Abidjan", "code": "CIABJ", "country": "CI", "lat": 5.32, "lng": -4.02},
    {"name": "Lagos — Apapa", "code": "NGAPP", "country": "NG", "lat": 6.45, "lng": 3.36},
    {"name": "Tin Can Island", "code": "NGTIN", "country": "NG", "lat": 6.44, "lng": 3.34},
    {"name": "Tema", "code": "GHTEM", "country": "GH", "lat": 5.67, "lng": 0.02},
    {"name": "Durban", "code": "ZADUR", "country": "ZA", "lat": -29.87, "lng": 31.03},
    {"name": "Mombasa", "code": "KEMBA", "country": "KE", "lat": -4.04, "lng": 39.67},
    {"name": "Dar es Salaam", "code": "TZDAR", "country": "TZ", "lat": -6.82, "lng": 39.28},
    {"name": "Suez Canal", "code": "EGSUZ", "country": "EG", "lat": 30.03, "lng": 32.55},
    {"name": "Kasumbalesa border", "code": "CDKAS", "country": "CD", "lat": -12.25, "lng": 27.80},
    {"name": "Dakar", "code": "SNDKR", "country": "SN", "lat": 14.68, "lng": -17.42},
    {"name": "Douala", "code": "CMDLA", "country": "CM", "lat": 4.05, "lng": 9.70},
]


def place_label(place: dict) -> str:
    cat = COUNTRY_CATALOGUE.get(place["country"], {})
    return f"{place['name']} ({place['code']})"


def country_meta(code: str) -> dict:
    return COUNTRY_CATALOGUE.get(code.upper(), {"name": code, "flag": ""})
