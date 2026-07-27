"""`{{token}}` substitution, context builders, and the branded HTML email shell.

Templates store HTML for the *body content*; at send time we substitute tokens
(escaping the injected values so user content can't break the layout), then wrap
the result in a branded shell. A plain-text alternative is derived from the HTML
for multipart delivery.
"""
from __future__ import annotations

import base64
import html as _html
import re
from pathlib import Path

from app.config import settings
from app.models import Alert

_TOKEN_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

# Country flags. Email clients don't render SVG (Gmail strips it, Outlook's Word
# engine can't draw it), so the bundled circular SVGs in web/public/flags are
# rasterised to small PNGs here and referenced as `cid:flag-xx`. At send time the
# referenced ones are attached inline to the message (see mailer.add_related);
# for the admin preview they're swapped for data: URIs instead.
_FLAG_DIR = Path(__file__).parent / "assets" / "flags"
_FLAG_CID_RE = re.compile(r"cid:flag-([a-zA-Z]{2})")


class Raw(str):
    """A token value that is already HTML and must not be escaped on insertion.

    Only server-built values are ever wrapped in this — template authors and
    alert content stay escaped, so this can't become an injection route."""

# Branded shell — inline styles + a scoped <style> block, table layout for
# Outlook. The body content is injected at the __BODY__ marker.
_SHELL = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%;}
  .swan-body{font-family:'Segoe UI',Arial,sans-serif;color:#1b365f;font-size:15px;line-height:1.6;}
  .swan-body h1{font-size:22px;}
  .swan-body h1,.swan-body h2,.swan-body h3{color:#1b365f;margin:0 0 10px;font-weight:700;line-height:1.3;}
  .swan-body h2{font-size:18px;}
  .swan-body h3{font-size:15px;text-transform:uppercase;letter-spacing:.5px;color:#6b7688;}
  .swan-body p{margin:0 0 14px;}
  .swan-body a{color:#1b365f;}
  .swan-body ul,.swan-body ol{margin:0 0 14px 20px;padding:0;}
  .swan-body li{margin:0 0 4px;}
  .swan-body blockquote{margin:0 0 14px;padding:10px 14px;border-left:3px solid #eed58e;background:#faf6ea;color:#5a6273;}
  .swan-body .btn,.swan-body a.btn{background:#eed58e;color:#1b365f !important;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:6px;display:inline-block;}
  .swan-body hr{border:none;border-top:1px solid #e2e7ee;margin:18px 0;}
</style></head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(20,30,50,.10);">
      <tr><td style="background:#1b365f;padding:18px 28px;">
        <span style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-weight:700;font-size:20px;letter-spacing:3px;">SWAN</span>
        <span style="color:#8ea3c0;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;">&nbsp;·&nbsp;Strategic Warning &amp; Alert Network</span>
      </td></tr>
      <tr><td class="swan-body" style="padding:28px;">__BODY__</td></tr>
      <tr><td style="background:#f4f6f9;padding:16px 28px;color:#6b7688;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.5;border-top:1px solid #e7ebf1;">
        Internal AGL notification · access is governed by location-based publication rights · all actions are audited.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def render(text: str, context: dict) -> str:
    """Plain substitution (no escaping) — for the subject line and text parts."""
    return _TOKEN_RE.sub(lambda m: str(context.get(m.group(1), "")), text or "")


def render_html(html_template: str, context: dict) -> str:
    """Substitute tokens into an HTML body, HTML-escaping each injected value and
    turning newlines into <br> so multi-line fields (impact, action plan) keep
    their breaks. The template markup itself is left intact."""
    def sub(m: re.Match) -> str:
        val = context.get(m.group(1), "")
        if isinstance(val, Raw):      # server-built markup (flags, chips)
            return str(val)
        return _html.escape(str(val)).replace("\n", "<br>")
    return _TOKEN_RE.sub(sub, html_template or "")


def wrap_html(inner_html: str) -> str:
    """Wrap rendered body content in the branded shell."""
    return _SHELL.replace("__BODY__", inner_html or "")


# --------------------------------------------------------------------------- #
# Country flags (inline PNG, cid-referenced)
# --------------------------------------------------------------------------- #
def has_flag(code: str | None) -> bool:
    cc = (code or "").strip().lower()
    return bool(cc) and (_FLAG_DIR / f"{cc}.png").is_file()


def flag_img(code: str | None, size: int = 18) -> str:
    """<img> for a country's flag, or "" when we don't bundle that flag.

    Width/height are set as attributes *and* inline styles because Outlook
    ignores CSS sizing on images while most webmail ignores the attributes."""
    cc = (code or "").strip().lower()
    if not has_flag(cc):
        return ""
    return (
        f'<img src="cid:flag-{cc}" width="{size}" height="{size}" alt="{cc.upper()}" '
        f'style="width:{size}px;height:{size}px;border:0;border-radius:50%;'
        f'vertical-align:middle;display:inline-block;">'
    )


def inline_images(html: str) -> dict[str, bytes]:
    """{cid: png bytes} for every flag the rendered HTML references, so the
    mailer attaches exactly the flags used (typically 1–3, ~1.3 KB each)."""
    out: dict[str, bytes] = {}
    for cc in {m.group(1).lower() for m in _FLAG_CID_RE.finditer(html or "")}:
        path = _FLAG_DIR / f"{cc}.png"
        if path.is_file():
            out[f"flag-{cc}"] = path.read_bytes()
    return out


def inline_data_uris(html: str) -> str:
    """Swap cid: references for data: URIs — the admin preview renders in an
    iframe, which has no message to resolve cid: against."""
    def sub(m: re.Match) -> str:
        path = _FLAG_DIR / f"{m.group(1).lower()}.png"
        if not path.is_file():
            return m.group(0)
        return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")
    return _FLAG_CID_RE.sub(sub, html or "")


def html_to_text(html_body: str) -> str:
    """Best-effort plain-text alternative from rendered HTML (for multipart)."""
    # Keep image alt text (flags carry the country code) before tags are stripped.
    s = re.sub(r'(?i)<img[^>]*\balt="([^"]*)"[^>]*>', r"\1", html_body or "")
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)<li[^>]*>", "• ", s)
    s = re.sub(r"(?i)</(p|div|h[1-6]|li|tr|blockquote)>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = _html.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


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


def _chip(flag_html: str, label: str) -> str:
    """One "flag + label" unit. nowrap keeps the flag glued to its label when the
    line wraps; margin-right spaces chips without needing a separator."""
    return (
        '<span style="white-space:nowrap;margin:0 14px 4px 0;display:inline-block;">'
        + (flag_html + "&nbsp;" if flag_html else "")
        + _html.escape(label)
        + "</span>"
    )


def _unique_countries(locations: list[dict]) -> list[tuple[str, str]]:
    """[(iso2, display name)] in first-seen order across the given locations."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for loc in locations or []:
        code = (loc.get("country") or "").strip().upper()
        if not code or code in seen:
            continue
        seen.add(code)
        out.append((code, loc.get("country_name") or code))
    return out


def flags_for(locations: list[dict]) -> Raw:
    """A row of just the flag images (one per distinct country)."""
    imgs = [flag_img(code) for code, _ in _unique_countries(locations)]
    return Raw("&nbsp;".join(i for i in imgs if i))


def locations_for(locations: list[dict]) -> Raw:
    """Flag + location-name chips (a flag repeats per location in that country)."""
    chips, seen = [], set()
    for loc in locations or []:
        name = loc.get("name") or loc.get("code") or ""
        if not name or name in seen:
            continue
        seen.add(name)
        chips.append(_chip(flag_img(loc.get("country")), name))
    return Raw("".join(chips) or "—")


def countries_for(locations: list[dict]) -> Raw:
    """Flag + country-name chips (one per distinct country)."""
    chips = [_chip(flag_img(code), name) for code, name in _unique_countries(locations)]
    return Raw("".join(chips) or "—")


def countries_label(locations: list[dict]) -> str:
    return ", ".join(name for _, name in _unique_countries(locations)) or "—"


def alert_context(alert: Alert, recipient_name: str) -> dict:
    """Token context for the alert-centric templates."""
    return {
        "recipient_name": recipient_name or "there",
        "title": alert.title,
        "category": alert.category,
        "sub_category": alert.sub_category or "—",
        "severity": (alert.severity or "info").capitalize(),
        "locations": _locations_label(alert),
        # HTML-valued (Raw) tokens: flags rendered as inline PNGs.
        "flags": flags_for(alert.locations or []),
        "locations_html": locations_for(alert.locations or []),
        "countries": countries_label(alert.locations or []),
        "countries_html": countries_for(alert.locations or []),
        "valid_from": _fmt_date(alert.valid_from),
        "valid_to": _fmt_date(alert.valid_to),
        "impact": alert.impacts or "—",
        "action_plan": alert.action_plan or "—",
        "author": alert.author.name if alert.author else "—",
        "comment": alert.rejection_comment or "—",
        **urls(),
    }
