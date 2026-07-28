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

    # External publication is a separate grant — the form uses this to decide
    # whether to offer the client-facing options at all.
    external = effective_external_countries(db, user)
    external_uncovered = [c for c in countries if c not in external]

    return {
        "countries": countries,
        "covered": [c for c in countries if c in covered],
        "uncovered": uncovered,
        # If the author holds internal rights for ALL locations -> Publish,
        # otherwise the alert routes to the approval queue -> Submit.
        "action": "publish" if can_publish else "submit",
        "can_publish": can_publish,
        "can_publish_external": len(countries) > 0 and not external_uncovered,
        "external_uncovered": external_uncovered,
    }


def can_publish_alert(db: Session, user: User, alert: Alert) -> bool:
    return routing_for_locations(db, user, alert.locations)["can_publish"]


def can_publish_external(db: Session, user: User, alert: Alert) -> bool:
    """External publication is its own rights dimension: the actor must hold it
    for EVERY country on the alert, not just the internal right."""
    codes = set(alert_country_codes(alert))
    return bool(codes) and codes <= effective_external_countries(db, user)


def can_approve_country(db: Session, user: User, country_code: str) -> bool:
    return country_code.upper() in effective_internal_countries(db, user)


# --------------------------------------------------------------------------- #
# Approval routing
#
# A submission is actionable only by someone whose internal perimeter covers
# EVERY country on it — approving half an alert would publish the other half
# without rights. That leaves a gap: a multi-country alert nobody fully covers
# would sit in no queue at all, so those are detected as "orphaned" and
# escalated to Rights Managers, who may action them as the explicit (audited)
# escape hatch.
# --------------------------------------------------------------------------- #
def _active_perimeters(db: Session) -> list[set[str]]:
    """Every active user's effective internal perimeter, in one pass.

    Resolved here rather than via effective_internal_countries per user so orphan
    detection doesn't fire one Profile query per account.
    """
    profile_countries = {
        p.name: set(p.countries or []) for p in db.query(Profile).all()
    }
    perimeters: list[set[str]] = []
    for u in db.query(User).filter(User.status == "active").all():
        perim = set(u.internal_pub_countries or [])
        for name in u.profiles or []:
            perim |= profile_countries.get(name, set())
        if perim:
            perimeters.append(perim)
    return perimeters


def is_orphaned(codes: set[str], perimeters: list[set[str]]) -> bool:
    """True when no single active user's perimeter covers all of `codes`."""
    if not codes:
        return False
    return not any(codes <= p for p in perimeters)


def coverage_for(db: Session, user: User, alert: Alert) -> dict:
    """How this user's perimeter relates to one alert's countries."""
    perimeter = effective_internal_countries(db, user)
    countries = alert_country_codes(alert)
    return {
        "countries": countries,
        "covered": [c for c in countries if c in perimeter],
        "uncovered": [c for c in countries if c not in perimeter],
    }


def can_approve_alert(db: Session, user: User, alert: Alert) -> bool:
    """May this user action a SUBMITTED alert (publish / reject / edit)?

    Full internal coverage, or Rights Manager stepping in on an orphaned alert.
    """
    if not coverage_for(db, user, alert)["uncovered"]:
        return True
    if is_rights_manager(db, user):
        codes = set(alert_country_codes(alert))
        return is_orphaned(codes, _active_perimeters(db))
    return False


def _submitted(db: Session) -> list[Alert]:
    return (
        db.query(Alert)
        .filter(Alert.status == "submitted")
        .order_by(Alert.submitted_at.desc())
        .all()
    )


def pending_alerts_in_perimeter(db: Session, user: User) -> list[Alert]:
    """Submitted alerts whose countries are ALL inside the user's perimeter."""
    perimeter = effective_internal_countries(db, user)
    if not perimeter:
        return []
    return [a for a in _submitted(db) if set(alert_country_codes(a)) <= perimeter]


def escalated_alerts_for(db: Session, user: User) -> list[Alert]:
    """Orphaned submissions surfaced to Rights Managers.

    Only alerts the user cannot already action normally — so the two queues
    never show the same item twice.
    """
    if not is_rights_manager(db, user):
        return []
    perimeter = effective_internal_countries(db, user)
    perimeters = _active_perimeters(db)
    out: list[Alert] = []
    for a in _submitted(db):
        codes = set(alert_country_codes(a))
        if codes <= perimeter:
            continue  # already in their normal queue
        if is_orphaned(codes, perimeters):
            out.append(a)
    return out


def perimeter_label(db: Session, user: User) -> str:
    """Human label for 'Your perimeter' in the approval queue header."""
    if user.profiles:
        return " · ".join(user.profiles)
    codes = sorted(effective_internal_countries(db, user))
    return " · ".join(codes) if codes else "None"
