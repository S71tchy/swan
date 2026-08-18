"""Domain enumerations, kept in one place so the taxonomy stays consistent
between models, schemas, seed data, and the frontend (mirrored in web/src/types)."""
from enum import Enum

# The notification triggers live with the templates that define them; this module
# only re-exports them so existing importers keep working. templates.py imports
# nothing from the app, so there is no cycle.
from app.notifications.templates import EVENTS as _TEMPLATE_EVENTS


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

# Assignable user roles (spec §3 personas, Phase-1 relevant). Roles are display
# labels — effective permissions come from the rights model (§4), not the role —
# but the admin picks from this canonical list rather than free-typing, so a
# just-validated account gets a real role. Phase 2/3 personas (Network
# Intelligence Analyst, Client User) are added when those phases land.
ROLES = [
    "Field Contributor",
    "Country/Region Publisher",
    "Executive Viewer",
    "Rights Manager",
]

# Subscription-driven broadcast events a user can subscribe to (spec §4.5).
# Direct transactional emails (submission-received, approval decision,
# registration, activation) are NOT subscription-filtered — they always go to a
# specific person — so they are not in this list.
# Derived from the notification template catalog — that list is the source of
# truth for what exists to be notified about, so a new template is subscribable
# the moment it is added. Hard-coding it here (and again in the editor) is what
# left six of the nine triggers with no way to opt in or out.
NOTIFICATION_EVENTS = list(_TEMPLATE_EVENTS)

# Severity ordering for the "min criticality" subscription threshold.
SEVERITY_ORDER = ["info", "watch", "warning", "critical"]


def severity_at_least(severity: str, threshold: str) -> bool:
    """True if `severity` is at or above `threshold` on the SEVERITY_ORDER ramp.
    Unknown values fail open (match) so a bad value never silently drops mail."""
    try:
        return SEVERITY_ORDER.index(severity) >= SEVERITY_ORDER.index(threshold)
    except ValueError:
        return True
