"""Current-user profile (identity, activity, notifications, read-only rights)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, User
from app.reference import REGION_NEIGHBOURS, country_meta
from app.rights import (
    effective_external_countries,
    effective_internal_countries,
    perimeter_label,
)
from app.serialize import rights_summary

router = APIRouter(prefix="/users", tags=["users"])


def _perimeter_rows(db: Session, user: User) -> list[schemas.PerimeterRow]:
    internal = effective_internal_countries(db, user)
    external = effective_external_countries(db, user)
    explicit = set(user.internal_pub_countries or [])

    def source_for(code: str) -> str:
        if code in explicit:
            return "Explicit"
        for profile in user.profiles or []:
            return profile  # granted via first held profile
        return "—"

    # Rows: everything the user can publish, plus illustrative neighbours that
    # route to approval so the "Submit for approval" state is visible.
    neighbours = REGION_NEIGHBOURS.get(user.home_country, [])
    codes: list[str] = []
    for c in sorted(internal) + list(external) + neighbours:
        if c not in codes:
            codes.append(c)

    rows: list[schemas.PerimeterRow] = []
    for code in codes:
        meta = country_meta(code)
        rows.append(
            schemas.PerimeterRow(
                country=code,
                country_name=meta["name"],
                flag=meta["flag"],
                source=source_for(code) if code in internal else "—",
                internal=code in internal,
                external=code in external,
            )
        )
    return rows


def _stats(db: Session, user: User) -> schemas.UserStats:
    created = db.query(Alert).filter(Alert.author_id == user.id).count()
    published = (
        db.query(Alert)
        .filter(Alert.author_id == user.id, Alert.status == "published")
        .count()
    )
    last = (
        db.query(Alert)
        .filter(Alert.author_id == user.id)
        .order_by(Alert.created_at.desc())
        .first()
    )
    return schemas.UserStats(
        created=created,
        published=published,
        last_alert=last.created_at if last else None,
    )


@router.get("/me", response_model=schemas.UserMe)
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return schemas.UserMe(
        id=user.id,
        email=user.email,
        name=user.name,
        initials=user.initials,
        job_title=user.job_title,
        branch=user.branch,
        role_label=user.role_label,
        home_country=user.home_country,
        home_country_name=user.home_country_name,
        phone=user.phone,
        locale=user.locale,
        timezone=user.timezone,
        avatar_gold=user.avatar_gold,
        status=user.status,
        rights=rights_summary(db, user),
        notifications=schemas.NotificationRules(
            published=user.notify_published,
            published_area=user.notify_published_area,
            submitted=user.notify_submitted,
            submitted_area=user.notify_submitted_area,
        ),
        perimeter=_perimeter_rows(db, user),
        stats=_stats(db, user),
    )


@router.patch("/me/notifications", response_model=schemas.NotificationRules)
def update_notifications(
    body: schemas.NotificationRules,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.notify_published = body.published
    user.notify_published_area = body.published_area
    user.notify_submitted = body.submitted
    user.notify_submitted_area = body.submitted_area
    db.commit()
    return body
