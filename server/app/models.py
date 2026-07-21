"""SQLAlchemy models. Deliberately portable across SQLite (local dev) and
PostgreSQL (target): UUIDs are stored as strings and list/object fields as JSON,
so no PG-only column types are used. Location geometry is kept as plain
lat/lng floats for Phase 1; a PostGIS geometry column is a Phase 2 migration."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, String, Text
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

    # --- Rights model (spec §4.1), four dimensions + manager flag ---
    can_create: Mapped[bool] = mapped_column(Boolean, default=True)
    is_rights_manager: Mapped[bool] = mapped_column(Boolean, default=False)
    # Explicit country lists (union with profile-granted countries at resolve time)
    internal_pub_countries: Mapped[list] = mapped_column(JSON, default=list)
    external_pub_countries: Mapped[list] = mapped_column(JSON, default=list)
    client_scope: Mapped[list] = mapped_column(JSON, default=list)
    # Held profile names (resolved against Profile.countries)
    profiles: Mapped[list] = mapped_column(JSON, default=list)

    # --- Notification subscriptions (spec §4.5) ---
    notify_published: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_published_area: Mapped[str] = mapped_column(String, default="")
    notify_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_submitted_area: Mapped[str] = mapped_column(String, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    alerts: Mapped[list[Alert]] = relationship(back_populates="author")


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
