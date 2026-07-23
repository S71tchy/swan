"""Shared normalisation for notification-subscription input, used by both the
self-service (users) and admin routers so validation stays identical."""
from __future__ import annotations

from app.enums import NOTIFICATION_EVENTS, SEVERITY_ORDER
from app.models import NotificationSubscription
from app.reference import COUNTRY_CATALOGUE


def apply_subscription(sub: NotificationSubscription, data: dict) -> NotificationSubscription:
    """Apply a create/update payload onto a subscription, silently dropping
    invalid enum/country values (rather than 422-ing on a stale option)."""
    if data.get("name") is not None:
        sub.name = data["name"].strip()
    if data.get("active") is not None:
        sub.active = bool(data["active"])
    if data.get("events") is not None:
        sub.events = [e for e in data["events"] if e in NOTIFICATION_EVENTS]
    if data.get("countries") is not None:
        sub.countries = [
            c.upper() for c in data["countries"] if c and c.upper() in COUNTRY_CATALOGUE
        ]
    if data.get("profiles") is not None:
        sub.profiles = [p for p in data["profiles"] if p]
    if data.get("categories") is not None:
        sub.categories = [c for c in data["categories"] if c]
    if data.get("min_severity") is not None:
        sub.min_severity = data["min_severity"] if data["min_severity"] in SEVERITY_ORDER else "info"
    return sub
