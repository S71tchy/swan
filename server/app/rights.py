"""Rights resolution engine (spec §4).

Effective rights are the UNION of a user's explicit country lists and the
countries granted by any standard profiles they hold. Everything is resolved at
read time so that editing a profile immediately changes every holder's reach.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Alert, Profile, User


def _profile_countries(db: Session, profile_names: list[str]) -> set[str]:
    if not profile_names:
        return set()
    rows = db.query(Profile).filter(Profile.name.in_(profile_names)).all()
    countries: set[str] = set()
    for p in rows:
        countries.update(p.countries or [])
    return countries


def effective_internal_countries(db: Session, user: User) -> set[str]:
    return set(user.internal_pub_countries or []) | _profile_countries(db, user.profiles or [])


def effective_external_countries(db: Session, user: User) -> set[str]:
    # External publication is a strict, separately-granted dimension: only the
    # explicit external list counts (profiles grant internal reach).
    return set(user.external_pub_countries or [])


def is_rights_manager(db: Session, user: User) -> bool:
    if user.is_rights_manager:
        return True
    rows = db.query(Profile).filter(Profile.name.in_(user.profiles or [])).all()
    return any(p.embeds_rights_manager for p in rows)


def alert_country_codes(alert_or_locations) -> list[str]:
    """Distinct ISO2 country codes across an alert's location blocks."""
    locations = (
        alert_or_locations.locations
        if isinstance(alert_or_locations, Alert)
        else alert_or_locations
    )
    seen: list[str] = []
    for loc in locations or []:
        code = (loc.get("country") or "").upper()
        if code and code not in seen:
            seen.append(code)
    return seen


def routing_for_locations(db: Session, user: User, locations: list[dict]) -> dict:
    """Decide whether the author can publish directly or must submit for approval.

    Returns the payload the Create form needs to swap its primary CTA and show
    the rights notice (spec §5.4 button logic).
    """
    covered = effective_internal_countries(db, user)
    countries = alert_country_codes(locations)
    uncovered = [c for c in countries if c not in covered]

    can_publish = user.can_create and len(countries) > 0 and not uncovered
    return {
        "countries": countries,
        "covered": [c for c in countries if c in covered],
        "uncovered": uncovered,
        # If the author holds internal rights for ALL locations -> Publish,
        # otherwise the alert routes to the approval queue -> Submit.
        "action": "publish" if can_publish else "submit",
        "can_publish": can_publish,
    }


def can_publish_alert(db: Session, user: User, alert: Alert) -> bool:
    return routing_for_locations(db, user, alert.locations)["can_publish"]


def can_approve_country(db: Session, user: User, country_code: str) -> bool:
    return country_code.upper() in effective_internal_countries(db, user)


def pending_alerts_in_perimeter(db: Session, user: User) -> list[Alert]:
    """Submitted alerts touching any country in the user's internal perimeter."""
    perimeter = effective_internal_countries(db, user)
    if not perimeter:
        return []
    submitted = (
        db.query(Alert)
        .filter(Alert.status == "submitted")
        .order_by(Alert.submitted_at.desc())
        .all()
    )
    return [
        a
        for a in submitted
        if perimeter.intersection(set(alert_country_codes(a)))
    ]


def perimeter_label(db: Session, user: User) -> str:
    """Human label for 'Your perimeter' in the approval queue header."""
    if user.profiles:
        return " · ".join(user.profiles)
    codes = sorted(effective_internal_countries(db, user))
    return " · ".join(codes) if codes else "None"
