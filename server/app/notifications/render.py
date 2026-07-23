"""`{{token}}` substitution + context builders for notification emails."""
from __future__ import annotations

import re

from app.config import settings
from app.models import Alert

_TOKEN_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def render(text: str, context: dict) -> str:
    """Replace every {{token}} with context[token] (missing → empty string)."""
    return _TOKEN_RE.sub(lambda m: str(context.get(m.group(1), "")), text or "")


def urls() -> dict[str, str]:
    base = settings.app_base_url.rstrip("/")
    return {
        "app_url": base,
        "alert_url": f"{base}/feed",
        "approvals_url": f"{base}/approvals",
        "admin_url": f"{base}/admin",
        "login_url": f"{base}/login",
    }


def _fmt_date(d) -> str:
    return d.strftime("%d %b %Y") if d else "until further notice"


def _locations_label(alert: Alert) -> str:
    names = []
    for loc in alert.locations or []:
        name = loc.get("name") or loc.get("code") or ""
        if name and name not in names:
            names.append(name)
    return ", ".join(names) or "—"


def alert_context(alert: Alert, recipient_name: str) -> dict:
    """Token context for the alert-centric templates."""
    return {
        "recipient_name": recipient_name or "there",
        "title": alert.title,
        "category": alert.category,
        "sub_category": alert.sub_category or "—",
        "severity": (alert.severity or "info").capitalize(),
        "locations": _locations_label(alert),
        "valid_from": _fmt_date(alert.valid_from),
        "valid_to": _fmt_date(alert.valid_to),
        "impact": alert.impacts or "—",
        "action_plan": alert.action_plan or "—",
        "author": alert.author.name if alert.author else "—",
        "comment": alert.rejection_comment or "—",
        **urls(),
    }
