from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.rights import is_rights_manager
from app.security import COOKIE_NAME, read_session_token


def get_current_user(
    swan_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    if not swan_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = read_session_token(swan_session)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def require_rights_manager(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Gate for the rights-administration API (spec §4.4). Resolves the manager
    role live, so it honours both the explicit flag and a manager-embedding
    profile such as WORLD."""
    if not is_rights_manager(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rights Manager role required")
    return user
