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
    """Return the user id, or None if the token is missing/invalid/expired."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
