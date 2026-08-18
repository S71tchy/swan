"""Registration email-domain policy.

SWAN is an internal tool, so accounts are meant to live on corporate addresses.
A Rights Manager keeps a list of blocked domain patterns (Settings → Email
domains) and every path that *creates* an account checks it: self-service
registration from the login screen, admin user creation, and an admin changing
an existing user's email.

Four things here are deliberate.

**A pattern with no wildcard blocks the domain and every subdomain of it** —
`gmail.com` also refuses `x@mail.gmail.com`. Someone who types `gmail.com`
means the provider, not one hostname belonging to it, and a rule that a
subdomain walks around is not a rule. A pattern containing `*` is matched with
`fnmatch` over the whole domain instead, so `*.edu` and `mail.*` do what they
look like.

**Patterns are normalised on the way in** (lower-cased, `@` and any local part
stripped), because the natural thing to type is `@gmail.com` or a whole address
— and because the pattern is the primary key, two spellings of one domain would
otherwise both sit in the list, each looking authoritative.

**Nothing here touches sign-in.** The list is evaluated when an account is
created, never when one authenticates. Blocking a domain must not silently lock
out the accounts already on it: that is a rights decision (deactivate the user),
not a spelling one.

**Inactive rules do not match.** `active` is what lets a manager lift a rule for
an afternoon — onboarding a contractor on a personal address — without deleting
the rule and the note explaining why it existed.
"""
from __future__ import annotations

import re
from fnmatch import fnmatch

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import EmailDomainRule

# What a domain pattern may contain once normalised: labels of letters, digits
# and hyphens, separated by dots, with `*` allowed as a wildcard anywhere.
_PATTERN_OK = re.compile(r"^[a-z0-9.*-]+$")


class PatternError(ValueError):
    """A pattern that cannot be stored — surfaced to the admin as a 422."""


def normalise_pattern(raw: str) -> str:
    """`  @Gmail.COM ` → `gmail.com`; `someone@gmail.com` → `gmail.com`.

    Raises PatternError with a message meant to be shown to the person typing.
    """
    value = (raw or "").strip().lower()
    if "@" in value:
        value = value.rsplit("@", 1)[-1]  # accepts "@gmail.com" and a full address
    value = value.strip().strip(".")
    if not value:
        raise PatternError("Enter a domain, for example gmail.com")
    if not _PATTERN_OK.match(value):
        raise PatternError(
            f"'{raw.strip()}' is not a domain — use letters, digits, dots, hyphens and * only"
        )
    if "." not in value and "*" not in value:
        # A bare label like "gmail" would, under the subdomain rule below, block
        # nothing useful; a bare "com" would block half the internet by accident.
        raise PatternError(
            f"'{value}' is not a full domain — enter something like gmail.com or *.edu"
        )
    return value


def domain_of(email: str) -> str:
    """The domain half of an address, lower-cased. '' when there isn't one."""
    value = (email or "").strip().lower().rstrip(".")
    if "@" not in value:
        return ""
    return value.rsplit("@", 1)[-1].strip()


def matches(domain: str, pattern: str) -> bool:
    """Does `domain` fall under `pattern`? See the module docstring."""
    if not domain or not pattern:
        return False
    if "*" in pattern:
        return fnmatch(domain, pattern)
    return domain == pattern or domain.endswith("." + pattern)


def active_rules(db: Session) -> list[EmailDomainRule]:
    return (
        db.query(EmailDomainRule)
        .filter(EmailDomainRule.active.is_(True))
        .order_by(EmailDomainRule.pattern)
        .all()
    )


def find_blocking_rule(db: Session, email: str) -> EmailDomainRule | None:
    """The first active rule refusing this address, or None."""
    domain = domain_of(email)
    if not domain:
        return None
    for rule in active_rules(db):
        if matches(domain, rule.pattern):
            return rule
    return None


def refusal_message(rule: EmailDomainRule, email: str) -> str:
    """What the registrant (or the admin) is told. Names the matched pattern so
    the reason is checkable, and carries the manager's note when there is one."""
    domain = domain_of(email) or "that domain"
    base = (
        f"Addresses at {domain} cannot be used — SWAN accounts need a corporate "
        f"email address (blocked by the rule '{rule.pattern}')."
    )
    return f"{base} {rule.note.strip()}" if rule.note.strip() else base


def assert_allowed(db: Session, email: str) -> None:
    """Raise 422 when the address is on a blocked domain. The single gate every
    account-creating path calls — keep it that way rather than re-deriving the
    match at each call site."""
    rule = find_blocking_rule(db, email)
    if rule is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, refusal_message(rule, email))


# --------------------------------------------------------------------------- #
# The starting list
#
# Seeded into `email_domain_rules` by app.seed (and ops/seed_email_domains.sql
# for Postgres), then owned by Rights Managers — exactly like the gazetteer and
# the taxonomy. It ships non-empty on purpose: an empty policy table means every
# consumer address is accepted, which is the failure this feature exists to stop,
# and "add fifteen rows by hand before the tool behaves" is not a default.
#
# Consumer webmail and disposable-address services only. Nothing here is a guess
# about a partner or a competitor: widening the list past free mail is a decision
# for whoever runs the deployment, taken in the admin screen.
# --------------------------------------------------------------------------- #
DEFAULT_BLOCKED_DOMAINS: list[tuple[str, str]] = [
    ("gmail.com", "Consumer webmail."),
    ("googlemail.com", "Consumer webmail (Gmail alias domain)."),
    ("yahoo.com", "Consumer webmail."),
    ("hotmail.com", "Consumer webmail."),
    ("outlook.com", "Consumer webmail."),
    ("live.com", "Consumer webmail."),
    ("msn.com", "Consumer webmail."),
    ("aol.com", "Consumer webmail."),
    ("icloud.com", "Consumer webmail."),
    ("me.com", "Consumer webmail (iCloud alias domain)."),
    ("protonmail.com", "Consumer webmail."),
    ("proton.me", "Consumer webmail."),
    ("gmx.com", "Consumer webmail."),
    ("mail.com", "Consumer webmail."),
    ("yandex.com", "Consumer webmail."),
    ("qq.com", "Consumer webmail."),
    ("163.com", "Consumer webmail."),
    ("mailinator.com", "Disposable address service."),
    ("yopmail.com", "Disposable address service."),
    ("guerrillamail.com", "Disposable address service."),
]
