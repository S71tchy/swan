"""Session token handling for the stubbed-SSO flow.

The 'Sign in with your AGL account' button hits the dev login endpoint, which
issues this signed JWT as an httpOnly cookie. The token shape (sub = user id,
standard exp) matches what a real OIDC id_token exchange would yield, so wiring
a genuine IdP later only changes how the token is *minted*, not how it's read.
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
COOKIE_NAME = "swan_session"


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
