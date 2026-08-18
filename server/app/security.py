"""Session token handling for the stubbed-SSO flow.

The 'Sign in with your AGL account' button hits the dev login endpoint, which
issues this signed JWT as an httpOnly cookie. The token shape (sub = user id,
standard exp) matches what a real OIDC id_token exchange would yield, so wiring
a genuine IdP later only changes how the token is *minted*, not how it's read.
"""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
COOKIE_NAME = "swan_session"

# --------------------------------------------------------------------------- #
# Password hashing (interim username/password auth alongside the SSO stub).
#
# PBKDF2-HMAC-SHA256 from the stdlib — no compiled dependency. Format is
# self-describing ("pbkdf2_sha256$<iters>$<salt>$<hash>") so the work factor can
# rise over time, and the whole thing is isolated here so swapping in bcrypt /
# argon2 / a real IdP later touches only this file.
# --------------------------------------------------------------------------- #
_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def create_session_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours)
    payload = {"sub": user_id, "exp": expire, "iss": "swan-dev-sso"}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def read_session_token(token: str) -> str | None:
    """Return the user id, or None if the token is missing/invalid/expired.

    Tokens carrying a `purpose` claim are rejected outright. Both token types are
    signed with the same secret, and an unsubscribe token is long-lived and sits
    in the clear inside every email — without this check, lifting one out of a
    forwarded message and pasting it into the session cookie would be a full
    account takeover. Purpose-scoping is what keeps the two apart.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose"):
            return None
        return payload.get("sub")
    except JWTError:
        return None


# --------------------------------------------------------------------------- #
# Unsubscribe tokens
#
# One-click unsubscribe has to work from a phone with no session, months after
# the email was sent, so these are deliberately **not** expiring and carry no
# rights beyond "silence notifications for this user". They are purpose-scoped
# (see read_session_token) so they can never be replayed as a session.
#
# `sid` names the subscription that actually matched, so the landing page can
# say which rule caused the email and switch off only that one.
# --------------------------------------------------------------------------- #
UNSUBSCRIBE_PURPOSE = "unsubscribe"


def create_unsubscribe_token(user_id: str, subscription_id: str | None = None) -> str:
    payload = {"sub": user_id, "purpose": UNSUBSCRIBE_PURPOSE, "iss": "swan"}
    if subscription_id:
        payload["sid"] = subscription_id
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def read_unsubscribe_token(token: str) -> tuple[str, str | None] | None:
    """(user_id, subscription_id|None), or None if the token isn't a valid
    unsubscribe token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose") != UNSUBSCRIBE_PURPOSE:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return user_id, payload.get("sid")
