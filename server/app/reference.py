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
    "AO": {"name": "Angola", "flag": "🇦🇴"},
    "NA": {"name": "Namibia", "flag": "🇳🇦"},
    "TG": {"name": "Togo", "flag": "🇹🇬"},
    "BJ": {"name": "Benin", "flag": "🇧🇯"},
    "MA": {"name": "Morocco", "flag": "🇲🇦"},
    "DJ": {"name": "Djibouti", "flag": "🇩🇯"},
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
# Seeds the `places` master table; a Rights Manager can extend it at runtime.
# (name, LOCODE-ish code, ISO2 country, lat, lng, [aliases])
PLACES: list[dict] = [
    {"name": "Beira", "code": "MZBEW", "country": "MZ", "lat": -19.83, "lng": 34.84},
    {"name": "Maputo", "code": "MZMPM", "country": "MZ", "lat": -25.97, "lng": 32.57},
    {"name": "Nacala", "code": "MZMNC", "country": "MZ", "lat": -14.54, "lng": 40.67},
    {"name": "Abidjan", "code": "CIABJ", "country": "CI", "lat": 5.32, "lng": -4.02},
    {"name": "San-Pédro", "code": "CISPY", "country": "CI", "lat": 4.75, "lng": -6.64, "aliases": ["san pedro"]},
    {"name": "Lagos — Apapa", "code": "NGAPP", "country": "NG", "lat": 6.45, "lng": 3.36, "aliases": ["apapa"]},
    {"name": "Tin Can Island", "code": "NGTIN", "country": "NG", "lat": 6.44, "lng": 3.34},
    {"name": "Onne", "code": "NGONN", "country": "NG", "lat": 4.70, "lng": 7.15},
    {"name": "Tema", "code": "GHTEM", "country": "GH", "lat": 5.67, "lng": 0.02},
    {"name": "Takoradi", "code": "GHTKD", "country": "GH", "lat": 4.88, "lng": -1.75},
    {"name": "Durban", "code": "ZADUR", "country": "ZA", "lat": -29.87, "lng": 31.03},
    {"name": "Cape Town", "code": "ZACPT", "country": "ZA", "lat": -33.90, "lng": 18.43},
    {"name": "Port Elizabeth", "code": "ZAPLZ", "country": "ZA", "lat": -33.96, "lng": 25.63, "aliases": ["gqeberha"]},
    {"name": "Mombasa", "code": "KEMBA", "country": "KE", "lat": -4.04, "lng": 39.67},
    {"name": "Nairobi ICD", "code": "KENBO", "country": "KE", "lat": -1.32, "lng": 36.85, "aliases": ["nairobi"]},
    {"name": "Dar es Salaam", "code": "TZDAR", "country": "TZ", "lat": -6.82, "lng": 39.28},
    {"name": "Suez Canal", "code": "EGSUZ", "country": "EG", "lat": 30.03, "lng": 32.55, "aliases": ["suez"]},
    {"name": "Alexandria", "code": "EGALY", "country": "EG", "lat": 31.20, "lng": 29.92},
    {"name": "Kasumbalesa border", "code": "CDKAS", "country": "CD", "lat": -12.25, "lng": 27.80, "aliases": ["kasumbalesa"]},
    {"name": "Matadi", "code": "CDMAT", "country": "CD", "lat": -5.82, "lng": 13.46},
    {"name": "Dakar", "code": "SNDKR", "country": "SN", "lat": 14.68, "lng": -17.42},
    {"name": "Douala", "code": "CMDLA", "country": "CM", "lat": 4.05, "lng": 9.70},
    {"name": "Luanda", "code": "AOLAD", "country": "AO", "lat": -8.78, "lng": 13.24},
    {"name": "Lobito", "code": "AOLOB", "country": "AO", "lat": -12.35, "lng": 13.55},
    {"name": "Walvis Bay", "code": "NAWVB", "country": "NA", "lat": -22.96, "lng": 14.51},
    {"name": "Lomé", "code": "TGLFW", "country": "TG", "lat": 6.13, "lng": 1.29, "aliases": ["lome"]},
    {"name": "Cotonou", "code": "BJCOO", "country": "BJ", "lat": 6.35, "lng": 2.42},
    {"name": "Tanger Med", "code": "MAPTM", "country": "MA", "lat": 35.88, "lng": -5.52, "aliases": ["tangier", "tanger"]},
    {"name": "Casablanca", "code": "MACAS", "country": "MA", "lat": 33.60, "lng": -7.62},
    {"name": "Port of Djibouti", "code": "DJJIB", "country": "DJ", "lat": 11.60, "lng": 43.14, "aliases": ["djibouti"]},
]


def place_label(place: dict) -> str:
    cat = COUNTRY_CATALOGUE.get(place["country"], {})
    return f"{place['name']} ({place['code']})"


def country_meta(code: str) -> dict:
    return COUNTRY_CATALOGUE.get(code.upper(), {"name": code, "flag": ""})
