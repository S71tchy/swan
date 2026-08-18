"""Shared normalisation for notification-subscription input, used by both the
self-service (users) and admin routers so validation stays identical."""
from __future__ import annotations

from app.enums import NOTIFICATION_EVENTS, SEVERITY_ORDER
from app.models import NotificationSubscription
from app.notifications.templates import DEFAULT_PARTICIPANT_EVENTS, MANAGER_EVENTS
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


# --------------------------------------------------------------------------- #
# Default subscriptions
#
# Delivery is subscription-driven for *every* trigger, including the ones
# addressed to a specific person ("your alert was rejected"). That makes an
# account with no subscriptions completely silent — so a new account gets these,
# and every existing account was backfilled with them by the migration. They are
# ordinary subscriptions: visible in the profile, pausable, deletable.
#
# Two of them, not one, on purpose: pausing "New registrations" from the
# unsubscribe link in a registration email must not also switch off the reply to
# your own submission.
# --------------------------------------------------------------------------- #
PERSONAL_SUBSCRIPTION_NAME = "My activity"
REGISTRATIONS_SUBSCRIPTION_NAME = "New registrations"


def default_subscriptions(user_id: str, is_manager: bool) -> list[NotificationSubscription]:
    subs = [
        NotificationSubscription(
            user_id=user_id,
            name=PERSONAL_SUBSCRIPTION_NAME,
            active=True,
            events=list(DEFAULT_PARTICIPANT_EVENTS),
            countries=[], profiles=[], categories=[], min_severity="info",
        )
    ]
    if is_manager:
        subs.append(
            NotificationSubscription(
                user_id=user_id,
                name=REGISTRATIONS_SUBSCRIPTION_NAME,
                active=True,
                events=list(MANAGER_EVENTS),
                countries=[], profiles=[], categories=[], min_severity="info",
            )
        )
    return subs


def ensure_manager_subscription(db, user) -> None:
    """Give a newly-promoted Rights Manager the registrations subscription.

    Without this, promotion is silent: before this change every manager was
    mailed about registrations unconditionally, so a manager who acquired the
    role later would simply never hear about one.
    """
    existing = db.query(NotificationSubscription).filter(
        NotificationSubscription.user_id == user.id
    ).all()
    if any(set(MANAGER_EVENTS) & set(sub.events or []) for sub in existing):
        return
    db.add(
        NotificationSubscription(
            user_id=user.id,
            name=REGISTRATIONS_SUBSCRIPTION_NAME,
            active=True,
            events=list(MANAGER_EVENTS),
            countries=[], profiles=[], categories=[], min_severity="info",
        )
    )
