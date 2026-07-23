"""Email notification engine (spec §4.5, §5.6).

- `templates`  — the catalog of template keys and their EN/FR default copy.
- `render`     — `{{token}}` substitution + context builders.
- `mailer`     — SMTP delivery (console fallback when SMTP is unconfigured).
- `service`    — high-level notify_* functions: recipient resolution for
                 subscription broadcasts + direct transactional emails.
"""
