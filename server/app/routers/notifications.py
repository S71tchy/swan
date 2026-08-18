"""Unsubscribe endpoints — the only unauthenticated write surface in SWAN.

Everything here is reached from a link inside an email, so there is no session:
authorisation is the signed token itself (see security.create_unsubscribe_token),
which is purpose-scoped so it can never be replayed as a login, and which grants
nothing beyond silencing notifications for the user it names.

The split between GET and POST is the important part. Corporate link-scanners
and Outlook's preview fetcher issue a GET against every URL in a message; if a
GET unsubscribed, people would be unsubscribed by their own security appliance
without ever seeing the mail. So:

  POST /preview   — describes what the token refers to (the landing page calls
                    this; a scanner doing GET learns nothing and changes nothing)
  POST /          — performs the change, from a button the human pressed
  POST /one-click — RFC 8058: what Gmail/Outlook POST when someone uses the
                    client's own Unsubscribe button. It is unavoidably a
                    one-shot action, so it takes the narrowest one available:
                    pause the subscription that caused this email, never the
                    global opt-out.

`resume` exists because one-click has no confirmation step: getting back is a
link away rather than an email to a Rights Manager.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app import audit, schemas
from app.database import get_db
from app.models import NotificationSubscription, User
from app.notifications.templates import CATALOG_BY_EVENT
from app.security import read_unsubscribe_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _resolve(db: Session, token: str) -> tuple[User, NotificationSubscription | None]:
    parsed = read_unsubscribe_token(token or "")
    if parsed is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This unsubscribe link is not valid.")
    user_id, sub_id = parsed
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This account no longer exists.")
    sub = None
    if sub_id:
        sub = db.get(NotificationSubscription, sub_id)
        # A subscription deleted since the email was sent is not an error: the
        # link still works, it just falls back to the account-wide choices.
        if sub is not None and sub.user_id != user.id:
            sub = None
    return user, sub


def _describe(sub: NotificationSubscription | None) -> str | None:
    """Human summary of what a subscription covers, for the landing page.

    Zone and type are appended only when some trigger on the subscription
    actually uses them — telling someone their rejection notices are scoped to
    "any zone, all types" describes a filter that was never applied.
    """
    if sub is None:
        return None
    events = [e for e in (sub.events or []) if e in CATALOG_BY_EVENT]
    labels = " · ".join(CATALOG_BY_EVENT[e]["label"] for e in events) or "No triggers"
    if not any(CATALOG_BY_EVENT[e]["filters"] for e in events):
        return labels
    zone = ", ".join([*(sub.profiles or []), *(sub.countries or [])]) or "any zone"
    kinds = ", ".join(sub.categories or []) or "all types"
    return f"{labels} — {zone} — {kinds} — {sub.min_severity} and above"


def _state(user: User, sub: NotificationSubscription | None) -> schemas.UnsubscribeState:
    return schemas.UnsubscribeState(
        recipient_name=user.name,
        email=user.email,
        opted_out=user.email_opt_out,
        subscription_id=sub.id if sub else None,
        subscription_name=(sub.name or "Untitled") if sub else None,
        subscription_active=sub.active if sub else None,
        subscription_summary=_describe(sub),
        active_subscriptions=sum(1 for s in user.subscriptions or [] if s.active),
    )


@router.post("/unsubscribe/preview", response_model=schemas.UnsubscribeState)
def preview(body: schemas.UnsubscribeToken, db: Session = Depends(get_db)):
    """What this link refers to. Read-only, and a POST so that fetching the
    landing page can never look like acting on it."""
    user, sub = _resolve(db, body.token)
    return _state(user, sub)


@router.post("/unsubscribe", response_model=schemas.UnsubscribeState)
def unsubscribe(body: schemas.UnsubscribeRequest, db: Session = Depends(get_db)):
    user, sub = _resolve(db, body.token)
    scope = body.scope

    if scope == "all":
        user.email_opt_out = True
        detail = {"scope": "all"}
    elif scope == "resume":
        # Undo both, so one button restores whatever the last click did.
        user.email_opt_out = False
        if sub is not None:
            sub.active = True
        detail = {"scope": "resume", "subscription": sub.name if sub else None}
    else:
        if sub is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "That subscription no longer exists — you can still stop all alert emails.",
            )
        sub.active = False
        detail = {"scope": "subscription", "subscription": sub.name}

    # Audited like any other change to what someone receives, with the actor
    # recorded as the user themselves — they are the one who clicked.
    audit.record(db, user, "notification.unsubscribed", user.id, target_type="user", detail=detail)
    db.commit()
    db.refresh(user)
    return _state(user, sub)


@router.post("/unsubscribe/one-click", include_in_schema=False)
async def one_click(request: Request, token: str = "", db: Session = Depends(get_db)):
    """RFC 8058 target for the mail client's own Unsubscribe button.

    Deliberately narrow: it pauses the subscription that produced the message,
    and only falls back to the global opt-out when the token names no
    subscription. A mail client pressing this has no way to ask the user which
    they meant, so it must not be the destructive reading.

    Always answers 200 — a mail provider that sees an error may mark the sender
    as not honouring unsubscribes, which is worse than a no-op.
    """
    parsed = read_unsubscribe_token(token or "")
    if parsed is None:
        return Response(status_code=status.HTTP_200_OK, content="Invalid link.", media_type="text/plain")
    await request.body()  # RFC 8058 sends List-Unsubscribe=One-Click; we don't need it
    user, sub = _resolve(db, token)
    if sub is not None:
        sub.active = False
        detail = {"scope": "subscription", "subscription": sub.name, "via": "one-click"}
    else:
        user.email_opt_out = True
        detail = {"scope": "all", "via": "one-click"}
    audit.record(db, user, "notification.unsubscribed", user.id, target_type="user", detail=detail)
    db.commit()
    return Response(status_code=status.HTTP_200_OK, content="You have been unsubscribed.", media_type="text/plain")
