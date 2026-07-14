"""Authentication.

Phase 1 uses a *stubbed* SSO: the login endpoint signs a session for a seeded
user without a real IdP round-trip. The seam for real OIDC is isolated here —
`POST /auth/login` would be replaced by a redirect to the IdP and a
`/auth/callback` that exchanges the code, then mints the identical session
cookie. Nothing downstream changes.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import DevLoginRequest, UserPublic
from app.security import COOKIE_NAME, create_session_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user: User) -> None:
    token = create_session_token(user.id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # dev over http; set True behind TLS
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )


@router.post("/login", response_model=UserPublic)
def login(body: DevLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Stubbed 'Sign in with your AGL account'.

    With no email, signs in as the default demo contributor. Passing an email
    lets the demo switch between seeded identities of differing rights so the
    Submit-vs-Publish and approval flows can be exercised end to end.
    """
    if body.email:
        user = db.query(User).filter(User.email == body.email).first()
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such seeded user")
    else:
        user = db.query(User).order_by(User.created_at).first()
        if not user:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No users seeded")

    _set_session_cookie(response, user)
    return UserPublic.model_validate(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/accounts", response_model=list[UserPublic])
def list_accounts(db: Session = Depends(get_db)):
    """Dev-only: seeded identities available for the demo account switcher."""
    users = db.query(User).order_by(User.created_at).all()
    return [UserPublic.model_validate(u) for u in users]


@router.get("/session", response_model=UserPublic)
def session(user: User = Depends(get_current_user)):
    return UserPublic.model_validate(user)
