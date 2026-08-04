"""Static reference data: country catalogue, standard profiles, and a small
gazetteer of ports/cities used both by the create-form location search (a stub
for the Phase 2 geocoder) and by the seed data."""
from __future__ import annotations

from app.country_data import COUNTRY_NAMES as _COUNTRY_NAMES


def _flag_emoji(code: str) -> str:
    """Regional-indicator flag emoji for an ISO2 code (fallback glyph; the UI now
    renders circular SVG flags from /flags/{code}.svg)."""
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code.upper())


# The catalogue is generated into app/country_data.py by ops/build_geo.py, from
# the same Natural Earth release that builds the map's province/city overlay and
# the ISO3 table in web/src/lib/countryData.ts. Keeping all three on one source
# is what stops a country being offered here that the map cannot draw.
#
# 238 entries: every ISO 3166-1 alpha-2 country and territory except Antarctica.
# Dependencies are in (Hong Kong, Puerto Rico, Réunion) — they are real places to
# raise an alert about. The flag emoji is derived from the code; the web app
# renders bundled circular SVG flags keyed by the code.

# ISO2 -> {name, flag}. Sorted by display name for a tidy country picker.
COUNTRY_CATALOGUE: dict[str, dict] = {
    code: {"name": name, "flag": _flag_emoji(code)}
    for code, name in sorted(_COUNTRY_NAMES.items(), key=lambda kv: kv[1])
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

# Gazetteer: geocoded places for the create-form location picker + seed markers.
# Seeds the `places` master table; a Rights Manager can extend it at runtime.
# (name, UN/LOCODE, ISO2 country, lat, lng, [aliases])
#
# The 30 African entries are the ones this project shipped with. The 120 world
# entries below them were resolved against the published UN/LOCODE list: the code
# and, where the list carries one, the coordinates come from there, with Natural
# Earth's ports layer filling the gaps. Worth knowing if you extend it — several
# codes are *not* what you would guess, because UN/LOCODE has reassigned the
# obvious ones to airports: Shanghai's port is CNSGH (CNSHA is Hongqiao Apt),
# Ningbo CNNBO, Shenzhen CNSNZ, Qingdao CNQIN, Tianjin CNTNJ, Xiamen CNXAM,
# Dalian CNDAL.
#
# Every entry was checked point-in-polygon against its country; the ones that sit
# a few km offshore are correct (a port basin against a generalized coastline).
# This is a curated shortlist of major nodes, not a complete gazetteer — the
# whole point of the `places` admin section is that operators add what they need.
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
    {"name": "Shanghai", "code": "CNSGH", "country": "CN", "lat": 31.233, "lng": 121.483},
    {"name": "Ningbo", "code": "CNNBO", "country": "CN", "lat": 29.867, "lng": 121.55, "aliases": ["zhoushan"]},
    {"name": "Shenzhen", "code": "CNSNZ", "country": "CN", "lat": 22.55, "lng": 114.117, "aliases": ["yantian"]},
    {"name": "Guangzhou", "code": "CNGGZ", "country": "CN", "lat": 23.133, "lng": 113.233, "aliases": ["nansha"]},
    {"name": "Qingdao", "code": "CNQIN", "country": "CN", "lat": 36.05, "lng": 120.317},
    {"name": "Tianjin", "code": "CNTNJ", "country": "CN", "lat": 39.033, "lng": 117.2},
    {"name": "Xiamen", "code": "CNXAM", "country": "CN", "lat": 24.45, "lng": 118.1},
    {"name": "Dalian", "code": "CNDAL", "country": "CN", "lat": 38.917, "lng": 121.6},
    {"name": "Hong Kong", "code": "HKHKG", "country": "HK", "lat": 22.317, "lng": 114.167},
    {"name": "Singapore", "code": "SGSIN", "country": "SG", "lat": 1.283, "lng": 103.85},
    {"name": "Busan", "code": "KRPUS", "country": "KR", "lat": 35.133, "lng": 129.05, "aliases": ["pusan"]},
    {"name": "Incheon", "code": "KRINC", "country": "KR", "lat": 37.45, "lng": 126.617},
    {"name": "Tokyo", "code": "JPTYO", "country": "JP", "lat": 35.683, "lng": 139.75},
    {"name": "Yokohama", "code": "JPYOK", "country": "JP", "lat": 35.45, "lng": 139.65},
    {"name": "Kobe", "code": "JPUKB", "country": "JP", "lat": 34.683, "lng": 135.167},
    {"name": "Nagoya", "code": "JPGTK", "country": "JP", "lat": 35.233, "lng": 136.85},
    {"name": "Kaohsiung", "code": "TWKHH", "country": "TW", "lat": 22.565, "lng": 120.307},
    {"name": "Port Klang", "code": "MYPKG", "country": "MY", "lat": 3.0, "lng": 101.4, "aliases": ["klang"]},
    {"name": "Tanjung Pelepas", "code": "MYTPP", "country": "MY", "lat": 1.367, "lng": 103.55},
    {"name": "Laem Chabang", "code": "THLCH", "country": "TH", "lat": 13.083, "lng": 100.883},
    {"name": "Bangkok", "code": "THBKK", "country": "TH", "lat": 13.75, "lng": 100.517},
    {"name": "Ho Chi Minh City", "code": "VNSGN", "country": "VN", "lat": 10.767, "lng": 106.667, "aliases": ["saigon"]},
    {"name": "Haiphong", "code": "VNHPH", "country": "VN", "lat": 20.85, "lng": 106.683, "aliases": ["hai phong"]},
    {"name": "Tanjung Priok", "code": "IDTPP", "country": "ID", "lat": -6.104, "lng": 106.88, "aliases": ["jakarta"]},
    {"name": "Surabaya", "code": "IDSUB", "country": "ID", "lat": -7.233, "lng": 112.75, "aliases": ["tanjung perak"]},
    {"name": "Manila", "code": "PHMNL", "country": "PH", "lat": 14.524, "lng": 120.943},
    {"name": "Nhava Sheva", "code": "INNSA", "country": "IN", "lat": 18.949, "lng": 72.951, "aliases": ["jnpt", "jawaharlal nehru", "mumbai"]},
    {"name": "Mundra", "code": "INMUN", "country": "IN", "lat": 22.839, "lng": 69.717},
    {"name": "Chennai", "code": "INMAA", "country": "IN", "lat": 13.083, "lng": 80.283, "aliases": ["madras"]},
    {"name": "Cochin", "code": "INCOK", "country": "IN", "lat": 9.966, "lng": 76.243, "aliases": ["kochi"]},
    {"name": "Colombo", "code": "LKCMB", "country": "LK", "lat": 6.917, "lng": 79.85},
    {"name": "Chittagong", "code": "BDCGP", "country": "BD", "lat": 22.308, "lng": 91.801, "aliases": ["chattogram"]},
    {"name": "Karachi", "code": "PKKHI", "country": "PK", "lat": 24.835, "lng": 66.974},
    {"name": "Jebel Ali", "code": "AEJEA", "country": "AE", "lat": 25.01, "lng": 55.061, "aliases": ["dubai"]},
    {"name": "Abu Dhabi", "code": "AEAUH", "country": "AE", "lat": 24.467, "lng": 54.367, "aliases": ["khalifa port"]},
    {"name": "Jeddah", "code": "SAJED", "country": "SA", "lat": 21.467, "lng": 39.167},
    {"name": "Dammam", "code": "SADMM", "country": "SA", "lat": 26.5, "lng": 50.2},
    {"name": "Sohar", "code": "OMSOH", "country": "OM", "lat": 24.378, "lng": 56.738},
    {"name": "Salalah", "code": "OMSLL", "country": "OM", "lat": 16.942, "lng": 54.003},
    {"name": "Hamad Port", "code": "QAHMD", "country": "QA", "lat": 25.01, "lng": 51.605, "aliases": ["doha"]},
    {"name": "Shuwaikh", "code": "KWSWK", "country": "KW", "lat": 29.35, "lng": 47.933, "aliases": ["kuwait"]},
    {"name": "Umm Qasr", "code": "IQUQR", "country": "IQ", "lat": 30.033, "lng": 47.933},
    {"name": "Bandar Abbas", "code": "IRBND", "country": "IR", "lat": 27.183, "lng": 56.267},
    {"name": "Ambarli", "code": "TRAMR", "country": "TR", "lat": 40.967, "lng": 28.7, "aliases": ["istanbul"]},
    {"name": "Mersin", "code": "TRMER", "country": "TR", "lat": 36.717, "lng": 34.633},
    {"name": "Izmir", "code": "TRIZM", "country": "TR", "lat": 38.417, "lng": 27.15},
    {"name": "Rotterdam", "code": "NLRTM", "country": "NL", "lat": 51.917, "lng": 4.5},
    {"name": "Antwerp", "code": "BEANR", "country": "BE", "lat": 51.217, "lng": 4.417, "aliases": ["antwerpen"]},
    {"name": "Hamburg", "code": "DEHAM", "country": "DE", "lat": 53.517, "lng": 9.933},
    {"name": "Bremerhaven", "code": "DEBRV", "country": "DE", "lat": 53.533, "lng": 8.6},
    {"name": "Le Havre", "code": "FRLEH", "country": "FR", "lat": 49.5, "lng": 0.1},
    {"name": "Marseille", "code": "FRMRS", "country": "FR", "lat": 43.3, "lng": 5.4, "aliases": ["fos"]},
    {"name": "Valencia", "code": "ESVLC", "country": "ES", "lat": 39.444, "lng": -0.318},
    {"name": "Algeciras", "code": "ESALG", "country": "ES", "lat": 36.148, "lng": -5.4},
    {"name": "Barcelona", "code": "ESBCN", "country": "ES", "lat": 41.355, "lng": 2.169},
    {"name": "Genoa", "code": "ITGOA", "country": "IT", "lat": 44.417, "lng": 8.95, "aliases": ["genova"]},
    {"name": "Gioia Tauro", "code": "ITGIT", "country": "IT", "lat": 38.417, "lng": 15.9},
    {"name": "Trieste", "code": "ITTRS", "country": "IT", "lat": 45.645, "lng": 13.754},
    {"name": "Piraeus", "code": "GRPIR", "country": "GR", "lat": 37.933, "lng": 23.617},
    {"name": "Felixstowe", "code": "GBFXT", "country": "GB", "lat": 51.955, "lng": 1.313},
    {"name": "Southampton", "code": "GBSOU", "country": "GB", "lat": 50.903, "lng": -1.424},
    {"name": "Liverpool", "code": "GBLIV", "country": "GB", "lat": 53.417, "lng": -3.0},
    {"name": "Dublin", "code": "IEDUB", "country": "IE", "lat": 53.344, "lng": -6.206},
    {"name": "Lisbon", "code": "PTLIS", "country": "PT", "lat": 38.717, "lng": -9.133, "aliases": ["lisboa"]},
    {"name": "Sines", "code": "PTSIE", "country": "PT", "lat": 37.95, "lng": -8.867},
    {"name": "Gdansk", "code": "PLGDN", "country": "PL", "lat": 54.393, "lng": 18.669},
    {"name": "Gothenburg", "code": "SEGOT", "country": "SE", "lat": 57.717, "lng": 11.967, "aliases": ["goteborg"]},
    {"name": "Copenhagen", "code": "DKCPH", "country": "DK", "lat": 55.667, "lng": 12.583, "aliases": ["kobenhavn"]},
    {"name": "Oslo", "code": "NOOSL", "country": "NO", "lat": 59.9, "lng": 10.733},
    {"name": "Helsinki", "code": "FIHEL", "country": "FI", "lat": 60.167, "lng": 24.933},
    {"name": "St Petersburg", "code": "RULED", "country": "RU", "lat": 59.905, "lng": 30.244, "aliases": ["saint petersburg"]},
    {"name": "Novorossiysk", "code": "RUNVS", "country": "RU", "lat": 44.717, "lng": 37.767},
    {"name": "Odesa", "code": "UAODS", "country": "UA", "lat": 46.5, "lng": 30.75, "aliases": ["odessa"]},
    {"name": "Klaipeda", "code": "LTKLJ", "country": "LT", "lat": 55.687, "lng": 21.134},
    {"name": "Riga", "code": "LVRIX", "country": "LV", "lat": 57.008, "lng": 24.088},
    {"name": "Rijeka", "code": "HRRJK", "country": "HR", "lat": 45.333, "lng": 14.4},
    {"name": "Koper", "code": "SIKOP", "country": "SI", "lat": 45.548, "lng": 13.733},
    {"name": "Marsaxlokk", "code": "MTMAR", "country": "MT", "lat": 35.833, "lng": 14.533, "aliases": ["malta freeport"]},
    {"name": "Los Angeles", "code": "USLAX", "country": "US", "lat": 34.05, "lng": -118.25},
    {"name": "Long Beach", "code": "USLGB", "country": "US", "lat": 33.767, "lng": -118.183},
    {"name": "New York", "code": "USNYC", "country": "US", "lat": 40.7, "lng": -74.0, "aliases": ["newark", "new jersey"]},
    {"name": "Savannah", "code": "USTSA", "country": "US", "lat": 35.217, "lng": -88.233},
    {"name": "Houston", "code": "USHOU", "country": "US", "lat": 29.75, "lng": -95.35},
    {"name": "Seattle", "code": "USSEA", "country": "US", "lat": 47.602, "lng": -122.36},
    {"name": "Tacoma", "code": "USTIW", "country": "US", "lat": 47.267, "lng": -122.404},
    {"name": "Norfolk", "code": "USORF", "country": "US", "lat": 36.902, "lng": -76.293},
    {"name": "Charleston", "code": "USCHS", "country": "US", "lat": 32.822, "lng": -79.924},
    {"name": "Oakland", "code": "USOAK", "country": "US", "lat": 37.799, "lng": -122.301},
    {"name": "Miami", "code": "USMIA", "country": "US", "lat": 25.775, "lng": -80.167},
    {"name": "New Orleans", "code": "USMSY", "country": "US", "lat": 29.934, "lng": -90.056},
    {"name": "Baltimore", "code": "USBAL", "country": "US", "lat": 39.283, "lng": -76.617},
    {"name": "Vancouver", "code": "CAVAN", "country": "CA", "lat": 49.289, "lng": -123.112},
    {"name": "Montreal", "code": "CAMTR", "country": "CA", "lat": 45.544, "lng": -73.525},
    {"name": "Halifax", "code": "CAHAL", "country": "CA", "lat": 44.657, "lng": -63.574},
    {"name": "Manzanillo", "code": "MXZLO", "country": "MX", "lat": 19.05, "lng": -104.3},
    {"name": "Lazaro Cardenas", "code": "MXLZC", "country": "MX", "lat": 17.95, "lng": -102.183},
    {"name": "Veracruz", "code": "MXVER", "country": "MX", "lat": 19.2, "lng": -96.083},
    {"name": "Balboa", "code": "PABLB", "country": "PA", "lat": 8.956, "lng": -79.569, "aliases": ["panama canal"]},
    {"name": "Cristobal", "code": "PACTB", "country": "PA", "lat": 9.35, "lng": -79.9, "aliases": ["colon", "panama canal"]},
    {"name": "Santos", "code": "BRSSZ", "country": "BR", "lat": -23.933, "lng": -46.317},
    {"name": "Rio de Janeiro", "code": "BRRIO", "country": "BR", "lat": -22.867, "lng": -43.217},
    {"name": "Paranagua", "code": "BRPNG", "country": "BR", "lat": -25.5, "lng": -48.517},
    {"name": "Itajai", "code": "BRITJ", "country": "BR", "lat": -26.9, "lng": -48.65},
    {"name": "Buenos Aires", "code": "ARBUE", "country": "AR", "lat": -34.583, "lng": -58.667},
    {"name": "San Antonio", "code": "CLSAI", "country": "CL", "lat": -33.6, "lng": -71.6},
    {"name": "Valparaiso", "code": "CLVAP", "country": "CL", "lat": -33.033, "lng": -71.633},
    {"name": "Callao", "code": "PECLL", "country": "PE", "lat": -12.05, "lng": -77.133, "aliases": ["lima"]},
    {"name": "Cartagena", "code": "COCTG", "country": "CO", "lat": 10.403, "lng": -75.526},
    {"name": "Buenaventura", "code": "COBUN", "country": "CO", "lat": 3.883, "lng": -77.053},
    {"name": "Guayaquil", "code": "ECGYE", "country": "EC", "lat": -2.167, "lng": -79.9},
    {"name": "Montevideo", "code": "UYMVD", "country": "UY", "lat": -34.901, "lng": -56.204},
    {"name": "Kingston", "code": "JMKIN", "country": "JM", "lat": 17.982, "lng": -76.825},
    {"name": "Caucedo", "code": "DOCAU", "country": "DO", "lat": 18.417, "lng": -69.633},
    {"name": "Freeport", "code": "BSFPO", "country": "BS", "lat": 26.538, "lng": -78.728},
    {"name": "Sydney", "code": "AUSYD", "country": "AU", "lat": -33.85, "lng": 151.2},
    {"name": "Melbourne", "code": "AUMEL", "country": "AU", "lat": -37.817, "lng": 144.967},
    {"name": "Brisbane", "code": "AUBNE", "country": "AU", "lat": -27.467, "lng": 153.017},
    {"name": "Fremantle", "code": "AUFRE", "country": "AU", "lat": -32.047, "lng": 115.738, "aliases": ["perth"]},
    {"name": "Auckland", "code": "NZAKL", "country": "NZ", "lat": -36.833, "lng": 174.8},
    {"name": "Tauranga", "code": "NZTRG", "country": "NZ", "lat": -37.683, "lng": 176.167},
]


def place_label(place: dict) -> str:
    cat = COUNTRY_CATALOGUE.get(place["country"], {})
    return f"{place['name']} ({place['code']})"


def country_meta(code: str) -> dict:
    return COUNTRY_CATALOGUE.get(code.upper(), {"name": code, "flag": ""})
