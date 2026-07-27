"""High-level notification orchestration.

Two email classes:
- **Broadcasts** (published/closed/submitted) fan out to users whose active
  subscription matches event ∧ zone ∧ type ∧ criticality, excluding the actor.
- **Transactional** (submission received, approval decision, registration,
  activation) always go to a specific person, bypassing subscriptions.

Recipient resolution + rendering happen in-request (DB available); the actual
SMTP send is scheduled on a BackgroundTasks so the triggering request returns
fast and a mail failure never breaks it.
"""
from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.enums import severity_at_least
from app.models import Alert, EmailTemplate, NotificationSubscription, User
from app.rights import _profile_countries, alert_country_codes, is_rights_manager
from app.notifications import mailer, render
from app.notifications.templates import CATALOG_BY_KEY, default_template

# event -> template key for the broadcast fan-out
_BROADCAST_KEY = {
    "published": "alert_published",
    "closed": "alert_closed",
    "submitted": "alert_submitted",
}


# --------------------------------------------------------------------------- #
# Template loading (DB override falls back to code default, then to English)
# --------------------------------------------------------------------------- #
def load_template(db: Session, key: str, locale: str) -> dict[str, str]:
    locale = locale if locale in ("en", "fr") else "en"
    row = db.get(EmailTemplate, (key, locale))
    if row is None and locale != "en":
        row = db.get(EmailTemplate, (key, "en"))
    if row is not None:
        return {"subject": row.subject, "body": row.body}
    return default_template(key, locale)


def _render_message(db: Session, key: str, locale: str, context: dict) -> tuple[str, str, str]:
    """Return (subject, html, text): subject plain, body rendered to HTML and
    wrapped in the branded shell, plus a plain-text alternative."""
    tpl = load_template(db, key, locale)
    subject = render.render(tpl["subject"], context)
    inner = render.render_html(tpl["body"], context)
    html = render.wrap_html(inner)
    text = render.html_to_text(inner)
    return subject, html, text


def _dispatch(background: BackgroundTasks | None, to: list[str], subject: str, html: str, text: str) -> None:
    to = [t for t in to if t]
    if not to:
        return
    # Attach exactly the flag images this message references (usually 1–3).
    images = render.inline_images(html)
    if background is not None:
        background.add_task(mailer.send_email, to, subject, html, text, images)
    else:
        mailer.send_email(to, subject, html, text, images)


# --------------------------------------------------------------------------- #
# Subscription matching (broadcasts)
# --------------------------------------------------------------------------- #
def _zone_countries(db: Session, sub: NotificationSubscription) -> set[str] | None:
    """Countries this subscription's zone covers, or None for 'any zone'."""
    if not sub.countries and not sub.profiles:
        return None
    codes = {c.upper() for c in (sub.countries or [])}
    codes |= _profile_countries(db, sub.profiles or [])
    return codes


def subscribers_for(db: Session, event: str, alert: Alert, exclude_user_id: str | None) -> list[User]:
    alert_countries = set(alert_country_codes(alert))
    subs = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.active.is_(True))
        .all()
    )
    matched: dict[str, User] = {}
    for sub in subs:
        if sub.user_id == exclude_user_id:
            continue
        if event not in (sub.events or []):
            continue
        zone = _zone_countries(db, sub)
        if zone is not None and not (zone & alert_countries):
            continue
        if sub.categories and alert.category not in sub.categories:
            continue
        if not severity_at_least(alert.severity or "info", sub.min_severity or "info"):
            continue
        if sub.user and sub.user.email:
            matched[sub.user_id] = sub.user
    return list(matched.values())


# --------------------------------------------------------------------------- #
# Public notify_* entry points (called from routers)
# --------------------------------------------------------------------------- #
def notify_alert_broadcast(
    db: Session, background: BackgroundTasks | None, event: str, alert: Alert, actor: User | None
) -> int:
    key = _BROADCAST_KEY[event]
    recipients = subscribers_for(db, event, alert, actor.id if actor else None)
    for u in recipients:
        subject, html, text = _render_message(db, key, u.locale, render.alert_context(alert, u.name))
        _dispatch(background, [u.email], subject, html, text)
    return len(recipients)


