"""Domain enumerations, kept in one place so the taxonomy stays consistent
between models, schemas, seed data, and the frontend (mirrored in web/src/types)."""
from enum import Enum


class Severity(str, Enum):
    info = "info"
    watch = "watch"
    warning = "warning"
    critical = "critical"


class AlertStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    published = "published"
    rejected = "rejected"
    closed = "closed"
    expired = "expired"


class Origin(str, Enum):
    human = "human"
    signal = "signal"  # Phase 2


class Visibility(str, Enum):
    internal = "internal"
    internal_external = "internal_external"


class TransportMode(str, Enum):
    sea = "sea"
    road = "road"
    air = "air"
    rail = "rail"
    warehouse = "warehouse"


class Flow(str, Enum):
    import_ = "import"
    export = "export"
    both = "both"


# Category -> sub-categories. Mirrors spec §5.2 (dependent sub-category).
CATEGORIES: dict[str, list[str]] = {
    "Weather": ["Cyclone", "Flood", "Storm", "Heat", "Swell"],
    "Strike": ["Port workers", "Road transport", "Customs", "General"],
    "Congestion": ["Port congestion", "Anchorage queue", "Border queue"],
    "Security": ["Civil unrest", "Piracy", "Theft", "Conflict"],
    "Regulatory": ["Customs", "Transit bond", "Tariff", "Sanctions"],
    "Health": ["Epidemic", "Port health measure", "Border health check"],
    "Infrastructure": ["Rail works", "Road closure", "Port equipment", "Power"],
    "Accident": ["Vessel", "Derailment", "Road accident", "Fire"],
}

INDUSTRIES = [
    "All industries",
    "Agriculture",
    "Mining & Metals",
    "Oil & Gas",
    "Retail & FMCG",
    "Automotive",
    "Project Cargo",
]
