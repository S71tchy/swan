"""SMTP delivery. Console fallback when SMTP is unconfigured so notifications are
verifiable in dev without a mail server. Never raises — a mail failure must not
break the action that triggered it (sends run in a background task)."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr

from app.config import settings

log = logging.getLogger("swan.mail")


def send_email(to: list[str] | str, subject: str, html: str, text: str | None = None) -> None:
    """Send a multipart/alternative email (plain-text + HTML). `text` falls back
    to the HTML if not supplied (rare)."""
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    text = text or html

    if not settings.smtp_host:
        # Dev fallback: no SMTP configured — surface the email in the console.
        print(
            f"\n===== EMAIL (no SMTP configured) =====\n"
            f"To: {', '.join(recipients)}\nSubject: {subject}\n\n{text}\n"
            f"===== end email =====\n",
            flush=True,
        )
        log.info("email (console) to=%s subject=%r", recipients, subject)
        return

    try:
        # EmailMessage (modern API) RFC 2047-encodes non-ASCII headers (·, —,
        # accents) and sets the body transfer-encoding correctly.
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = ", ".join(recipients)
        msg.set_content(text)                      # plain-text part
        msg.add_alternative(html, subtype="html")  # HTML part
        sender = parseaddr(settings.smtp_from)[1] or settings.smtp_from
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.ehlo()
            # Opportunistic TLS: upgrade only if requested AND the server offers
            # it, so a plaintext relay (e.g. internal port 25) doesn't hard-fail.
            if settings.smtp_starttls:
                if s.has_extn("starttls"):
                    s.starttls()
                    s.ehlo()
                else:
                    log.warning("SMTP_STARTTLS is on but %s doesn't offer STARTTLS — sending unencrypted", settings.smtp_host)
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg, from_addr=sender, to_addrs=recipients)
        log.info("email sent to=%s subject=%r", recipients, subject)
    except Exception:  # noqa: BLE001 — best-effort; log and move on
        log.exception("failed to send email to=%s subject=%r", recipients, subject)
