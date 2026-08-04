"""Alert lifecycle & feed (spec §5.4).

    Editing --Save--> Draft --Submit--> Submitted --Approve/Publish--> Published
                                              |                            |
                                           Reject                     Close/Expire
                                              v                            v
                                          Rejected                Closed / Expired
"""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import audit, schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, User
from app.notifications import service as notify
from app.rights import (
    can_approve_alert,
    can_publish_alert,
    can_publish_external,
    coverage_for,
    routing_for_locations,
)
from app.serialize import alert_to_out

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_owned_or_404(db: Session, alert_id: str, user: User) -> Alert:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    if alert.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your alert")
    return alert


def _apply_severity_default(alert: Alert) -> None:
    if not alert.severity:
        alert.severity = "info"


# --------------------------------------------------------------------------- #
# Read
# --------------------------------------------------------------------------- #
@router.get("", response_model=list[schemas.AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_filter: str | None = Query(default=None, alias="status"),
    scope: str = Query(default="published"),  # published | mine | map
):
    """Feed / map data.

    - scope=published : every published alert (live feed, all alerts)
    - scope=map       : published alerts currently inside their validity window
    - scope=mine      : the caller's own alerts across all statuses (drafts etc.)
    """
    q = db.query(Alert)
    if scope == "mine":
        q = q.filter(Alert.author_id == user.id)
    elif scope == "map":
        today = date.today()
        q = q.filter(
            Alert.status == "published",
            Alert.valid_from <= today,
        )
    else:
        q = q.filter(Alert.status == "published")

    if status_filter:
        q = q.filter(Alert.status == status_filter)

    alerts = q.order_by(Alert.created_at.desc()).all()

    if scope == "map":
        today = date.today()
        alerts = [a for a in alerts if a.valid_to is None or a.valid_to >= today]

    return [alert_to_out(a) for a in alerts]


# NOTE: must stay ABOVE `/{alert_id}` — FastAPI matches in declaration order,
# so a literal GET path declared after the parameterised one is never reached.
@router.get("/live-version", response_model=schemas.LiveVersion)
def live_version(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Cheap change stamp for the `scope=map` set, for polling.

    Selects three columns rather than whole rows: the point is to be small and
    fast enough to hit on a timer, which the feed itself is not (it inlines
    every picture). The window is recomputed against today, so an alert
    expiring or becoming valid changes the stamp with no write involved.
    """
    today = date.today()
    rows = (
        db.query(Alert.id, Alert.updated_at, Alert.valid_to)
        .filter(Alert.status == "published", Alert.valid_from <= today)
        .order_by(Alert.id)
        .all()
    )
    live = [r for r in rows if r.valid_to is None or r.valid_to >= today]
    digest = hashlib.sha256(
        "|".join(f"{r.id}:{r.updated_at.isoformat() if r.updated_at else ''}" for r in live).encode()
    ).hexdigest()[:16]
    return schemas.LiveVersion(version=digest, count=len(live))


@router.get("/{alert_id}", response_model=schemas.AlertOut)
def get_alert(alert_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    return alert_to_out(alert)


# --------------------------------------------------------------------------- #
# Rights routing preview (drives the Create form CTA + notice)
# --------------------------------------------------------------------------- #
@router.post("/routing", response_model=schemas.RoutingInfo)
def routing_preview(
    body: schemas.AlertCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    locations = [loc.model_dump() for loc in body.locations]
    return schemas.RoutingInfo(**routing_for_locations(db, user, locations))


# --------------------------------------------------------------------------- #
# Create / update draft
# --------------------------------------------------------------------------- #
@router.post("", response_model=schemas.AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    body: schemas.AlertCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.can_create:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No creation right")
    alert = Alert(
        author_id=user.id,
        status="draft",
        **body.model_dump(),
    )
    _apply_severity_default(alert)
    db.add(alert)
    db.flush()
    audit.record(db, user, "alert.created", alert.id)
    db.commit()
    db.refresh(alert)
    return alert_to_out(alert)


@router.patch("/{alert_id}", response_model=schemas.AlertOut)
def update_alert(
    alert_id: str,
    body: schemas.AlertUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    # Authors edit their own drafts/rejected alerts; a perimeter rights-holder
    # may edit a submitted alert ("Edit then publish", spec §5.4).
    is_author = alert.author_id == user.id
    if is_author and alert.status in ("draft", "rejected"):
        pass
    elif alert.status == "submitted" and can_approve_alert(db, user, alert):
        pass
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not editable in this state by you")
    updates = body.model_dump(exclude_unset=True)
    if "locations" in updates:
        updates["locations"] = [
            loc if isinstance(loc, dict) else loc.model_dump() for loc in updates["locations"]
        ]
    for key, value in updates.items():
        setattr(alert, key, value)
    # An edited rejected alert returns to draft.
    if alert.status == "rejected":
        alert.status = "draft"
        alert.rejection_comment = None
    audit.record(db, user, "alert.updated", alert.id, detail={"fields": list(updates)})
    db.commit()
    db.refresh(alert)
    return alert_to_out(alert)


# --------------------------------------------------------------------------- #
# Lifecycle transitions
# --------------------------------------------------------------------------- #
def _require_ready_to_publish(alert: Alert) -> None:
    missing = [
        f
        for f in ("title", "category", "sub_category", "impacts", "action_plan")
        if not getattr(alert, f)
    ]
    if not alert.locations:
        missing.append("locations")
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Mandatory fields missing: {', '.join(missing)}",
        )


@router.post("/{alert_id}/submit", response_model=schemas.AlertOut)
def submit_alert(
    alert_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Route to the approval queue of rights-holders for the alert's locations."""
    alert = _get_owned_or_404(db, alert_id, user)
    if alert.status not in ("draft", "rejected"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Alert is not a draft")
    _require_ready_to_publish(alert)
    alert.status = "submitted"
    alert.submitted_at = _now()
    alert.rejection_comment = None
    audit.record(db, user, "alert.submitted", alert.id)
    db.commit()
    db.refresh(alert)
    # Confirm to the author; broadcast to publishers subscribed to the zone.
    notify.notify_submission_received(db, background, alert)
    notify.notify_alert_broadcast(db, background, "submitted", alert, actor=user)
    return alert_to_out(alert)


@router.post("/{alert_id}/publish", response_model=schemas.AlertOut)
def publish_alert(
    alert_id: str,
    body: schemas.PublishRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Direct publish (author holds rights for all locations) OR approval-publish
    by a rights-holder of a submitted alert. Captures the external variant
    (delivery is Phase 3) and requires the content confirmation."""
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    if alert.status not in ("draft", "rejected", "submitted"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Alert cannot be published from its state")
    if not body.content_confirmed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Content must be confirmed")

    was_submitted = alert.status == "submitted"
    # Approving someone else's submission allows the Rights-Manager escalation
    # for orphaned alerts; publishing your own draft never does — an author who
    # can't cover every location must submit it.
    permitted = (
        can_approve_alert(db, user, alert) if was_submitted else can_publish_alert(db, user, alert)
    )
    if not permitted:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You don't hold internal publication rights for all locations",
        )

    ext = body.external.model_dump()
    # External publication is granted separately from internal (spec §4): holding
    # the internal right for a country says nothing about the client-facing one.
    if ext["mode"] != "none" and not can_publish_external(db, user, alert):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You don't hold external publication rights for all locations",
        )
    _require_ready_to_publish(alert)

    # Record whether this went through the Rights-Manager escalation, so the
    # audit trail shows who published outside their own perimeter and why.
    escalated = bool(coverage_for(db, user, alert)["uncovered"])

    alert.visibility = "internal" if ext["mode"] == "none" else "internal_external"
    alert.external_variant = ext if ext["mode"] != "none" else None
    alert.status = "published"
    alert.published_at = _now()
    audit.record(
        db, user, "alert.published", alert.id,
        detail={
            "visibility": alert.visibility,
            "external_mode": ext["mode"],
            "escalated": escalated,
        },
    )
    db.commit()
    db.refresh(alert)
    # Broadcast to subscribers; if a publisher approved someone else's submission,
    # tell the author their alert was approved.
    notify.notify_alert_broadcast(db, background, "published", alert, actor=user)
    if was_submitted and alert.author_id != user.id:
        notify.notify_alert_decision(db, background, alert, approved=True)
    return alert_to_out(alert)


@router.post("/{alert_id}/reject", response_model=schemas.AlertOut)
def reject_alert(
    alert_id: str,
    body: schemas.RejectRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rights-holder rejects a submitted alert; returns to author, editable."""
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    if alert.status != "submitted":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only submitted alerts can be rejected")
    if not can_approve_alert(db, user, alert):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not in your approval perimeter")
    alert.status = "rejected"
    alert.rejection_comment = body.comment
    audit.record(db, user, "alert.rejected", alert.id, detail={"comment": body.comment})
    db.commit()
    db.refresh(alert)
    notify.notify_alert_decision(db, background, alert, approved=False)
    return alert_to_out(alert)


@router.post("/{alert_id}/close", response_model=schemas.AlertOut)
def close_alert(
    alert_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Authors close their own published alerts; rights-holders close any within
    their perimeter. Removes it from the map immediately (spec §5.5)."""
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    if alert.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only published alerts can be closed")
    is_author = alert.author_id == user.id
    if not is_author and not can_publish_alert(db, user, alert):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to close this alert")
    alert.status = "closed"
    alert.closed_at = _now()
    audit.record(db, user, "alert.closed", alert.id)
    db.commit()
    db.refresh(alert)
    notify.notify_alert_broadcast(db, background, "closed", alert, actor=user)
    return alert_to_out(alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(alert_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alert = _get_owned_or_404(db, alert_id, user)
    if alert.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only drafts can be deleted")
    db.delete(alert)
    db.commit()
