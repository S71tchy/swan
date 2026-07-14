"""Model -> schema helpers that add computed presentation fields."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Alert, User
from app.rights import (
    effective_external_countries,
    effective_internal_countries,
    is_rights_manager,
    perimeter_label,
)
from app import schemas


def valid_to_label(alert: Alert) -> str:
    """A blank 'To' date renders as 'until further notice' everywhere (spec §5.2)."""
    if alert.valid_to is None:
        return "until further notice"
    d = alert.valid_to
    return f"{d.day} {d.strftime('%b %Y')}"  # e.g. "22 Jul 2026" (no %-d, cross-platform)


def alert_to_out(alert: Alert) -> schemas.AlertOut:
    data = {
        "id": alert.id,
        "title": alert.title,
        "description": alert.description,
        "picture_url": alert.picture_url,
        "category": alert.category,
        "sub_category": alert.sub_category,
        "industry": alert.industry,
        "severity": alert.severity,
        "status": alert.status,
        "origin": alert.origin,
        "visibility": alert.visibility,
        "valid_from": alert.valid_from,
        "valid_to": alert.valid_to,
        "valid_to_label": valid_to_label(alert),
        "impacts": alert.impacts,
        "action_plan": alert.action_plan,
        "locations": alert.locations or [],
        "urls": alert.urls or [],
        "attachments": alert.attachments or [],
        "clients": alert.clients or [],
        "external_variant": alert.external_variant,
        "rejection_comment": alert.rejection_comment,
        "author": {
            "id": alert.author.id,
            "name": alert.author.name,
            "initials": alert.author.initials,
            "branch": alert.author.branch,
        },
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
        "submitted_at": alert.submitted_at,
        "published_at": alert.published_at,
        "closed_at": alert.closed_at,
    }
    return schemas.AlertOut.model_validate(data)


def rights_summary(db: Session, user: User) -> schemas.RightsSummary:
    return schemas.RightsSummary(
        can_create=user.can_create,
        is_rights_manager=is_rights_manager(db, user),
        internal_countries=sorted(effective_internal_countries(db, user)),
        external_countries=sorted(effective_external_countries(db, user)),
        client_scope=list(user.client_scope or []),
        profiles=list(user.profiles or []),
        perimeter_label=perimeter_label(db, user),
    )
