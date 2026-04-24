"""add_above_ema_200_and_missing_cols

Revision ID: 003
Revises: 002
Create Date: 2026-04-24 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('unified_metrics', sa.Column('above_ema_200', sa.Boolean(), nullable=True))
    op.add_column('unified_metrics', sa.Column('ret_ytd', sa.Double(), nullable=True))


def downgrade():
    op.drop_column('unified_metrics', 'above_ema_200')
    op.drop_column('unified_metrics', 'ret_ytd')
