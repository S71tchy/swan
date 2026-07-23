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
from app.schemas import DevLoginRequest, PasswordLoginRequest, RegisterRequest, UserPublic
from app.security import COOKIE_NAME, create_session_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

_MIN_PASSWORD_LEN = 6


def _derive_initials(name: str) -> str:
    parts = [p for p in name.replace("—", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


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


@router.post("/password-login", response_model=UserPublic)
def password_login(body: PasswordLoginRequest, response: Response, db: Session = Depends(get_db)):
    """Interim username/password sign-in (email is the username).

    Runs alongside the SSO stub; a real OIDC flow would replace this. The error
    is intentionally generic so it doesn't reveal whether an email exists."""
    email = (body.email or "").strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    _set_session_cookie(response, user)
    return UserPublic.model_validate(user)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Self-service registration from the login screen.

    Creates a **zero-rights** account (no creation, no publication, no profiles,
    no manager flag) with status='pending', so a Rights Manager can see it in the
    admin's Pending filter and configure/validate it. The new user is signed in
    immediately (read-only until validated)."""
    email = (body.email or "").strip().lower()
    name = (body.name or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A valid email is required")
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Your name is required")
    if len(body.password or "") < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Password must be at least {_MIN_PASSWORD_LEN} characters",
        )
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists")

    user = User(
        email=email,
        name=name,
        initials=_derive_initials(name),
        role_label="Awaiting activation",
        password_hash=hash_password(body.password),
        status="pending",
        # Explicit zero-rights: nothing is granted until a Rights Manager reviews.
        can_create=False,
        is_rights_manager=False,
        internal_pub_countries=[],
        external_pub_countries=[],
        client_scope=[],
        profiles=[],
        notify_published=False,
        notify_submitted=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
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
