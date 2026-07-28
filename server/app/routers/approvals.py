"""Approval queue — submitted alerts a rights-holder can actually action.

The queue deliberately mirrors the action gate: an alert only appears if the
caller could publish or reject it right now. Alerts nobody fully covers are
escalated to Rights Managers rather than silently stranded (see rights.py).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.rights import (
    can_publish_external,
    coverage_for,
    effective_external_countries,
    escalated_alerts_for,
    pending_alerts_in_perimeter,
    perimeter_label,
)
from app.serialize import alert_to_out

router = APIRouter(prefix="/approvals", tags=["approvals"])


class ApprovalItem(BaseModel):
    alert: schemas.AlertOut
    countries: list[str]
    covered: list[str]
    uncovered: list[str]
    # True when this is only actionable because the caller is a Rights Manager
    # and no one's perimeter covers the alert.
    escalated: bool
    # Whether the caller may choose an external variant when publishing, and
    # which countries block it if not.
    can_publish_external: bool
    external_uncovered: list[str]


class ApprovalQueue(BaseModel):
    perimeter_label: str
    pending: int
    escalated: int
    items: list[ApprovalItem]


@router.get("", response_model=ApprovalQueue)
def approval_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    external = effective_external_countries(db, user)

    def to_item(alert, escalated: bool) -> ApprovalItem:
        cov = coverage_for(db, user, alert)
        return ApprovalItem(
            alert=alert_to_out(alert),
            escalated=escalated,
            can_publish_external=can_publish_external(db, user, alert),
            external_uncovered=[c for c in cov["countries"] if c not in external],
            **cov,
        )

    mine = [to_item(a, False) for a in pending_alerts_in_perimeter(db, user)]
    escalated = [to_item(a, True) for a in escalated_alerts_for(db, user)]
    items = mine + escalated

    return ApprovalQueue(
        perimeter_label=perimeter_label(db, user),
        pending=len(items),
        escalated=len(escalated),
        items=items,
    )
