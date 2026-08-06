"""editable taxonomy: categories + industries

Moves the alert category tree and the industry list out of `app/enums.py` and
into tables a Rights Manager owns (Settings → Reference data), the same way the
gazetteer already works.

No data migration is needed for existing alerts: `alerts.category`,
`alerts.sub_category` and `alerts.industry` are plain strings and keep the exact
values they already hold. Seed the new tables from `ops/seed_taxonomy.sql` after
upgrading — until they have rows, `/meta/taxonomy` falls back to the code lists,
so the app keeps working either way.

Revision ID: c1a7f2e40b18
Revises: b3ad85791899
Create Date: 2026-08-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1a7f2e40b18"
down_revision: Union[str, Sequence[str], None] = "b3ad85791899"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "categories",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sub_categories", sa.JSON(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )
    op.create_table(
        "industries",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    """Downgrade schema.

    Dropping these is safe for alerts — they carry their category, sub-category
    and industry as strings, so they keep reading correctly; the vocabulary just
    reverts to the constants in app/enums.py. Any category or industry an
    operator added or renamed after seeding is lost, so take a copy first if it
    matters.
    """
    op.drop_table("industries")
    op.drop_table("categories")
