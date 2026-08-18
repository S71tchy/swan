"""High-level notification orchestration.

**Every** email is subscription-driven, including the ones addressed to a single
person. How the recipient is *found* still differs by the trigger's `audience`
(declared in notifications.templates):

- `zone` — fan out to whoever's subscription zone matches the alert, minus the actor.
- `participant` — the one person the workflow names (the author, the registrant).
- `managers` — Rights Managers.

but in all three cases the mail only goes out if that recipient holds an active
subscription asking for the trigger, and every message carries an unsubscribe
footer naming the subscription that caused it. This is why a new account is
given default subscriptions (`subscriptions.default_subscriptions`) and why the
migration backfilled every existing one: with no subscription an account is
completely silent, including for the reply to its own submission.

Which filters apply is a property of the *trigger*, not of the subscription:
"rejected" is about your own alert, so filtering it by zone could only ever drop
mail the recipient is waiting for. `event_filters()` decides, `_sub_matches` is
the one place that reads it, and the editor hides what doesn't apply.

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
from app.notifications.templates import CATALOG_BY_EVENT, default_template, event_filters
from app.security import create_unsubscribe_token


def _key_for(event: str) -> str:
    """Template key for a trigger. The catalog owns the mapping, so adding a
    template no longer means editing a lookup table here as well."""
    return CATALOG_BY_EVENT[event]["key"]


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


def _render_message(
    db: Session,
    key: str,
    locale: str,
    context: dict,
    unsubscribe_url: str | None = None,
    reason: str | None = None,
) -> tuple[str, str, str]:
    """Return (subject, html, text): subject plain, body rendered to HTML and
    wrapped in the branded shell, plus a plain-text alternative.

    The unsubscribe footer is added by the *shell*, not by the template body:
    an operator editing copy under /admin/templates cannot delete it by
    accident, a template added later gets it for free, and it stays out of the
    token palette so nobody has to remember to include it.
    """
    tpl = load_template(db, key, locale)
    subject = render.render(tpl["subject"], context)
    inner = render.render_html(tpl["body"], context)
    html = render.wrap_html(inner, unsubscribe_url=unsubscribe_url, reason=reason, locale=locale)
    # Text part from the *body*, not the shell (which would drag in the header
    # and legal line), plus the unsubscribe line with its URL spelled out —
    # stripping tags out of the HTML footer would leave the word "Unsubscribe"
    # with nothing to click.
    text = render.html_to_text(inner)
    if unsubscribe_url:
        text += "\n\n" + render.unsubscribe_text(unsubscribe_url, reason, locale)
    return subject, html, text


def _dispatch(
    background: BackgroundTasks | None,
    to: list[str],
    subject: str,
    html: str,
    text: str,
    headers: dict[str, str] | None = None,
) -> None:
    to = [t for t in to if t]
    if not to:
        return
    # Attach exactly the flag images this message references (usually 1–3).
    images = render.inline_images(html)
    if background is not None:
        background.add_task(mailer.send_email, to, subject, html, text, images, headers)
    else:
        mailer.send_email(to, subject, html, text, images, headers)


def _send_to(
    db: Session,
    background: BackgroundTasks | None,
    user: User,
    event: str,
    context: dict,
    sub: NotificationSubscription | None,
) -> None:
    """Render and dispatch one message, wired for unsubscribe.

    Every send goes through here, so no trigger can ship without a working
    unsubscribe — the thing whose absence trains people to filter a sender into
    a folder instead of tuning what it sends them.
    """
    token = create_unsubscribe_token(user.id, sub.id if sub else None)
    subject, html, text = _render_message(
        db,
        _key_for(event),
        user.locale,
        context,
        unsubscribe_url=render.unsubscribe_page_url(token),
        reason=(sub.name if sub and sub.name else None),
    )
    _dispatch(background, [user.email], subject, html, text, render.unsubscribe_headers(token))


# --------------------------------------------------------------------------- #
# Subscription matching
# --------------------------------------------------------------------------- #
def _zone_countries(db: Session, sub: NotificationSubscription) -> set[str] | None:
    """Countries this subscription's zone covers, or None for 'any zone'."""
    if not sub.countries and not sub.profiles:
        return None
    codes = {c.upper() for c in (sub.countries or [])}
    codes |= _profile_countries(db, sub.profiles or [])
    return codes


def _sub_matches(
    db: Session, sub: NotificationSubscription, event: str, alert: Alert | None
) -> bool:
    """Does this subscription ask for this trigger?

    Filters are applied only where the trigger declares them. A subscription
    holding both "published" and "rejected" therefore filters the first by
    zone/category/severity and delivers the second unconditionally — which is
    the honest reading of "tell me about published alerts in Ghana, and about my
    own rejections".
    """
    if event not in (sub.events or []):
        return False
    filters = event_filters(event)
    if alert is not None:
        if "zone" in filters:
            zone = _zone_countries(db, sub)
            if zone is not None and not (zone & set(alert_country_codes(alert))):
                return False
        if "category" in filters and sub.categories and alert.category not in sub.categories:
            return False
        if "severity" in filters and not severity_at_least(
            alert.severity or "info", sub.min_severity or "info"
        ):
            return False
    return True


