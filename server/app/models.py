"""SQLAlchemy models. Deliberately portable across SQLite (local dev) and
PostgreSQL (target): UUIDs are stored as strings and list/object fields as JSON,
so no PG-only column types are used. Location geometry is kept as plain
lat/lng floats for Phase 1; a PostGIS geometry column is a Phase 2 migration."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    """A named, centrally managed bundle of location rights (spec §4.2).
    Assigning a profile grants its full country list; editing the profile
    propagates to every holder because rights are resolved at read time."""

    __tablename__ = "profiles"

    name: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. WEST-AFRICA
    countries: Mapped[list] = mapped_column(JSON, default=list)  # ISO2 codes
    embeds_rights_manager: Mapped[bool] = mapped_column(Boolean, default=False)


class Place(Base):
    """Location master data (gazetteer). Phase 1 seeds a curated set of ports,
    cities and borders; a Rights Manager can add/edit entries, and the create
    form can add an ad-hoc place inline. In Phase 2 the `/meta/places` lookup is
    swapped for a real geocoder — this table becomes its local cache/overrides.

    `code` is a UN/LOCODE-ish canonical id used to cluster alerts on the map, so
    two alerts on the same port stack into one marker."""

    __tablename__ = "places"

    code: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. NGAPP
    name: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[str] = mapped_column(String(2), index=True)  # ISO2
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    aliases: Mapped[list] = mapped_column(JSON, default=list)  # alternate search terms
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Category(Base):
    """Alert category + its dependent sub-categories (spec §5.2).

    Seeded from `enums.CATEGORIES`, then owned by Rights Managers at runtime —
    exactly like `places`, and for the same reason: operators meet event types
    the original list never anticipated ("Cyber", "Labour dispute") and should
    not need a deploy to record one.

    `name` is the primary key rather than a surrogate id because that is what
    `Alert.category` already stores — Phase 1 keeps these as plain strings, so
    introducing a slug would mean migrating every historical alert. The cost is
    that a rename has to be *cascaded* (see `_rename_category` in routers/admin),
    since the name is also a value inside `NotificationSubscription.categories`.

    `sub_categories` is a plain JSON list rather than its own table: it is only
    ever read as "the children of this category", which is the shape the create
    form and `/meta/taxonomy` both want.
    """

    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String, primary_key=True)
    sub_categories: Mapped[list] = mapped_column(JSON, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)  # display order
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Industry(Base):
    """Industry label offered on an alert.

    The safest of the three editable taxonomies: `Alert.industry` is the only
    thing that references it, so a rename touches alerts and nothing else — no
    subscription filters, no routing, no map behaviour.
    """

    __tablename__ = "industries"

    name: Mapped[str] = mapped_column(String, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    initials: Mapped[str] = mapped_column(String(3))
    job_title: Mapped[str] = mapped_column(String, default="")
    branch: Mapped[str] = mapped_column(String, default="")
    role_label: Mapped[str] = mapped_column(String, default="Field Contributor")
    home_country: Mapped[str] = mapped_column(String(2), default="")  # ISO2
    home_country_name: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[str] = mapped_column(String, default="")
    locale: Mapped[str] = mapped_column(String, default="en")  # culture
    timezone: Mapped[str] = mapped_column(String, default="UTC")
    avatar_gold: Mapped[bool] = mapped_column(Boolean, default=False)
    # Interim password auth (nullable: SSO-only users have no local password).
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)

    # Account lifecycle. "active" is the norm (seeded + admin-created users);
    # "pending" marks a self-registered account that a Rights Manager has not yet
    # reviewed/configured. Orthogonal to rights: a registrant is created with
    # zero rights AND status="pending", which is the signal the admin filters on.
    status: Mapped[str] = mapped_column(String, default="active", index=True)

    # --- Rights model (spec §4.1), four dimensions + manager flag ---
    can_create: Mapped[bool] = mapped_column(Boolean, default=True)
    is_rights_manager: Mapped[bool] = mapped_column(Boolean, default=False)
    # Explicit country lists (union with profile-granted countries at resolve time)
    internal_pub_countries: Mapped[list] = mapped_column(JSON, default=list)
    external_pub_countries: Mapped[list] = mapped_column(JSON, default=list)
    client_scope: Mapped[list] = mapped_column(JSON, default=list)
    # Held profile names (resolved against Profile.countries)
    profiles: Mapped[list] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    alerts: Mapped[list[Alert]] = relationship(back_populates="author")
    subscriptions: Mapped[list[NotificationSubscription]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    picture_url: Mapped[str | None] = mapped_column(String, nullable=True)

    category: Mapped[str] = mapped_column(String)
    sub_category: Mapped[str] = mapped_column(String, default="")
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="info")

    status: Mapped[str] = mapped_column(String, default="draft", index=True)
    origin: Mapped[str] = mapped_column(String, default="human")
    visibility: Mapped[str] = mapped_column(String, default="internal")

    valid_from: Mapped[date] = mapped_column(Date, default=date.today)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)  # None = "until further notice"

    impacts: Mapped[str] = mapped_column(Text, default="")
    action_plan: Mapped[str] = mapped_column(Text, default="")

    # Embedded JSON collections (portable; sufficient for Phase 1 map + detail).
    # locations: [{name, code, country, country_name, flag, lat, lng, modes[], flow}]
    locations: Mapped[list] = mapped_column(JSON, default=list)
    urls: Mapped[list] = mapped_column(JSON, default=list)
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    clients: Mapped[list] = mapped_column(JSON, default=list)

    # External variant captured at publish time (delivery is Phase 3).
    # {mode: "identical"|"modified"|"none", title?, description?}
    external_variant: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    rejection_comment: Mapped[str | None] = mapped_column(String, nullable=True)

    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    author: Mapped[User] = relationship(back_populates="alerts")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class NotificationSubscription(Base):
    """A user's named email-subscription rule (spec §4.5, extended).

    A subscription fires for a broadcast event (published/closed/submitted) when
    the alert matches ALL set filters: zone (countries ∪ profile-countries),
    type (categories) and criticality (severity ≥ min_severity). An empty filter
    means "any". The subscribing user is never emailed about their own action."""

    __tablename__ = "notification_subscriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    events: Mapped[list] = mapped_column(JSON, default=list)       # ⊆ NOTIFICATION_EVENTS
    countries: Mapped[list] = mapped_column(JSON, default=list)    # ISO2 (zone)
    profiles: Mapped[list] = mapped_column(JSON, default=list)     # profile names (zone)
    categories: Mapped[list] = mapped_column(JSON, default=list)   # alert categories (type)
    min_severity: Mapped[str] = mapped_column(String, default="info")  # criticality threshold
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped[User] = relationship(back_populates="subscriptions")


class EmailTemplate(Base):
    """DB override for a notification template, keyed by (template key, locale).

    Code holds the default copy for every key/locale (see app.notifications.
    templates); a row here overrides it. Editing happens in the admin Templates
    screen. Body/subject use `{{token}}` placeholders."""

    __tablename__ = "email_templates"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    locale: Mapped[str] = mapped_column(String, primary_key=True)  # "en" | "fr"
    subject: Mapped[str] = mapped_column(String, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)


class AuditLog(Base):
    """Immutable audit trail (spec §10). Every lifecycle action, rights change,
    and publication decision is appended here with actor, timestamp, diff."""

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    actor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    actor_name: Mapped[str] = mapped_column(String, default="")
    action: Mapped[str] = mapped_column(String)  # e.g. alert.published
    target_type: Mapped[str] = mapped_column(String, default="alert")
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
