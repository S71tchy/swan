"""SMTP delivery. Console fallback when SMTP is unconfigured so notifications are
verifiable in dev without a mail server. Never raises — a mail failure must not
break the action that triggered it (sends run in a background task)."""
from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText
from email.utils import parseaddr

from app.config import settings

log = logging.getLogger("swan.mail")


def send_email(to: list[str] | str, subject: str, body: str) -> None:
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r for r in recipients if r]
    if not recipients:
        return

    if not settings.smtp_host:
        # Dev fallback: no SMTP configured — surface the email in the console.
        print(
            f"\n===== EMAIL (no SMTP configured) =====\n"
            f"To: {', '.join(recipients)}\nSubject: {subject}\n\n{body}\n"
            f"===== end email =====\n",
            flush=True,
        )
        log.info("email (console) to=%s subject=%r", recipients, subject)
        return

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = ", ".join(recipients)
        sender = parseaddr(settings.smtp_from)[1] or settings.smtp_from
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            if settings.smtp_starttls:
                s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.sendmail(sender, recipients, msg.as_string())
        log.info("email sent to=%s subject=%r", recipients, subject)
    except Exception:  # noqa: BLE001 — best-effort; log and move on
        log.exception("failed to send email to=%s subject=%r", recipients, subject)
