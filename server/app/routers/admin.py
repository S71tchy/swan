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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import audit, schemas
from app.database import get_db
from app.deps import require_rights_manager
from app.models import Alert, Place, Profile, User
from app.reference import COUNTRY_CATALOGUE, country_meta
from app.rights import (
    effective_external_countries,
    effective_internal_countries,
    is_rights_manager,
)
from app.security import hash_password

_MIN_PASSWORD_LEN = 6

router = APIRouter(prefix="/admin", tags=["admin"])

# Fields whose changes we surface in the audit diff for a user edit.
_USER_AUDITED = (
    "email", "name", "role_label", "home_country", "can_create",
    "is_rights_manager", "internal_pub_countries", "external_pub_countries",
    "client_scope", "profiles",
)


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
    db: Session = Depends(get_db),
    actor: User = Depends(require_rights_manager),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

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
