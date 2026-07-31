"""Pydantic v2 schemas — the API contract. Field names mirror web/src/types.ts."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class SubscriptionBase(BaseModel):
    name: str = ""
    active: bool = True
    events: list[str] = Field(default_factory=list)      # ⊆ published/closed/submitted
    countries: list[str] = Field(default_factory=list)   # ISO2 (zone)
    profiles: list[str] = Field(default_factory=list)    # profile names (zone)
    categories: list[str] = Field(default_factory=list)  # alert categories (type)
    min_severity: str = "info"                           # criticality threshold


class SubscriptionOut(SubscriptionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None
    events: list[str] | None = None
    countries: list[str] | None = None
    profiles: list[str] | None = None
    categories: list[str] | None = None
    min_severity: str | None = None


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
    status: str = "active"


class RegisterRequest(BaseModel):
    """Self-service registration from the login screen. Creates a zero-rights,
    status='pending' account awaiting Rights-Manager validation."""

    name: str
    email: str
    password: str


class UserStats(BaseModel):
    created: int
    published: int
    last_alert: datetime | None


class UserMe(UserPublic):
    rights: RightsSummary
    subscriptions: list[SubscriptionOut]
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


# The alert picture is stored inline in `picture_url` as a `data:` URI (the
# column is a plain string, so this needs no upload endpoint or file storage,
# and swapping to object storage later just changes what string goes in).
# The trade is that the picture ships with every alert payload, so the size
# ceiling is enforced server-side too — the browser already downscales, but the
# API is a public surface and a 50 MB row would degrade the whole feed.
MAX_PICTURE_CHARS = 2_000_000  # ~1.5 MB decoded


def _check_picture(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if len(value) > MAX_PICTURE_CHARS:
        raise ValueError("Picture is too large; upload a smaller image.")
    if not value.startswith(("data:image/", "http://", "https://")):
        raise ValueError("Picture must be an image data URI or an http(s) URL.")
    return value


class AlertBase(BaseModel):
    title: str
    description: str = ""
    picture_url: str | None = None

    _validate_picture = field_validator("picture_url")(_check_picture)
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
    attachments: list[dict] | None = None
    clients: list[str] | None = None

    _validate_picture = field_validator("picture_url")(_check_picture)


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
    # External publication is a separately-granted dimension; the form uses this
    # to decide whether the client-facing options are offered.
    can_publish_external: bool = False
    external_uncovered: list[str] = Field(default_factory=list)


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


class PasswordLoginRequest(BaseModel):
    # Interim username/password sign-in. Email is the username.
    email: str
    password: str


class SessionInfo(BaseModel):
    user: UserPublic


# --------------------------------------------------------------------------- #
# Admin: rights & user administration (spec §4.4)
# --------------------------------------------------------------------------- #
class CountryRef(BaseModel):
    code: str
    name: str
    flag: str


class ProfileRow(BaseModel):
    name: str
    countries: list[str]
    embeds_rights_manager: bool
    holders: int          # how many users currently hold this profile


class ProfileCreate(BaseModel):
    name: str
    countries: list[str] = Field(default_factory=list)
    embeds_rights_manager: bool = False


class ProfileUpdate(BaseModel):
    countries: list[str] | None = None
    embeds_rights_manager: bool | None = None


class AdminUserRow(BaseModel):
    """Full editable view of a user plus resolved (effective) rights so the
    admin table can show reach without re-deriving it client-side."""

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
    # --- raw grants (what the editor writes back) ---
    can_create: bool
    is_rights_manager: bool
    internal_pub_countries: list[str]
    external_pub_countries: list[str]
    client_scope: list[str]
    profiles: list[str]
    # --- resolved (explicit ∪ profiles), for display only ---
    effective_internal: list[str]
    effective_external: list[str]
    is_effective_manager: bool
    alerts_authored: int
    has_password: bool
    status: str


class AdminUserCreate(BaseModel):
    email: str
    name: str
    initials: str | None = None       # derived from name when omitted
    job_title: str = ""
    branch: str = ""
    role_label: str = "Field Contributor"
    home_country: str = ""
    phone: str = ""
    locale: str = "en"
    timezone: str = "UTC"
    avatar_gold: bool = False
    can_create: bool = True
    is_rights_manager: bool = False
    internal_pub_countries: list[str] = Field(default_factory=list)
    external_pub_countries: list[str] = Field(default_factory=list)
    client_scope: list[str] = Field(default_factory=list)
    profiles: list[str] = Field(default_factory=list)
    password: str | None = None       # optional initial password


class AdminUserUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    initials: str | None = None
    job_title: str | None = None
    branch: str | None = None
    role_label: str | None = None
    home_country: str | None = None
    phone: str | None = None
    locale: str | None = None
    timezone: str | None = None
    avatar_gold: bool | None = None
    can_create: bool | None = None
    is_rights_manager: bool | None = None
    internal_pub_countries: list[str] | None = None
    external_pub_countries: list[str] | None = None
    client_scope: list[str] | None = None
    profiles: list[str] | None = None
    password: str | None = None       # set/reset password when non-empty
    status: str | None = None         # "active" to validate a pending registrant


# --------------------------------------------------------------------------- #
# Location master (gazetteer)
# --------------------------------------------------------------------------- #
class PlaceRow(BaseModel):
    code: str
    name: str
    country: str
    country_name: str
    flag: str
    lat: float
    lng: float
    aliases: list[str]
    usage: int          # how many alerts reference this place code


class PlaceCreate(BaseModel):
    code: str
    name: str
    country: str
    lat: float
    lng: float
    aliases: list[str] = Field(default_factory=list)


class PlaceUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    aliases: list[str] | None = None


# --------------------------------------------------------------------------- #
# Email templates (admin editor)
# --------------------------------------------------------------------------- #
class TemplateLocaleData(BaseModel):
    subject: str
    body: str
    overridden: bool     # True if a DB override exists (else showing code default)


class TemplateEntry(BaseModel):
    key: str
    label: str
    description: str
    kind: str            # "broadcast" | "transactional"
    tokens: list[str]
    en: TemplateLocaleData
    fr: TemplateLocaleData


class TemplateUpdate(BaseModel):
    subject: str
    body: str


class TemplatePreviewRequest(BaseModel):
    subject: str
    body: str


class TemplatePreviewOut(BaseModel):
    subject: str
    body: str


class TemplateTestRequest(BaseModel):
    subject: str
    body: str
    to: str | None = None   # defaults to the requesting manager's email
