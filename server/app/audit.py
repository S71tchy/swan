from sqlalchemy.orm import Session

from app.models import AuditLog, User


def record(
    db: Session,
    actor: User | None,
    action: str,
    target_id: str | None = None,
    target_type: str = "alert",
    detail: dict | None = None,
) -> None:
    """Append an immutable audit entry (spec §10). Caller commits."""
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            actor_name=actor.name if actor else "system",
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
        )
    )
