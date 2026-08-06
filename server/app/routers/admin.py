"""Rights & user administration (spec §4.4).

Every endpoint is gated to a Rights Manager and every mutation appends an
immutable audit entry carrying a before/after diff — the profile screen's
promise that "every rights change is audited: actor, before/after diff and
timestamp" is enforced here.

Because effective rights are resolved at read time (see app.rights), editing a
profile's country list propagates instantly to every holder; there is no
point-in-time copy to keep in sync.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import audit, schemas
from app.database import get_db
from app.deps import require_rights_manager
from app.models import (
    Alert,
    Category,
    EmailTemplate,
    Industry,
    NotificationSubscription,
    Place,
    Profile,
    User,
)
from app.notifications import service as notify
from app.notifications.templates import CATALOG, CATALOG_BY_KEY, default_template
from app.reference import COUNTRY_CATALOGUE, country_meta
from app.rights import (
    effective_external_countries,
    effective_internal_countries,
    is_rights_manager,
)
from app.security import hash_password
from app.subscriptions import apply_subscription

_MIN_PASSWORD_LEN = 6

router = APIRouter(prefix="/admin", tags=["admin"])

# Fields whose changes we surface in the audit diff for a user edit.
_USER_AUDITED = (
    "email", "name", "role_label", "home_country", "can_create",
    "is_rights_manager", "internal_pub_countries", "external_pub_countries",
    "client_scope", "profiles", "status",
)

_USER_STATUSES = ("active", "pending")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _validate_countries(codes: list[str] | None) -> list[str]:
    """Normalise to upper-case ISO2 and reject anything outside the catalogue
    (the supported country universe for Phase 1)."""
    out: list[str] = []
    for raw in codes or []:
        code = (raw or "").strip().upper()
        if not code:
            continue
        if code not in COUNTRY_CATALOGUE:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown country code: {code}"
            )
        if code not in out:
            out.append(code)
    return out


def _validate_profiles(db: Session, names: list[str] | None) -> list[str]:
    out: list[str] = []
    for raw in names or []:
        name = (raw or "").strip().upper()
        if not name:
            continue
        if name not in out:
            out.append(name)
    if out:
        existing = {p.name for p in db.query(Profile).filter(Profile.name.in_(out)).all()}
        missing = [n for n in out if n not in existing]
        if missing:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Unknown profile(s): {', '.join(missing)}",
            )
    return out


def _derive_initials(name: str) -> str:
    parts = [p for p in name.replace("—", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _diff(before: dict, after: dict) -> dict:
    """{field: [old, new]} for changed audited fields."""
    return {k: [before[k], after[k]] for k in before if before[k] != after.get(k)}


def _user_snapshot(u: User) -> dict:
    return {
        "email": u.email,
        "name": u.name,
        "role_label": u.role_label,
        "home_country": u.home_country,
        "can_create": u.can_create,
        "is_rights_manager": u.is_rights_manager,
        "internal_pub_countries": list(u.internal_pub_countries or []),
        "external_pub_countries": list(u.external_pub_countries or []),
        "client_scope": list(u.client_scope or []),
        "profiles": list(u.profiles or []),
        "status": u.status,
    }


def _user_row(db: Session, u: User) -> schemas.AdminUserRow:
    authored = db.query(Alert).filter(Alert.author_id == u.id).count()
    return schemas.AdminUserRow(
        id=u.id,
        email=u.email,
        name=u.name,
        initials=u.initials,
        job_title=u.job_title,
        branch=u.branch,
        role_label=u.role_label,
        home_country=u.home_country,
        home_country_name=u.home_country_name,
        phone=u.phone,
        locale=u.locale,
        timezone=u.timezone,
        avatar_gold=u.avatar_gold,
        can_create=u.can_create,
        is_rights_manager=u.is_rights_manager,
        internal_pub_countries=list(u.internal_pub_countries or []),
        external_pub_countries=list(u.external_pub_countries or []),
        client_scope=list(u.client_scope or []),
        profiles=list(u.profiles or []),
        effective_internal=sorted(effective_internal_countries(db, u)),
        effective_external=sorted(effective_external_countries(db, u)),
        is_effective_manager=is_rights_manager(db, u),
        alerts_authored=authored,
        has_password=bool(u.password_hash),
        status=u.status,
    )


def _hash_or_reject(password: str) -> str:
    if len(password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Password must be at least {_MIN_PASSWORD_LEN} characters",
        )
    return hash_password(password)


def _profile_row(db: Session, p: Profile, all_users: list[User] | None = None) -> schemas.ProfileRow:
    users = all_users if all_users is not None else db.query(User).all()
    holders = sum(1 for u in users if p.name in (u.profiles or []))
    return schemas.ProfileRow(
        name=p.name,
        countries=list(p.countries or []),
        embeds_rights_manager=p.embeds_rights_manager,
        holders=holders,
    )


# --------------------------------------------------------------------------- #
# Reference
# --------------------------------------------------------------------------- #
@router.get("/countries", response_model=list[schemas.CountryRef])
def countries(_: User = Depends(require_rights_manager)):
    return [
        schemas.CountryRef(code=code, name=meta["name"], flag=meta["flag"])
        for code, meta in COUNTRY_CATALOGUE.items()
    ]


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
@router.get("/users", response_model=list[schemas.AdminUserRow])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    users = db.query(User).order_by(User.created_at).all()
    return [_user_row(db, u) for u in users]


@router.get("/users/{user_id}", response_model=schemas.AdminUserRow)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_rights_manager),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_row(db, user)


@router.post("/users", response_model=schemas.AdminUserRow, status_code=status.HTTP_201_CREATED)
def create_user(
    body: schemas.AdminUserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with that email already exists")

    home = (body.home_country or "").strip().upper()
    if home and home not in COUNTRY_CATALOGUE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown country code: {home}")

    user = User(
        email=email,
        name=body.name.strip(),
        initials=(body.initials or _derive_initials(body.name))[:3].upper(),
        job_title=body.job_title,
        branch=body.branch,
        role_label=body.role_label,
        home_country=home,
        home_country_name=country_meta(home)["name"] if home else "",
        phone=body.phone,
        locale=body.locale,
        timezone=body.timezone,
        avatar_gold=body.avatar_gold,
        can_create=body.can_create,
        is_rights_manager=body.is_rights_manager,
        internal_pub_countries=_validate_countries(body.internal_pub_countries),
        external_pub_countries=_validate_countries(body.external_pub_countries),
        client_scope=_validate_countries(body.client_scope),
        profiles=_validate_profiles(db, body.profiles),
        password_hash=_hash_or_reject(body.password) if body.password else None,
    )
    db.add(user)
    db.flush()
    audit.record(
        db, actor, "user.created", user.id, target_type="user",
        detail={"email": user.email, "grants": _user_snapshot(user)},
    )
    db.commit()
    db.refresh(user)
    return _user_row(db, user)


@router.patch("/users/{user_id}", response_model=schemas.AdminUserRow)
def update_user(
    user_id: str,
    body: schemas.AdminUserUpdate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    prev_status = user.status
    before = _user_snapshot(user)
    updates = body.model_dump(exclude_unset=True)

    if "email" in updates:
        email = (updates["email"] or "").strip().lower()
        if not email:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email cannot be blank")
        clash = db.query(User).filter(User.email == email, User.id != user.id).first()
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another user already has that email")
        user.email = email
    if "name" in updates and updates["name"] is not None:
        user.name = updates["name"].strip()
    if "initials" in updates and updates["initials"]:
        user.initials = updates["initials"][:3].upper()
    for field in ("job_title", "branch", "role_label", "phone", "locale", "timezone"):
        if field in updates and updates[field] is not None:
            setattr(user, field, updates[field])
    if "home_country" in updates and updates["home_country"] is not None:
        home = updates["home_country"].strip().upper()
        if home and home not in COUNTRY_CATALOGUE:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown country code: {home}")
        user.home_country = home
        user.home_country_name = country_meta(home)["name"] if home else ""
    if "avatar_gold" in updates and updates["avatar_gold"] is not None:
        user.avatar_gold = updates["avatar_gold"]
    if "can_create" in updates and updates["can_create"] is not None:
        user.can_create = updates["can_create"]
    if "internal_pub_countries" in updates:
        user.internal_pub_countries = _validate_countries(updates["internal_pub_countries"])
    if "external_pub_countries" in updates:
        user.external_pub_countries = _validate_countries(updates["external_pub_countries"])
    if "client_scope" in updates:
        user.client_scope = _validate_countries(updates["client_scope"])
    if "profiles" in updates:
        user.profiles = _validate_profiles(db, updates["profiles"])
    if "is_rights_manager" in updates and updates["is_rights_manager"] is not None:
        user.is_rights_manager = updates["is_rights_manager"]
    if "status" in updates and updates["status"] is not None:
        new_status = updates["status"].strip().lower()
        if new_status not in _USER_STATUSES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Unknown status: {new_status}",
            )
        user.status = new_status

    password_changed = False
    if updates.get("password"):
        user.password_hash = _hash_or_reject(updates["password"])
        password_changed = True

    # Safety: a manager cannot revoke their own administration access and lock
    # themselves (and possibly everyone) out mid-session.
    if user.id == actor.id and not is_rights_manager(db, user):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You cannot revoke your own Rights Manager access",
        )

    after = _user_snapshot(user)
    changed = _diff(before, after)
    if password_changed:
        changed["password"] = ["***", "***"]  # recorded, never the value itself
    audit.record(
        db, actor, "user.updated", user.id, target_type="user",
        detail={"changed": changed} if changed else {"changed": {}},
    )
    db.commit()
    db.refresh(user)
    # Email the user when a Rights Manager validates their pending account.
    if prev_status == "pending" and user.status == "active":
        notify.notify_account_activated(db, background, user)
    return _user_row(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == actor.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You cannot delete your own account")
    authored = db.query(Alert).filter(Alert.author_id == user.id).count()
    if authored:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"User has authored {authored} alert(s); reassign or remove them first",
        )
    audit.record(
        db, actor, "user.deleted", user.id, target_type="user",
        detail={"email": user.email, "name": user.name},
    )
    db.delete(user)
    db.commit()


# --------------------------------------------------------------------------- #
# Profiles
# --------------------------------------------------------------------------- #
@router.get("/profiles", response_model=list[schemas.ProfileRow])
def list_profiles(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    profiles = db.query(Profile).order_by(Profile.name).all()
    users = db.query(User).all()
    return [_profile_row(db, p, users) for p in profiles]


@router.post("/profiles", response_model=schemas.ProfileRow, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: schemas.ProfileCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    name = (body.name or "").strip().upper()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Profile name is required")
    if db.get(Profile, name):
        raise HTTPException(status.HTTP_409_CONFLICT, "A profile with that name already exists")
    profile = Profile(
        name=name,
        countries=_validate_countries(body.countries),
        embeds_rights_manager=body.embeds_rights_manager,
    )
    db.add(profile)
    db.flush()
    audit.record(
        db, actor, "profile.created", name, target_type="profile",
        detail={"countries": profile.countries, "embeds_rights_manager": profile.embeds_rights_manager},
    )
    db.commit()
    return _profile_row(db, profile)


@router.patch("/profiles/{name}", response_model=schemas.ProfileRow)
def update_profile(
    name: str,
    body: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    profile = db.get(Profile, name.strip().upper())
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    before = {
        "countries": list(profile.countries or []),
        "embeds_rights_manager": profile.embeds_rights_manager,
    }
    updates = body.model_dump(exclude_unset=True)
    if "countries" in updates:
        profile.countries = _validate_countries(updates["countries"])
    if "embeds_rights_manager" in updates and updates["embeds_rights_manager"] is not None:
        profile.embeds_rights_manager = updates["embeds_rights_manager"]
    after = {
        "countries": list(profile.countries or []),
        "embeds_rights_manager": profile.embeds_rights_manager,
    }
    audit.record(
        db, actor, "profile.updated", profile.name, target_type="profile",
        detail={"changed": _diff(before, after)},
    )
    db.commit()
    return _profile_row(db, profile)


@router.delete("/profiles/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    name: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    profile = db.get(Profile, name.strip().upper())
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    holders = [u.name for u in db.query(User).all() if profile.name in (u.profiles or [])]
    if holders:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Profile is held by {len(holders)} user(s): {', '.join(holders[:5])}"
            + ("…" if len(holders) > 5 else "") + ". Remove it from them first.",
        )
    audit.record(
        db, actor, "profile.deleted", profile.name, target_type="profile",
        detail={"countries": list(profile.countries or [])},
    )
    db.delete(profile)
    db.commit()


# --------------------------------------------------------------------------- #
# Location master (places)
# --------------------------------------------------------------------------- #
def _validate_country(code: str) -> str:
    c = (code or "").strip().upper()
    if c not in COUNTRY_CATALOGUE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown country code: {c or '(blank)'}")
    return c


def _validate_coords(lat: float, lng: float) -> None:
    if not (-90 <= lat <= 90):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Latitude must be between -90 and 90")
    if not (-180 <= lng <= 180):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Longitude must be between -180 and 180")


def _place_usage(all_alerts: list[Alert]) -> dict[str, int]:
    usage: dict[str, int] = {}
    for a in all_alerts:
        for loc in a.locations or []:
            code = loc.get("code")
            if code:
                usage[code] = usage.get(code, 0) + 1
    return usage


def _place_row(p: Place, usage: dict[str, int]) -> schemas.PlaceRow:
    meta = country_meta(p.country)
    return schemas.PlaceRow(
        code=p.code,
        name=p.name,
        country=p.country,
        country_name=meta["name"],
        flag=meta["flag"],
        lat=p.lat,
        lng=p.lng,
        aliases=list(p.aliases or []),
        usage=usage.get(p.code, 0),
    )


@router.get("/places", response_model=list[schemas.PlaceRow])
def list_places(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    places = db.query(Place).order_by(Place.country, Place.name).all()
    usage = _place_usage(db.query(Alert).all())
    return [_place_row(p, usage) for p in places]


@router.post("/places", response_model=schemas.PlaceRow, status_code=status.HTTP_201_CREATED)
def create_place(
    body: schemas.PlaceCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    code = (body.code or "").strip().upper()
    if not code:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A location code is required")
    if db.get(Place, code):
        raise HTTPException(status.HTTP_409_CONFLICT, "A place with that code already exists")
    country = _validate_country(body.country)
    _validate_coords(body.lat, body.lng)
    place = Place(
        code=code,
        name=body.name.strip(),
        country=country,
        lat=body.lat,
        lng=body.lng,
        aliases=[a.strip() for a in (body.aliases or []) if a.strip()],
    )
    db.add(place)
    db.flush()
    audit.record(
        db, actor, "place.created", code, target_type="place",
        detail={"name": place.name, "country": country, "lat": place.lat, "lng": place.lng},
    )
    db.commit()
    return _place_row(place, _place_usage(db.query(Alert).all()))


@router.patch("/places/{code}", response_model=schemas.PlaceRow)
def update_place(
    code: str,
    body: schemas.PlaceUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    place = db.get(Place, code.strip().upper())
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] is not None:
        place.name = updates["name"].strip()
    if "country" in updates and updates["country"] is not None:
        place.country = _validate_country(updates["country"])
    lat = updates.get("lat", place.lat)
    lng = updates.get("lng", place.lng)
    if "lat" in updates or "lng" in updates:
        _validate_coords(lat, lng)
        place.lat = lat
        place.lng = lng
    if "aliases" in updates and updates["aliases"] is not None:
        place.aliases = [a.strip() for a in updates["aliases"] if a.strip()]
    audit.record(db, actor, "place.updated", place.code, target_type="place", detail={"fields": list(updates)})
    db.commit()
    return _place_row(place, _place_usage(db.query(Alert).all()))


@router.delete("/places/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_place(
    code: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    place = db.get(Place, code.strip().upper())
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    usage = _place_usage(db.query(Alert).all()).get(place.code, 0)
    if usage:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{usage} alert(s) reference this place; it stays on those alerts. "
            "Remove it from the master only if it was added in error.",
        )
    audit.record(db, actor, "place.deleted", place.code, target_type="place", detail={"name": place.name})
    db.delete(place)
    db.commit()


# --------------------------------------------------------------------------- #
# Editable taxonomy: categories (+ sub-categories) and industries
#
# `Alert.category`, `Alert.sub_category` and `Alert.industry` are plain strings,
# and `NotificationSubscription.categories` is a JSON list of category *names*.
# Nothing is a foreign key, so the database will not keep these in step for us —
# a rename that only touched the `categories` table would leave every historical
# alert pointing at a name that no longer exists, and would silently stop every
# subscription filtering on the old name from ever matching again. Nobody would
# see an error; people would just quietly stop receiving alerts.
#
# So renames cascade, in the same transaction, and deletes are refused while
# anything still references the value.
# --------------------------------------------------------------------------- #
def _clean_list(values: list[str] | None) -> list[str]:
    """Trim, drop blanks, de-duplicate — preserving the order given."""
    out: list[str] = []
    for v in values or []:
        v = (v or "").strip()
        if v and v not in out:
            out.append(v)
    return out


def _category_usage(alerts: list[Alert]) -> dict[str, int]:
    usage: dict[str, int] = {}
    for a in alerts:
        if a.category:
            usage[a.category] = usage.get(a.category, 0) + 1
    return usage


def _sub_usage(alerts: list[Alert], category: str) -> dict[str, int]:
    usage: dict[str, int] = {}
    for a in alerts:
        if a.category == category and a.sub_category:
            usage[a.sub_category] = usage.get(a.sub_category, 0) + 1
    return usage


def _industry_usage(alerts: list[Alert]) -> dict[str, int]:
    usage: dict[str, int] = {}
    for a in alerts:
        if a.industry:
            usage[a.industry] = usage.get(a.industry, 0) + 1
    return usage


def _subscription_usage(db: Session) -> dict[str, int]:
    usage: dict[str, int] = {}
    for sub in db.query(NotificationSubscription).all():
        for name in sub.categories or []:
            usage[name] = usage.get(name, 0) + 1
    return usage


def _category_row(c: Category, alerts: list[Alert], subs: dict[str, int]) -> schemas.CategoryRow:
    return schemas.CategoryRow(
        name=c.name,
        sub_categories=list(c.sub_categories or []),
        position=c.position,
        usage=_category_usage(alerts).get(c.name, 0),
        sub_usage=_sub_usage(alerts, c.name),
        subscriptions=subs.get(c.name, 0),
    )


def _rename_category(db: Session, old: str, new: str) -> dict[str, int]:
    """Point every stored reference at the new name. Returns what moved."""
    moved_alerts = 0
    for a in db.query(Alert).filter(Alert.category == old).all():
        a.category = new
        moved_alerts += 1
    moved_subs = 0
    for sub in db.query(NotificationSubscription).all():
        names = list(sub.categories or [])
        if old in names:
            # Reassign rather than mutate in place: SQLAlchemy only reliably
            # detects a change to a JSON column when the attribute is set.
            sub.categories = [new if n == old else n for n in names]
            moved_subs += 1
    return {"alerts": moved_alerts, "subscriptions": moved_subs}


@router.get("/categories", response_model=list[schemas.CategoryRow])
def list_categories(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    rows = db.query(Category).order_by(Category.position, Category.name).all()
    alerts = db.query(Alert).all()
    subs = _subscription_usage(db)
    return [_category_row(c, alerts, subs) for c in rows]


@router.post("/categories", response_model=schemas.CategoryRow, status_code=status.HTTP_201_CREATED)
def create_category(
    body: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A category name is required")
    if db.get(Category, name):
        raise HTTPException(status.HTTP_409_CONFLICT, "That category already exists")
    last = db.query(Category).order_by(Category.position.desc()).first()
    category = Category(
        name=name,
        sub_categories=_clean_list(body.sub_categories),
        position=(last.position + 1) if last else 0,
    )
    db.add(category)
    db.flush()
    audit.record(
        db, actor, "category.created", name, target_type="category",
        detail={"sub_categories": category.sub_categories},
    )
    db.commit()
    return _category_row(category, db.query(Alert).all(), _subscription_usage(db))


@router.patch("/categories/{name}", response_model=schemas.CategoryRow)
def update_category(
    name: str,
    body: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    category = db.get(Category, name.strip())
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    updates = body.model_dump(exclude_unset=True)
    detail: dict = {"fields": list(updates)}

    # Sub-category renames are applied before the list is replaced, so that a
    # chip edited in place carries its alerts with it instead of reading as
    # "removed one, added another".
    for old, new in (updates.get("rename_sub") or {}).items():
        old, new = old.strip(), new.strip()
        if not new or old == new:
            continue
        moved = 0
        for a in db.query(Alert).filter(Alert.category == category.name, Alert.sub_category == old).all():
            a.sub_category = new
            moved += 1
        detail.setdefault("sub_renames", {})[old] = {"to": new, "alerts": moved}

    if updates.get("sub_categories") is not None:
        wanted = _clean_list(updates["sub_categories"])
        # Refuse to drop a sub-category that alerts still carry: the alert would
        # keep a value the create form no longer offers, which reads as data rot.
        in_use = _sub_usage(db.query(Alert).all(), category.name)
        dropped = [s for s in (category.sub_categories or []) if s not in wanted and in_use.get(s)]
        if dropped:
            db.rollback()
            listed = ", ".join(f"{s} ({in_use[s]})" for s in dropped)
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Still in use by existing alerts: {listed}. Rename it instead, "
                "or reassign those alerts first.",
            )
        category.sub_categories = wanted

    if updates.get("position") is not None:
        category.position = int(updates["position"])

    new_name = (updates.get("name") or "").strip()
    if new_name and new_name != category.name:
        if db.get(Category, new_name):
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "That category already exists")
        moved = _rename_category(db, category.name, new_name)
        detail["renamed_from"] = category.name
        detail["cascaded"] = moved
        category.name = new_name

    audit.record(db, actor, "category.updated", category.name, target_type="category", detail=detail)
    db.commit()
    return _category_row(category, db.query(Alert).all(), _subscription_usage(db))


@router.delete("/categories/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    name: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    category = db.get(Category, name.strip())
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    usage = _category_usage(db.query(Alert).all()).get(category.name, 0)
    subs = _subscription_usage(db).get(category.name, 0)
    if usage or subs:
        parts = []
        if usage:
            parts.append(f"{usage} alert(s)")
        if subs:
            parts.append(f"{subs} notification subscription(s)")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{' and '.join(parts)} still reference this category. Rename it instead, "
            "or clear those references first.",
        )
    audit.record(db, actor, "category.deleted", category.name, target_type="category", detail={})
    db.delete(category)
    db.commit()


@router.get("/industries", response_model=list[schemas.IndustryRow])
def list_industries(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    rows = db.query(Industry).order_by(Industry.position, Industry.name).all()
    usage = _industry_usage(db.query(Alert).all())
    return [
        schemas.IndustryRow(name=i.name, position=i.position, usage=usage.get(i.name, 0))
        for i in rows
    ]


@router.post("/industries", response_model=schemas.IndustryRow, status_code=status.HTTP_201_CREATED)
def create_industry(
    body: schemas.IndustryCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "An industry name is required")
    if db.get(Industry, name):
        raise HTTPException(status.HTTP_409_CONFLICT, "That industry already exists")
    last = db.query(Industry).order_by(Industry.position.desc()).first()
    industry = Industry(name=name, position=(last.position + 1) if last else 0)
    db.add(industry)
    db.flush()
    audit.record(db, actor, "industry.created", name, target_type="industry", detail={})
    db.commit()
    return schemas.IndustryRow(name=industry.name, position=industry.position, usage=0)


@router.patch("/industries/{name}", response_model=schemas.IndustryRow)
def update_industry(
    name: str,
    body: schemas.IndustryUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    industry = db.get(Industry, name.strip())
    if not industry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Industry not found")
    updates = body.model_dump(exclude_unset=True)
    detail: dict = {"fields": list(updates)}
    if updates.get("position") is not None:
        industry.position = int(updates["position"])
    new_name = (updates.get("name") or "").strip()
    if new_name and new_name != industry.name:
        if db.get(Industry, new_name):
            raise HTTPException(status.HTTP_409_CONFLICT, "That industry already exists")
        moved = 0
        for a in db.query(Alert).filter(Alert.industry == industry.name).all():
            a.industry = new_name
            moved += 1
        detail["renamed_from"] = industry.name
        detail["cascaded"] = {"alerts": moved}
        industry.name = new_name
    audit.record(db, actor, "industry.updated", industry.name, target_type="industry", detail=detail)
    db.commit()
    usage = _industry_usage(db.query(Alert).all()).get(industry.name, 0)
    return schemas.IndustryRow(name=industry.name, position=industry.position, usage=usage)


@router.delete("/industries/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_industry(
    name: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    industry = db.get(Industry, name.strip())
    if not industry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Industry not found")
    usage = _industry_usage(db.query(Alert).all()).get(industry.name, 0)
    if usage:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{usage} alert(s) still use this industry. Rename it instead, "
            "or reassign those alerts first.",
        )
    audit.record(db, actor, "industry.deleted", industry.name, target_type="industry", detail={})
    db.delete(industry)
    db.commit()


# --------------------------------------------------------------------------- #
# User notification subscriptions (Rights Manager editing another user's rules)
# --------------------------------------------------------------------------- #
def _get_user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _get_sub_or_404(db: Session, user_id: str, sub_id: str) -> NotificationSubscription:
    sub = db.get(NotificationSubscription, sub_id)
    if not sub or sub.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    return sub


@router.get("/users/{user_id}/subscriptions", response_model=list[schemas.SubscriptionOut])
def list_user_subscriptions(
    user_id: str, db: Session = Depends(get_db), _: User = Depends(require_rights_manager)
):
    _get_user_or_404(db, user_id)
    rows = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.user_id == user_id)
        .order_by(NotificationSubscription.created_at)
        .all()
    )
    return [schemas.SubscriptionOut.model_validate(s) for s in rows]


@router.post(
    "/users/{user_id}/subscriptions",
    response_model=schemas.SubscriptionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user_subscription(
    user_id: str,
    body: schemas.SubscriptionCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    _get_user_or_404(db, user_id)
    sub = apply_subscription(NotificationSubscription(user_id=user_id), body.model_dump())
    db.add(sub)
    audit.record(db, actor, "subscription.created", user_id, target_type="user", detail={"name": sub.name})
    db.commit()
    db.refresh(sub)
    return schemas.SubscriptionOut.model_validate(sub)


@router.patch("/users/{user_id}/subscriptions/{sub_id}", response_model=schemas.SubscriptionOut)
def update_user_subscription(
    user_id: str,
    sub_id: str,
    body: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    sub = _get_sub_or_404(db, user_id, sub_id)
    apply_subscription(sub, body.model_dump(exclude_unset=True))
    audit.record(db, actor, "subscription.updated", user_id, target_type="user", detail={"id": sub_id})
    db.commit()
    db.refresh(sub)
    return schemas.SubscriptionOut.model_validate(sub)


@router.delete(
    "/users/{user_id}/subscriptions/{sub_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_user_subscription(
    user_id: str,
    sub_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    sub = _get_sub_or_404(db, user_id, sub_id)
    audit.record(db, actor, "subscription.deleted", user_id, target_type="user", detail={"id": sub_id})
    db.delete(sub)
    db.commit()


# --------------------------------------------------------------------------- #
# Email templates (admin editor: EN/FR, overrides, preview, test-send)
# --------------------------------------------------------------------------- #
def _template_locale(db: Session, key: str, locale: str) -> schemas.TemplateLocaleData:
    row = db.get(EmailTemplate, (key, locale))
    if row is not None:
        return schemas.TemplateLocaleData(subject=row.subject, body=row.body, overridden=True)
    d = default_template(key, locale)
    return schemas.TemplateLocaleData(subject=d["subject"], body=d["body"], overridden=False)


def _template_entry(db: Session, cat: dict) -> schemas.TemplateEntry:
    return schemas.TemplateEntry(
        key=cat["key"], label=cat["label"], description=cat["description"],
        kind=cat["kind"], tokens=cat["tokens"],
        en=_template_locale(db, cat["key"], "en"),
        fr=_template_locale(db, cat["key"], "fr"),
    )


def _check_template_ref(key: str, locale: str) -> None:
    if key not in CATALOG_BY_KEY:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown template")
    if locale not in ("en", "fr"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Locale must be en or fr")


@router.get("/templates", response_model=list[schemas.TemplateEntry])
def list_templates(db: Session = Depends(get_db), _: User = Depends(require_rights_manager)):
    return [_template_entry(db, cat) for cat in CATALOG]


@router.patch("/templates/{key}/{locale}", response_model=schemas.TemplateEntry)
def update_template(
    key: str,
    locale: str,
    body: schemas.TemplateUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    _check_template_ref(key, locale)
    row = db.get(EmailTemplate, (key, locale))
    if row is None:
        row = EmailTemplate(key=key, locale=locale)
        db.add(row)
    row.subject = body.subject
    row.body = body.body
    row.updated_by = actor.id
    audit.record(db, actor, "template.updated", f"{key}/{locale}", target_type="template")
    db.commit()
    return _template_entry(db, CATALOG_BY_KEY[key])


@router.delete("/templates/{key}/{locale}", response_model=schemas.TemplateEntry)
def reset_template(
    key: str,
    locale: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    """Remove the override, reverting to the built-in default copy."""
    _check_template_ref(key, locale)
    row = db.get(EmailTemplate, (key, locale))
    if row is not None:
        db.delete(row)
        audit.record(db, actor, "template.reset", f"{key}/{locale}", target_type="template")
        db.commit()
    return _template_entry(db, CATALOG_BY_KEY[key])


@router.post("/templates/{key}/{locale}/preview", response_model=schemas.TemplatePreviewOut)
def preview_template(
    key: str,
    locale: str,
    body: schemas.TemplatePreviewRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_rights_manager),
):
    _check_template_ref(key, locale)
    out = notify.render_preview(db, key, locale, body.subject, body.body)
    return schemas.TemplatePreviewOut(**out)


@router.post("/templates/{key}/{locale}/test", status_code=status.HTTP_202_ACCEPTED)
def test_template(
    key: str,
    locale: str,
    body: schemas.TemplateTestRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    _check_template_ref(key, locale)
    to = (body.to or "").strip() or actor.email
    notify.send_test(db, background, key, locale, body.subject, body.body, to)
    return {"sent_to": to}