def notify_submission_received(db: Session, background: BackgroundTasks | None, alert: Alert) -> None:
    u = alert.author
    if not u or not u.email:
        return
    subject, html, text = _render_message(db, "submission_received", u.locale, render.alert_context(alert, u.name))
    _dispatch(background, [u.email], subject, html, text)


def notify_alert_decision(
    db: Session, background: BackgroundTasks | None, alert: Alert, approved: bool
) -> None:
    u = alert.author
    if not u or not u.email:
        return
    key = "alert_approved" if approved else "alert_rejected"
    subject, html, text = _render_message(db, key, u.locale, render.alert_context(alert, u.name))
    _dispatch(background, [u.email], subject, html, text)


def notify_user_registered(db: Session, background: BackgroundTasks | None, new_user: User) -> None:
    managers = [
        u for u in db.query(User).all()
        if u.id != new_user.id and u.email and is_rights_manager(db, u)
    ]
    for m in managers:
        ctx = {
            "recipient_name": m.name,
            "new_user_name": new_user.name,
            "new_user_email": new_user.email,
            **render.urls(),
        }
        subject, html, text = _render_message(db, "user_registered", m.locale, ctx)
        _dispatch(background, [m.email], subject, html, text)
    # Acknowledge the registrant.
    if new_user.email:
        ctx = {"recipient_name": new_user.name, **render.urls()}
        subject, html, text = _render_message(db, "registration_ack", new_user.locale, ctx)
        _dispatch(background, [new_user.email], subject, html, text)


def notify_account_activated(db: Session, background: BackgroundTasks | None, user: User) -> None:
    if not user.email:
        return
    ctx = {"recipient_name": user.name, "role": user.role_label, **render.urls()}
    subject, html, text = _render_message(db, "account_activated", user.locale, ctx)
    _dispatch(background, [user.email], subject, html, text)


# --------------------------------------------------------------------------- #
# Admin editor helpers (preview + test-send with representative sample data)
# --------------------------------------------------------------------------- #
def sample_context(key: str) -> dict:
    """Representative token values so a manager can preview/test any template."""
    # Two Côte d'Ivoire ports + a Ghana lane, so the flag tokens have something
    # to show in the preview/test.
    sample_locations = [
        {"name": "Abidjan (CIABJ)", "country": "CI", "country_name": "Côte d'Ivoire"},
        {"name": "San-Pédro (CISPY)", "country": "CI", "country_name": "Côte d'Ivoire"},
        {"name": "Tema (GHTEM)", "country": "GH", "country_name": "Ghana"},
    ]
    base = {
        "recipient_name": "Awa Kouassi",
        "title": "Port congestion at Abidjan — 6 day berth delay",
        "category": "Congestion",
        "sub_category": "Port congestion",
        "severity": "Warning",
        "locations": ", ".join(l["name"] for l in sample_locations),
        "flags": render.flags_for(sample_locations),
        "locations_html": render.locations_for(sample_locations),
        "countries": "Côte d'Ivoire, Ghana",
        "countries_html": render.countries_for(sample_locations),
        "valid_from": "23 Jul 2026",
        "valid_to": "until further notice",
        "impact": "Vessels waiting at anchorage; imports delayed ~6 days.",
        "action_plan": "Prioritise reefer offloading; advise clients of the delay.",
        "author": "M. Nunes",
        "comment": "Please add the affected client lanes before resubmitting.",
        "new_user_name": "Tabitha Mwangi",
        "new_user_email": "t.mwangi@aglgroup.com",
        "role": "Field Contributor",
        **render.urls(),
    }
    return base


def render_preview(db: Session, key: str, locale: str, subject: str, body: str) -> dict[str, str]:
    """Render an in-flight (unsaved) subject/HTML body against sample data,
    returning the fully-shelled HTML for the editor's iframe preview."""
    ctx = sample_context(key)
    inner = render.render_html(body, ctx)
    # The iframe preview can't resolve cid:, so embed flags as data: URIs.
    html = render.inline_data_uris(render.wrap_html(inner))
    return {"subject": render.render(subject, ctx), "body": html}


def send_test(db: Session, background: BackgroundTasks | None, key: str, locale: str,
              subject: str, body: str, to_email: str) -> None:
    ctx = sample_context(key)
    inner = render.render_html(body, ctx)
    _dispatch(background, [to_email], render.render(subject, ctx), render.wrap_html(inner), render.html_to_text(inner))
