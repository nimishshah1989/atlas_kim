"""add missing lookthrough and regime columns

Revision ID: 002
Revises: 001
Create Date: 2026-04-23 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Add dominant_sectors to unified_mf_lookthrough
    op.add_column('unified_mf_lookthrough', sa.Column('dominant_sectors', postgresql.JSONB(), nullable=True))

    # Add region to unified_market_regime and update PK
    op.add_column('unified_market_regime', sa.Column('region', sa.String(20), server_default='IN', nullable=False))
    op.drop_constraint('pk_unified_market_regime', 'unified_market_regime', type_='primary')
    op.create_primary_key('pk_unified_market_regime', 'unified_market_regime', ['date', 'tenant_id', 'region'])


def downgrade():
    op.drop_constraint('pk_unified_market_regime', 'unified_market_regime', type_='primary')
    op.create_primary_key('pk_unified_market_regime', 'unified_market_regime', ['date', 'tenant_id'])
    op.drop_column('unified_market_regime', 'region')

    op.drop_column('unified_mf_lookthrough', 'dominant_sectors')
