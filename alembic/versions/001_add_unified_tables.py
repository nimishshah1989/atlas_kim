"""add unified tables

Revision ID: 001
Revises: 
Create Date: 2026-04-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('unified_instruments',
        sa.Column('instrument_id', sa.String(50), nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('source_instrument_id', sa.String(50), nullable=True),
        sa.Column('symbol', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('instrument_type', sa.String(20), nullable=False),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('country', sa.String(10), server_default='IN', nullable=False),
        sa.Column('exchange', sa.String(20), nullable=True),
        sa.Column('benchmarks', postgresql.JSONB(), server_default='[]', nullable=False),
        sa.Column('mf_category', sa.String(50), nullable=True),
        sa.Column('cap_category', sa.String(20), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('listing_date', sa.Date(), nullable=True),
        sa.Column('delisting_date', sa.Date(), nullable=True),
        sa.Column('meta', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('instrument_id', name='pk_unified_instruments'),
    )
    op.create_index('idx_unified_inst_tenant_type', 'unified_instruments', ['tenant_id', 'instrument_type'])
    op.create_index('idx_unified_inst_sector', 'unified_instruments', ['tenant_id', 'sector'])
    op.create_index('idx_unified_inst_active', 'unified_instruments', ['tenant_id', 'is_active'])

    op.create_table('unified_metrics',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('instrument_id', sa.String(50), sa.ForeignKey('unified_instruments.instrument_id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('ret_1d', sa.Double(), nullable=True),
        sa.Column('ret_1w', sa.Double(), nullable=True),
        sa.Column('ret_1m', sa.Double(), nullable=True),
        sa.Column('ret_3m', sa.Double(), nullable=True),
        sa.Column('ret_6m', sa.Double(), nullable=True),
        sa.Column('ret_12m', sa.Double(), nullable=True),
        sa.Column('ret_24m', sa.Double(), nullable=True),
        sa.Column('ret_36m', sa.Double(), nullable=True),
        sa.Column('ema_20', sa.Double(), nullable=True),
        sa.Column('ema_50', sa.Double(), nullable=True),
        sa.Column('ema_200', sa.Double(), nullable=True),
        sa.Column('above_ema_20', sa.Boolean(), nullable=True),
        sa.Column('above_ema_50', sa.Boolean(), nullable=True),
        sa.Column('golden_cross', sa.Boolean(), nullable=True),
        sa.Column('rvol_20d', sa.Double(), nullable=True),
        sa.Column('vol_trend', sa.Double(), nullable=True),
        sa.Column('vol_21d', sa.Double(), nullable=True),
        sa.Column('vol_63d', sa.Double(), nullable=True),
        sa.Column('max_dd_252d', sa.Double(), nullable=True),
        sa.Column('current_dd', sa.Double(), nullable=True),
        sa.Column('rsi_14', sa.Double(), nullable=True),
        sa.Column('macd', sa.Double(), nullable=True),
        sa.Column('macd_signal', sa.Double(), nullable=True),
        sa.Column('pct_from_52w_high', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1d_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1w_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_3m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_6m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_12m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_24m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_36m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1d_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1w_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_1m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_3m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_6m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_12m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_24m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty_36m_momentum', sa.Double(), nullable=True),
        sa.Column('rs_nifty500_3m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty500_12m_rank', sa.Double(), nullable=True),
        sa.Column('rs_sp500_3m_rank', sa.Double(), nullable=True),
        sa.Column('rs_sp500_12m_rank', sa.Double(), nullable=True),
        sa.Column('rs_msci_3m_rank', sa.Double(), nullable=True),
        sa.Column('rs_msci_12m_rank', sa.Double(), nullable=True),
        sa.Column('rs_gold_3m_rank', sa.Double(), nullable=True),
        sa.Column('rs_gold_12m_rank', sa.Double(), nullable=True),
        sa.Column('rs_nifty_persistence', sa.Double(), nullable=True),
        sa.Column('rs_nifty500_persistence', sa.Double(), nullable=True),
        sa.Column('rs_sp500_persistence', sa.Double(), nullable=True),
        sa.Column('rs_msci_persistence', sa.Double(), nullable=True),
        sa.Column('rs_gold_persistence', sa.Double(), nullable=True),
        sa.Column('state', sa.String(20), nullable=True),
        sa.Column('state_stability', sa.Double(), nullable=True),
        sa.Column('frag_score', sa.Double(), nullable=True),
        sa.Column('frag_level', sa.String(20), nullable=True),
        sa.Column('action', sa.String(30), nullable=True),
        sa.Column('action_confidence', sa.Double(), nullable=True),
        sa.Column('narrative', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_unified_metrics'),
        sa.UniqueConstraint('tenant_id', 'instrument_id', 'date', name='uq_unified_metrics'),
    )
    op.create_index('idx_unified_metrics_tenant_date', 'unified_metrics', ['tenant_id', 'date'])
    op.create_index('idx_unified_metrics_tenant_inst', 'unified_metrics', ['tenant_id', 'instrument_id'])
    op.create_index('idx_unified_metrics_tenant_action', 'unified_metrics', ['tenant_id', 'date', 'action'])
    op.create_index('idx_unified_metrics_tenant_state', 'unified_metrics', ['tenant_id', 'date', 'state'])
    op.create_index('idx_unified_metrics_rs3m', 'unified_metrics', ['tenant_id', 'date', 'rs_nifty_3m_rank'])

    op.create_table('unified_market_regime',
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('pct_above_ema_20', sa.Double(), nullable=True),
        sa.Column('pct_above_ema_50', sa.Double(), nullable=True),
        sa.Column('pct_above_ema_200', sa.Double(), nullable=True),
        sa.Column('pct_golden_cross', sa.Double(), nullable=True),
        sa.Column('participation', sa.Double(), nullable=True),
        sa.Column('rs_dispersion', sa.Double(), nullable=True),
        sa.Column('health_score', sa.Double(), nullable=True),
        sa.Column('health_zone', sa.String(20), nullable=True),
        sa.Column('regime', sa.String(30), nullable=True),
        sa.Column('direction', sa.String(20), nullable=True),
        sa.Column('narrative', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('date', 'tenant_id', name='pk_unified_market_regime'),
    )

    op.create_table('unified_sector_breadth',
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('sector', sa.String(100), nullable=False),
        sa.Column('member_count', sa.Integer(), nullable=True),
        sa.Column('median_rs_3m', sa.Double(), nullable=True),
        sa.Column('median_rs_12m', sa.Double(), nullable=True),
        sa.Column('pct_above_ema_50', sa.Double(), nullable=True),
        sa.Column('participation', sa.Double(), nullable=True),
        sa.Column('frag_score', sa.Double(), nullable=True),
        sa.Column('action', sa.String(30), nullable=True),
        sa.Column('action_confidence', sa.Double(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('date', 'tenant_id', 'sector', name='pk_unified_sector_breadth'),
    )
    op.create_index('idx_sector_breadth_tenant_date', 'unified_sector_breadth', ['tenant_id', 'date'])

    op.create_table('unified_mf_lookthrough',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('mf_id', sa.String(50), sa.ForeignKey('unified_instruments.instrument_id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('n_holdings', sa.Integer(), nullable=True),
        sa.Column('staleness_days', sa.Integer(), nullable=True),
        sa.Column('staleness', sa.String(20), nullable=True),
        sa.Column('lt_median_rs', sa.Double(), nullable=True),
        sa.Column('lt_weighted_rs', sa.Double(), nullable=True),
        sa.Column('lt_leader_participation', sa.Double(), nullable=True),
        sa.Column('lt_weak_exposure', sa.Double(), nullable=True),
        sa.Column('lt_action', sa.String(30), nullable=True),
        sa.Column('lt_action_confidence', sa.Double(), nullable=True),
        sa.Column('narrative', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_unified_mf_lookthrough'),
        sa.UniqueConstraint('tenant_id', 'mf_id', 'date', name='uq_unified_mf_lt'),
    )
    op.create_index('idx_mf_lt_tenant_date', 'unified_mf_lookthrough', ['tenant_id', 'date'])

    op.create_table('unified_mf_holdings_detail',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('mf_id', sa.String(50), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('child_id', sa.String(50), sa.ForeignKey('unified_instruments.instrument_id'), nullable=False),
        sa.Column('child_name', sa.String(200), nullable=True),
        sa.Column('weight_pct', sa.Double(), nullable=True),
        sa.Column('child_rs_3m', sa.Double(), nullable=True),
        sa.Column('child_state', sa.String(20), nullable=True),
        sa.Column('child_action', sa.String(30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_unified_mf_holdings_detail'),
        sa.UniqueConstraint('tenant_id', 'mf_id', 'date', 'child_id', name='uq_unified_mf_holdings_detail'),
    )
    op.create_index('idx_mf_holdings_mf_date', 'unified_mf_holdings_detail', ['tenant_id', 'mf_id', 'date'])

    op.create_table('unified_mf_rankings',
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('mf_id', sa.String(50), sa.ForeignKey('unified_instruments.instrument_id'), nullable=False),
        sa.Column('mf_category', sa.String(50), nullable=False),
        sa.Column('nav_rs_rank', sa.Double(), nullable=True),
        sa.Column('lt_quality_score', sa.Double(), nullable=True),
        sa.Column('composite_score', sa.Double(), nullable=True),
        sa.Column('rank_in_category', sa.Integer(), nullable=True),
        sa.Column('total_in_category', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('date', 'tenant_id', 'mf_id', name='pk_unified_mf_rankings'),
    )
    op.create_index('idx_mf_rankings_tenant_date_cat', 'unified_mf_rankings', ['tenant_id', 'date', 'mf_category'])

    op.create_table('unified_pipeline_log',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(50), server_default='default', nullable=False),
        sa.Column('run_date', sa.Date(), nullable=False),
        sa.Column('phase', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('rows_processed', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name='pk_unified_pipeline_log'),
        sa.UniqueConstraint('tenant_id', 'run_date', 'phase', name='uq_pipeline_log'),
    )
    op.create_index('idx_pipeline_log_tenant_date', 'unified_pipeline_log', ['tenant_id', 'run_date'])


def downgrade():
    op.drop_table('unified_pipeline_log')
    op.drop_table('unified_mf_rankings')
    op.drop_table('unified_mf_holdings_detail')
    op.drop_table('unified_mf_lookthrough')
    op.drop_table('unified_sector_breadth')
    op.drop_table('unified_market_regime')
    op.drop_table('unified_metrics')
    op.drop_table('unified_instruments')
