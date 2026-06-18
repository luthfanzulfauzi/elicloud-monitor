"""add_user_data_scope

Revision ID: a1b2c3d4e5f6
Revises: 3e9c2a145bdf
Create Date: 2026-06-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3e9c2a145bdf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('app_users', sa.Column(
        'scope_type', sa.String(), nullable=False, server_default='global'
    ))

    op.create_table(
        'user_project_scope',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'project_id', name='uq_user_project_scope'),
    )
    op.create_index('ix_user_project_scope_user_id', 'user_project_scope', ['user_id'])

    op.create_table(
        'user_resource_group_scope',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('resource_group_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resource_group_id'], ['resource_groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'resource_group_id', name='uq_user_resource_group_scope'),
    )
    op.create_index('ix_user_resource_group_scope_user_id', 'user_resource_group_scope', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_resource_group_scope_user_id', table_name='user_resource_group_scope')
    op.drop_table('user_resource_group_scope')
    op.drop_index('ix_user_project_scope_user_id', table_name='user_project_scope')
    op.drop_table('user_project_scope')
    op.drop_column('app_users', 'scope_type')
