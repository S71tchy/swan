"""Current-user profile (identity, activity, subscriptions, read-only rights)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, NotificationSubscription, Profile, User
from app.reference import country_meta
from app.rights import (
    effective_external_countries,
    effective_internal_countries,
    perimeter_label,
)
from app.serialize import rights_summary
from app.subscriptions import apply_subscription as _apply_subscription

router = APIRouter(prefix="/users", tags=["users"])


def _perimeter_rows(db: Session, user: User) -> list[schemas.PerimeterRow]:
    """The countries this user actually holds a right in — nothing else.

    This table is read as a statement of fact about someone's rights, so it must
    only ever list granted countries. It used to append `REGION_NEIGHBOURS` of
    the home country as illustrative "Submit for approval" rows (a mock-fidelity
    device): a ZA-only user was shown MZ and KE, which reads as two countries
    granted out of nowhere. Everything absent from this table routes to approval
    by definition, so the fiction bought nothing.
    """
    internal = effective_internal_countries(db, user)
    external = effective_external_countries(db, user)
    explicit = set(user.internal_pub_countries or [])
    # Attribute a profile-granted country to the profile that actually contains
    # it, not merely to the first profile the user holds.
    held = {
        p.name: set(p.countries or [])
        for p in db.query(Profile).filter(Profile.name.in_(user.profiles or [])).all()
    }

    def source_for(code: str) -> str:
        if code in explicit:
            return "Explicit"
        granting = [name for name in (user.profiles or []) if code in held.get(name, ())]
        return " · ".join(granting) if granting else "—"

    codes: list[str] = []
    for c in sorted(internal) + sorted(external):
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
        subscriptions=[
            schemas.SubscriptionOut.model_validate(s)
            for s in sorted(user.subscriptions, key=lambda s: s.created_at)
        ],
        perimeter=_perimeter_rows(db, user),
        stats=_stats(db, user),
    )


# --------------------------------------------------------------------------- #
# Notification subscriptions (self-service; spec §4.5)
# --------------------------------------------------------------------------- #
@router.get("/me/subscriptions", response_model=list[schemas.SubscriptionOut])
def list_my_subscriptions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.user_id == user.id)
        .order_by(NotificationSubscription.created_at)
        .all()
    )
    return [schemas.SubscriptionOut.model_validate(s) for s in rows]


@router.patch("/me/notifications", response_model=schemas.UserPublic)
def update_my_notification_prefs(
    body: schemas.NotificationPrefs,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """The global email switch, and the way back from it.

    Someone who used "stop all" from an email link has to be able to undo that
    without finding another email, so the profile owns the same flag."""
    user.email_opt_out = bool(body.email_opt_out)
    db.commit()
    db.refresh(user)
    return schemas.UserPublic.model_validate(user)


@router.post("/me/subscriptions", response_model=schemas.SubscriptionOut, status_code=status.HTTP_201_CREATED)
def create_my_subscription(
    body: schemas.SubscriptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sub = _apply_subscription(NotificationSubscription(user_id=user.id), body.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return schemas.SubscriptionOut.model_validate(sub)


@router.patch("/me/subscriptions/{sub_id}", response_model=schemas.SubscriptionOut)
def update_my_subscription(
    sub_id: str,
    body: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sub = db.get(NotificationSubscription, sub_id)
    if not sub or sub.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    _apply_subscription(sub, body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(sub)
    return schemas.SubscriptionOut.model_validate(sub)


@router.delete("/me/subscriptions/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_subscription(
    sub_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    sub = db.get(NotificationSubscription, sub_id)
    if not sub or sub.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    db.delete(sub)
    db.commit()
