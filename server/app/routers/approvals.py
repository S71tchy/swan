"""Approval queue — submitted alerts within the caller's internal perimeter."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.rights import pending_alerts_in_perimeter, perimeter_label
from app.serialize import alert_to_out

router = APIRouter(prefix="/approvals", tags=["approvals"])


class ApprovalQueue(BaseModel):
    perimeter_label: str
    pending: int
    alerts: list[schemas.AlertOut]


@router.get("", response_model=ApprovalQueue)
def approval_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alerts = pending_alerts_in_perimeter(db, user)
    return ApprovalQueue(
        perimeter_label=perimeter_label(db, user),
        pending=len(alerts),
        alerts=[alert_to_out(a) for a in alerts],
    )