def _created_key(sub: NotificationSubscription):
    """Sort key for "oldest subscription wins".

    `created_at` is stored naive by SQLite but is tz-aware on a row the ORM
    created in this session, and Python refuses to compare the two — sorting a
    freshly-added subscription against a loaded one raised TypeError. Everything
    is UTC by convention, so dropping the offset is a normalisation, not a
    conversion.
    """
    dt = sub.created_at
    if dt is None:
        return (1, "")
    return (0, dt.replace(tzinfo=None).isoformat())


def matching_subscription(
    db: Session, user: User | None, event: str, alert: Alert | None = None
) -> NotificationSubscription | None:
    """The subscription that entitles `user` to this trigger, or None.

    Returns the subscription rather than a bool: that is what lets the email say
    which rule caused it, and lets one click switch off exactly that rule.
    """
    if not user or not user.email or user.email_opt_out:
        return None
    for sub in sorted(user.subscriptions or [], key=_created_key):
        if sub.active and _sub_matches(db, sub, event, alert):
            return sub
    return None


def subscribers_for(
    db: Session, event: str, alert: Alert, exclude_user_id: str | None
) -> list[tuple[User, NotificationSubscription]]:
    """(user, the subscription that matched) for a zone broadcast — one row per
    user, so two matching subscriptions still mean one email."""
    subs = (
        db.query(NotificationSubscription)
        .filter(NotificationSubscription.active.is_(True))
        .order_by(NotificationSubscription.created_at)
        .all()
    )
    matched: dict[str, tuple[User, NotificationSubscription]] = {}
    for sub in subs:
        if sub.user_id == exclude_user_id or sub.user_id in matched:
            continue
        if not _sub_matches(db, sub, event, alert):
            continue
        user = sub.user
        if user and user.email and not user.email_opt_out:
            matched[sub.user_id] = (user, sub)
    return list(matched.values())


# --------------------------------------------------------------------------- #
# Public notify_* entry points (called from routers)
# --------------------------------------------------------------------------- #
def notify_alert_broadcast(
    db: Session, background: BackgroundTasks | None, event: str, alert: Alert, actor: User | None
) -> int:
    recipients = subscribers_for(db, event, alert, actor.id if actor else None)
    for user, sub in recipients:
        _send_to(db, background, user, event, render.alert_context(alert, user.name), sub)
    return len(recipients)


def notify_submission_received(db: Session, background: BackgroundTasks | None, alert: Alert) -> None:
    u = alert.author
    sub = matching_subscription(db, u, "submission_received", alert)
    if sub is None:
        return
    _send_to(db, background, u, "submission_received", render.alert_context(alert, u.name), sub)


def notify_alert_decision(
    db: Session, background: BackgroundTasks | None, alert: Alert, approved: bool
) -> None:
    u = alert.author
    event = "approved" if approved else "rejected"
    sub = matching_subscription(db, u, event, alert)
    if sub is None:
        return
    _send_to(db, background, u, event, render.alert_context(alert, u.name), sub)


def notify_user_registered(db: Session, background: BackgroundTasks | None, new_user: User) -> None:
    """Managers who subscribe to registrations, plus the registrant's ack.

    This used to mail *every* Rights Manager unconditionally — no opt-out
    anywhere in the product — which is precisely the mail people end up
    filtering away, taking the alerts with it.
    """
    for m in db.query(User).all():
        if m.id == new_user.id or not is_rights_manager(db, m):
            continue
        sub = matching_subscription(db, m, "user_registered")
        if sub is None:
            continue
        ctx = {
            "recipient_name": m.name,
            "new_user_name": new_user.name,
            "new_user_email": new_user.email,
            **render.urls(),
        }
        _send_to(db, background, m, "user_registered", ctx, sub)

    # Acknowledge the registrant. Their default subscriptions are created with
    # the account, so this lands unless they have already opted out.
    sub = matching_subscription(db, new_user, "registration_ack")
    if sub is not None:
        ctx = {"recipient_name": new_user.name, **render.urls()}
        _send_to(db, background, new_user, "registration_ack", ctx, sub)


def notify_account_activated(db: Session, background: BackgroundTasks | None, user: User) -> None:
    sub = matching_subscription(db, user, "account_activated")
    if sub is None:
        return
    ctx = {"recipient_name": user.name, "role": user.role_label, **render.urls()}
    _send_to(db, background, user, "account_activated", ctx, sub)


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
    returning the fully-shelled HTML for the editor's iframe preview.

    The footer is shown with a dead link so the preview matches what recipients
    actually get — it is part of the message, just not part of the template.
    """
    ctx = sample_context(key)
    inner = render.render_html(body, ctx)
    # Footer shown with a dead link and no subscription name: the preview should
    # match the shape a recipient sees without implying a specific rule.
    html = render.wrap_html(inner, unsubscribe_url="#", locale=locale)
    # The iframe preview can't resolve cid:, so embed flags as data: URIs.
    return {"subject": render.render(subject, ctx), "body": render.inline_data_uris(html)}


def send_test(db: Session, background: BackgroundTasks | None, key: str, locale: str,
              subject: str, body: str, to_email: str) -> None:
    ctx = sample_context(key)
    inner = render.render_html(body, ctx)
    html = render.wrap_html(inner, locale=locale)
    _dispatch(background, [to_email], render.render(subject, ctx), html, render.html_to_text(html))
