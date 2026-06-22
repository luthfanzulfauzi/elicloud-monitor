"""add_alert_tables

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # alert_channels
    op.create_table(
        'alert_channels',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('channel_type', sa.String(), nullable=False, server_default='google_chat'),
        sa.Column('webhook_url', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # alert_rules
    op.create_table(
        'alert_rules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('alert_channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('interval_hours', sa.Float(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.UniqueConstraint('channel_id', 'module', 'level', name='uq_alert_rule_channel_module_level'),
    )
    op.create_index('ix_alert_rules_channel_id', 'alert_rules', ['channel_id'])

    # alert_state
    op.create_table(
        'alert_state',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('alert_channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module', sa.String(), nullable=False),
        sa.Column('item_key', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('last_alerted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('first_alerted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('alert_count', sa.Integer(), nullable=False, server_default='1'),
        sa.UniqueConstraint('channel_id', 'module', 'item_key', 'level', name='uq_alert_state_channel_module_item_level'),
    )
    op.create_index('ix_alert_state_channel_id', 'alert_state', ['channel_id'])


def downgrade() -> None:
    op.drop_table('alert_state')
    op.drop_table('alert_rules')
    op.drop_table('alert_channels')
