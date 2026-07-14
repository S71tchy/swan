"""Pydantic v2 schemas — the API contract. Field names mirror web/src/types.ts."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Locations
# --------------------------------------------------------------------------- #
class LocationBlock(BaseModel):
    name: str                       # "Lagos — Apapa (NGAPP)"
    code: str = ""                  # UN/LOCODE etc. "NGAPP"
    country: str                    # ISO2 "NG"
    country_name: str = ""
    flag: str = ""                  # emoji placeholder
    lat: float
    lng: float
    modes: list[str] = Field(default_factory=list)   # TransportMode values
    flow: str = "both"              # Flow value


# --------------------------------------------------------------------------- #
# Rights / users
# --------------------------------------------------------------------------- #
class RightsSummary(BaseModel):
    can_create: bool
    is_rights_manager: bool
    internal_countries: list[str]           # resolved (explicit ∪ profiles)
    external_countries: list[str]
    client_scope: list[str]
    profiles: list[str]
    perimeter_label: str


class PerimeterRow(BaseModel):
    country: str
    country_name: str
    flag: str
    source: str          # "Explicit" | "<PROFILE>" | "—"
    internal: bool
    external: bool


class NotificationRules(BaseModel):
    published: bool
    published_area: str
    submitted: bool
    submitted_area: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    initials: str
    job_title: str
    branch: str
    role_label: str
    home_country: str
    home_country_name: str
    phone: str
    locale: str
    timezone: str
    avatar_gold: bool


class UserStats(BaseModel):
    created: int
    published: int
    last_alert: datetime | None


class UserMe(UserPublic):
    rights: RightsSummary
    notifications: NotificationRules
    perimeter: list[PerimeterRow]
    stats: UserStats


# --------------------------------------------------------------------------- #
# Alerts
# --------------------------------------------------------------------------- #
class AlertAuthor(BaseModel):
    id: str
    name: str
    initials: str
    branch: str


class AlertBase(BaseModel):
    title: str
    description: str = ""
    picture_url: str | None = None
    category: str
    sub_category: str = ""
    industry: str | None = None
    severity: str = "info"
    valid_from: date
    valid_to: date | None = None
    impacts: str = ""
    action_plan: str = ""
    locations: list[LocationBlock] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)
    attachments: list[dict] = Field(default_factory=list)
    clients: list[str] = Field(default_factory=list)


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    picture_url: str | None = None
    category: str | None = None
    sub_category: str | None = None
    industry: str | None = None
    severity: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    impacts: str | None = None
    action_plan: str | None = None
    locations: list[LocationBlock] | None = None
    urls: list[str] | None = None
    clients: list[str] | None = None


class ExternalVariant(BaseModel):
    mode: str  # "identical" | "modified" | "none"
    title: str | None = None
    description: str | None = None


class PublishRequest(BaseModel):
    content_confirmed: bool = True
    external: ExternalVariant = ExternalVariant(mode="none")


class RejectRequest(BaseModel):
    comment: str


class AlertOut(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    origin: str
    visibility: str
    external_variant: dict | None = None
    rejection_comment: str | None = None
    author: AlertAuthor
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None = None
    published_at: datetime | None = None
    closed_at: datetime | None = None
    valid_to_label: str  # "until further notice" when valid_to is None


class RoutingInfo(BaseModel):
    countries: list[str]
    covered: list[str]
    uncovered: list[str]
    action: str          # "publish" | "submit"
    can_publish: bool


# --------------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------------- #
class SeverityBreakdown(BaseModel):
    info: int
    watch: int
    warning: int
    critical: int


class DashboardStats(BaseModel):
    active_alerts: int
    severity: SeverityBreakdown
    awaiting_your_approval: int
    countries_affected: int
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class DevLoginRequest(BaseModel):
    # Stub only: pick which seeded identity to sign in as. A real OIDC flow
    # carries no such field — the IdP asserts identity.
    email: str | None = None


class SessionInfo(BaseModel):
    user: UserPublic
