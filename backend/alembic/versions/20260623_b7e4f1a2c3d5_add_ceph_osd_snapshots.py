"""add_ceph_osd_snapshots

Revision ID: b7e4f1a2c3d5
Revises: a1b2c3d4e5f6
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'b7e4f1a2c3d5'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ceph_osd_snapshots',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('osd_id', sa.Integer(), nullable=False),
        sa.Column('utilization', sa.Float(), nullable=True),
        sa.Column('kb_used', sa.BigInteger(), nullable=True),
        sa.Column('kb_total', sa.BigInteger(), nullable=True),
        sa.Column('crush_weight', sa.Float(), nullable=True),
        sa.Column('pgs', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_ceph_osd_snapshots_osd_id', 'ceph_osd_snapshots', ['osd_id'])
    op.create_index('ix_ceph_osd_snapshots_collected_at', 'ceph_osd_snapshots', ['collected_at'])
    op.create_index('ix_ceph_osd_snapshots_osd_collected', 'ceph_osd_snapshots', ['osd_id', 'collected_at'])


def downgrade() -> None:
    op.drop_index('ix_ceph_osd_snapshots_osd_collected', table_name='ceph_osd_snapshots')
    op.drop_index('ix_ceph_osd_snapshots_collected_at', table_name='ceph_osd_snapshots')
    op.drop_index('ix_ceph_osd_snapshots_osd_id', table_name='ceph_osd_snapshots')
    op.drop_table('ceph_osd_snapshots')
