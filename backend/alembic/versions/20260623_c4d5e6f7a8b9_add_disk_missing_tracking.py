"""add_disk_missing_tracking

Revision ID: c4d5e6f7a8b9
Revises: b7e4f1a2c3d5
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'b7e4f1a2c3d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'disk_health_records',
        sa.Column('is_missing', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'disk_health_records',
        sa.Column('missing_since', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('disk_health_records', 'missing_since')
    op.drop_column('disk_health_records', 'is_missing')
