"""custom polygon / radius zones

Adds the `zones` table: the third kind of geography after a point (`places`) and
a whole country. Straits, anchorages and corridors are none of those, and until
now could only be approximated by a pin.

No change to `alerts`: a location block gains `scope="zone"`, a `countries` list
and a copy of the shape, and `alerts.locations` is a JSON column — the same
reason nationwide scope needed no migration. Existing alerts keep loading
unchanged, and blocks without the new keys read as points exactly as before.

Geometry is GeoJSON in a JSON column rather than a PostGIS type, keeping the
PostGIS work a Phase 2 migration as planned. Nothing here needs spatial
indexing: a zone is looked up by code, and its country list is declared rather
than computed from the shape.

Revision ID: a83b1c6d47f2
Revises: f7c3a91e5d20
Create Date: 2026-08-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a83b1c6d47f2"
down_revision: Union[str, Sequence[str], None] = "f7c3a91e5d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "zones",
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("countries", sa.JSON(), nullable=False),
        sa.Column("geometry", sa.JSON(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("radius_m", sa.Float(), nullable=True),
        sa.Column("aliases", sa.JSON(), nullable=False),
        sa.Column("notes", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("code"),
    )
    op.create_index(op.f("ix_zones_name"), "zones", ["name"])


def downgrade() -> None:
    """Downgrade schema.

    Alerts already filed against a zone keep working: each block carries its own
    copy of the name, countries and shape, which is what lets the map draw an
    alert exactly as it was filed even after the master zone changes. What is
    lost is the reusable definition, so the same strait would have to be redrawn
    to be used again.
    """
    op.drop_index(op.f("ix_zones_name"), table_name="zones")
    op.drop_table("zones")
