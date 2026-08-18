"""subscription-driven notifications + global email opt-out

Two changes, one consequence.

`users.email_opt_out` is the global "stop emailing me" switch set from the
unsubscribe landing page, kept separate from pausing individual subscriptions
so it survives the user later adding a new one.

The consequence needs the backfill below. Delivery is now subscription-driven
for *every* trigger, including the ones addressed to one person ("your alert was
rejected", "your account was activated") — previously those bypassed
subscriptions entirely and went out unconditionally. An account with no
subscription covering those events would therefore go silent, so every existing
account is given the same defaults a new one now gets:

  "My activity"       — the participant triggers, for everyone
  "New registrations" — the manager trigger, for Rights Managers only, so that
                        the people who were being mailed unconditionally before
                        keep being mailed, and can now stop it

They are ordinary rows: visible in the profile, pausable, deletable.

Revision ID: f7c3a91e5d20
Revises: e2b5d9f4c331
Create Date: 2026-08-18

"""
import json
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7c3a91e5d20"
down_revision: Union[str, Sequence[str], None] = "e2b5d9f4c331"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Kept as literals rather than imported from the app: a migration has to keep
# meaning what it meant on the day it ran, even after the catalog changes.
PARTICIPANT_EVENTS = [
    "submission_received", "approved", "rejected", "registration_ack", "account_activated",
]
MANAGER_EVENTS = ["user_registered"]
PERSONAL_NAME = "My activity"
REGISTRATIONS_NAME = "New registrations"


def _as_list(value) -> list:
    """JSON columns come back as a list on PostgreSQL and a string on SQLite."""
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except ValueError:
            return []
    return []


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("email_opt_out", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # Which profiles carry the Rights Manager flag, so a manager-by-profile is
    # backfilled too (rights are resolved as the union of both — app/rights.py).
    manager_profiles = {
        row[0]
        for row in conn.execute(
            sa.text("SELECT name FROM profiles WHERE embeds_rights_manager")
        )
    }

    existing: dict[str, set] = {}
    for user_id, events in conn.execute(
        sa.text("SELECT user_id, events FROM notification_subscriptions")
    ):
        existing.setdefault(user_id, set()).update(_as_list(events))

    rows = []
    for user_id, is_manager, profiles in conn.execute(
        sa.text("SELECT id, is_rights_manager, profiles FROM users")
    ):
        held = existing.get(user_id, set())
        if not held & set(PARTICIPANT_EVENTS):
            rows.append((user_id, PERSONAL_NAME, PARTICIPANT_EVENTS))
        manager = bool(is_manager) or bool(set(_as_list(profiles)) & manager_profiles)
        if manager and not held & set(MANAGER_EVENTS):
            rows.append((user_id, REGISTRATIONS_NAME, MANAGER_EVENTS))

    for user_id, name, events in rows:
        conn.execute(
            sa.text(
                "INSERT INTO notification_subscriptions "
                "(id, user_id, name, active, events, countries, profiles, categories, "
                " min_severity, created_at) "
                "VALUES (:id, :user_id, :name, :active, :events, :countries, :profiles, "
                "        :categories, :min_severity, :created_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "name": name,
                "active": True,
                "events": json.dumps(events),
                "countries": json.dumps([]),
                "profiles": json.dumps([]),
                "categories": json.dumps([]),
                "min_severity": "info",
                "created_at": now,
            },
        )


def downgrade() -> None:
    """Downgrade schema.

    Drops the opt-out column and removes the backfilled subscriptions again —
    matched by name and by carrying exactly the default event set, so a rule an
    operator edited afterwards is left alone. Anyone who had globally opted out
    starts receiving email again, which is the unavoidable meaning of removing
    the switch that recorded it.
    """
    conn = op.get_bind()
    for name, events in ((PERSONAL_NAME, PARTICIPANT_EVENTS), (REGISTRATIONS_NAME, MANAGER_EVENTS)):
        for sub_id, stored in conn.execute(
            sa.text("SELECT id, events FROM notification_subscriptions WHERE name = :name"),
            {"name": name},
        ):
            if set(_as_list(stored)) == set(events):
                conn.execute(
                    sa.text("DELETE FROM notification_subscriptions WHERE id = :id"),
                    {"id": sub_id},
                )

    with op.batch_alter_table("users") as batch:
        batch.drop_column("email_opt_out")
