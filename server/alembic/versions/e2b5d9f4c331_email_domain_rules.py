"""blocked email domains for registration / user creation

Adds `email_domain_rules`: the list of domain patterns an account may not be
created on (Settings → Email domains). Nothing references the table, so there is
no data migration — until it has rows the policy simply allows everything, which
is exactly how the app behaved before. Seed it from
`ops/seed_email_domains.sql` after upgrading.

The rules are checked when an account is *created*, never when one signs in, so
upgrading cannot lock out an existing user whose address is on a listed domain.

Revision ID: e2b5d9f4c331
Revises: c1a7f2e40b18
Create Date: 2026-08-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2b5d9f4c331"
down_revision: Union[str, Sequence[str], None] = "c1a7f2e40b18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "email_domain_rules",
        sa.Column("pattern", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("pattern"),
    )


def downgrade() -> None:
    """Downgrade schema.

    Dropping the table only widens who may register; no user, alert or right
    refers to it. Any rule an operator added is lost, so take a copy first.
    """
    op.drop_table("email_domain_rules")
