"""add_ceph_osd_tables

Revision ID: 3e9c2a145bdf
Revises: f85a3d682562
Create Date: 2026-06-14 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3e9c2a145bdf'
down_revision: Union[str, None] = 'f85a3d682562'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'osd_mappings',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('hostname', sa.String(), nullable=False),
        sa.Column('nvme_device', sa.String(), nullable=False),
        sa.Column('osd_id', sa.Integer(), nullable=True),
        sa.Column('size', sa.String(), nullable=True),
        sa.Column('mount_path', sa.String(), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hostname', 'nvme_device', name='uq_osd_mapping_hostname_nvme'),
    )

    op.create_table(
        'ceph_osd_records',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('osd_id', sa.Integer(), nullable=False),
        sa.Column('osd_name', sa.String(), nullable=True),
        sa.Column('kb_total', sa.BigInteger(), nullable=True),
        sa.Column('kb_used', sa.BigInteger(), nullable=True),
        sa.Column('kb_avail', sa.BigInteger(), nullable=True),
        sa.Column('utilization', sa.Float(), nullable=True),
        sa.Column('var', sa.Float(), nullable=True),
        sa.Column('crush_weight', sa.Float(), nullable=True),
        sa.Column('reweight', sa.Float(), nullable=True),
        sa.Column('pgs', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('source_hostname', sa.String(), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('osd_id', name='uq_ceph_osd_id'),
    )

    op.add_column(
        'storage_nodes',
        sa.Column('is_ceph_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('storage_nodes', 'is_ceph_admin')
    op.drop_table('ceph_osd_records')
    op.drop_table('osd_mappings')
