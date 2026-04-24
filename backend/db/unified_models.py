"""Unified RS Intelligence Engine — SQLAlchemy 2.0 models."""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, Double, Index, Integer,
    Numeric, String, Text, func, text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# ─── Instrument Types ───────────────────────────────────────────────────────

class InstrumentType(str, enum.Enum):
    EQUITY = "EQUITY"
    MF = "MF"
    ETF = "ETF"
    INDEX = "INDEX"
    INDEX_GLOBAL = "INDEX_GLOBAL"
    FX = "FX"
    COMMODITY = "COMMODITY"


class State(str, enum.Enum):
    LEADER = "LEADER"
    EMERGING = "EMERGING"
    WEAKENING = "WEAKENING"
    LAGGING = "LAGGING"
    BASE = "BASE"
    BROKEN = "BROKEN"
    HOLDING = "HOLDING"


class FragLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Action(str, enum.Enum):
    STRONG_ACCUMULATE = "STRONG_ACCUMULATE"
    ACCUMULATE = "ACCUMULATE"
    HOLD = "HOLD"
    REDUCE = "REDUCE"
    EXIT = "EXIT"
    AVOID = "AVOID"


class HealthZone(str, enum.Enum):
    FEAR = "FEAR"
    WEAK = "WEAK"
    NEUTRAL = "NEUTRAL"
    HEALTHY = "HEALTHY"
    BULLISH = "BULLISH"


class Regime(str, enum.Enum):
    BEARISH_ACCUMULATE = "BEARISH_ACCUMULATE"
    CAUTION_DEFENSIVE = "CAUTION_DEFENSIVE"
    CAUTION_SELECTIVE = "CAUTION_SELECTIVE"
    BULLISH_FULL_RISK = "BULLISH_FULL_RISK"


class Direction(str, enum.Enum):
    ACCELERATING = "ACCELERATING"
    IMPROVING = "IMPROVING"
    MIXED = "MIXED"
    WEAKENING = "WEAKENING"
    DETERIORATING = "DETERIORATING"


class Staleness(str, enum.Enum):
    FRESH = "FRESH"
    ACCEPTABLE = "ACCEPTABLE"
    STALE = "STALE"
    VERY_STALE = "VERY_STALE"


class PipelineStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


# ─── Unified Instruments ────────────────────────────────────────────────────

class UnifiedInstrument(Base):
    __tablename__ = "unified_instruments"

    instrument_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    source_instrument_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    instrument_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(10), nullable=False, server_default="IN")
    exchange: Mapped[str | None] = mapped_column(String(20), nullable=True)
    benchmarks: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="[]")
    mf_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cap_category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    listing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delisting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_unified_inst_tenant_type", "tenant_id", "instrument_type"),
        Index("idx_unified_inst_sector", "tenant_id", "sector"),
        Index("idx_unified_inst_active", "tenant_id", "is_active"),
    )


# ─── Unified Metrics (The Wide Table) ───────────────────────────────────────

class UnifiedMetric(Base):
    __tablename__ = "unified_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    instrument_id: Mapped[str] = mapped_column(String(50), ForeignKey("unified_instruments.instrument_id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Returns
    ret_1d: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_1w: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_1m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_6m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_12m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_24m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_36m: Mapped[float | None] = mapped_column(Double, nullable=True)
    ret_ytd: Mapped[float | None] = mapped_column(Double, nullable=True)

    # Trend / EMA
    ema_20: Mapped[float | None] = mapped_column(Double, nullable=True)
    ema_50: Mapped[float | None] = mapped_column(Double, nullable=True)
    ema_200: Mapped[float | None] = mapped_column(Double, nullable=True)
    above_ema_20: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    above_ema_50: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    above_ema_200: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    golden_cross: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Volume
    rvol_20d: Mapped[float | None] = mapped_column(Double, nullable=True)
    vol_trend: Mapped[float | None] = mapped_column(Double, nullable=True)

    # Risk
    vol_21d: Mapped[float | None] = mapped_column(Double, nullable=True)
    vol_63d: Mapped[float | None] = mapped_column(Double, nullable=True)
    max_dd_252d: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_dd: Mapped[float | None] = mapped_column(Double, nullable=True)

    # Technicals
    rsi_14: Mapped[float | None] = mapped_column(Double, nullable=True)
    macd: Mapped[float | None] = mapped_column(Double, nullable=True)
    macd_signal: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_from_52w_high: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS vs Nifty (primary) — 8 periods
    rs_nifty_1d_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_1w_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_1m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_3m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_6m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_12m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_24m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_36m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)

    rs_nifty_1d_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_1w_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_1m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_3m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_6m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_12m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_24m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty_36m_momentum: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS vs Nifty 500
    rs_nifty500_1d_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_1w_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_1m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_3m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_6m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_12m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_24m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_36m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS vs S&P 500
    rs_sp500_1d_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_1w_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_1m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_3m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_6m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_12m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_24m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_36m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS vs MSCI World
    rs_msci_1d_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_1w_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_1m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_3m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_6m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_12m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_24m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_36m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS vs Gold
    rs_gold_1d_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_1w_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_1m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_3m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_6m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_12m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_24m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_36m_rank: Mapped[float | None] = mapped_column(Double, nullable=True)

    # RS Persistence
    rs_nifty_persistence: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_nifty500_persistence: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_sp500_persistence: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_msci_persistence: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_gold_persistence: Mapped[float | None] = mapped_column(Double, nullable=True)

    # State & Action
    state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    state_stability: Mapped[float | None] = mapped_column(Double, nullable=True)
    frag_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    frag_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    action_confidence: Mapped[float | None] = mapped_column(Double, nullable=True)

    # Narrative
    narrative: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "instrument_id", "date", name="uq_unified_metrics"),
        Index("idx_unified_metrics_tenant_date", "tenant_id", "date"),
        Index("idx_unified_metrics_tenant_inst", "tenant_id", "instrument_id"),
        Index("idx_unified_metrics_tenant_action", "tenant_id", "date", "action"),
        Index("idx_unified_metrics_tenant_state", "tenant_id", "date", "state"),
        Index("idx_unified_metrics_rs3m", "tenant_id", "date", "rs_nifty_3m_rank"),
    )


# ─── Unified Market Regime ──────────────────────────────────────────────────

class UnifiedMarketRegime(Base):
    __tablename__ = "unified_market_regime"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default", primary_key=True)
    region: Mapped[str] = mapped_column(String(20), nullable=False, server_default="IN", primary_key=True)

    pct_above_ema_20: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_above_ema_50: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_above_ema_200: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_golden_cross: Mapped[float | None] = mapped_column(Double, nullable=True)
    participation: Mapped[float | None] = mapped_column(Double, nullable=True)
    rs_dispersion: Mapped[float | None] = mapped_column(Double, nullable=True)

    health_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    health_zone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    regime: Mapped[str | None] = mapped_column(String(30), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(20), nullable=True)
    narrative: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Unified Sector Breadth ─────────────────────────────────────────────────

class UnifiedSectorBreadth(Base):
    __tablename__ = "unified_sector_breadth"

    date: Mapped[date] = mapped_column(Date, nullable=False, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default", primary_key=True)
    sector: Mapped[str] = mapped_column(String(100), nullable=False, primary_key=True)

    member_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    median_rs_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    median_rs_12m: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_above_ema_50: Mapped[float | None] = mapped_column(Double, nullable=True)
    participation: Mapped[float | None] = mapped_column(Double, nullable=True)
    frag_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    action_confidence: Mapped[float | None] = mapped_column(Double, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Unified MF Look-Through ────────────────────────────────────────────────

class UnifiedMFLookthrough(Base):
    __tablename__ = "unified_mf_lookthrough"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    mf_id: Mapped[str] = mapped_column(String(50), ForeignKey("unified_instruments.instrument_id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    n_holdings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    staleness_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    staleness: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lt_median_rs: Mapped[float | None] = mapped_column(Double, nullable=True)
    lt_weighted_rs: Mapped[float | None] = mapped_column(Double, nullable=True)
    lt_leader_participation: Mapped[float | None] = mapped_column(Double, nullable=True)
    lt_weak_exposure: Mapped[float | None] = mapped_column(Double, nullable=True)
    lt_action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    lt_action_confidence: Mapped[float | None] = mapped_column(Double, nullable=True)
    narrative: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Extended look-through fields
    lookthrough_rs_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    lookthrough_rs_12m: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_holdings_leader: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_holdings_emerging: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_holdings_broken: Mapped[float | None] = mapped_column(Double, nullable=True)
    top_sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sector_herfindahl: Mapped[float | None] = mapped_column(Double, nullable=True)
    num_holdings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top10_concentration: Mapped[float | None] = mapped_column(Double, nullable=True)
    avg_holding_ret_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    avg_holding_frag_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    cap_large_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    cap_mid_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    cap_small_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    cap_tilt: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dominant_sectors: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "mf_id", "date", name="uq_unified_mf_lt"),
        Index("idx_mf_lt_tenant_date", "tenant_id", "date"),
    )


# ─── Unified MF Holdings Detail ─────────────────────────────────────────────

class UnifiedMFHoldingsDetail(Base):
    __tablename__ = "unified_mf_holdings_detail"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    mf_id: Mapped[str] = mapped_column(String(50), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    child_id: Mapped[str | None] = mapped_column(String(50), ForeignKey("unified_instruments.instrument_id"), nullable=True)
    child_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    weight_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    child_rs_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    child_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    child_action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    isin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    market_value: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    shares_held: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    holding_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_mf_holdings_mf_date", "tenant_id", "mf_id", "date"),
    )


# ─── Unified MF Dominant Sectors ────────────────────────────────────────────

class UnifiedMFDominantSectors(Base):
    __tablename__ = "unified_mf_dominant_sectors"

    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default", primary_key=True)
    mf_id: Mapped[str] = mapped_column(String(50), nullable=False, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, primary_key=True)
    sectors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Unified MF Rankings ────────────────────────────────────────────────────

class UnifiedMFRanking(Base):
    __tablename__ = "unified_mf_rankings"

    date: Mapped[date] = mapped_column(Date, nullable=False, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default", primary_key=True)
    mf_id: Mapped[str] = mapped_column(String(50), ForeignKey("unified_instruments.instrument_id"), nullable=False, primary_key=True)
    mf_category: Mapped[str] = mapped_column(String(50), nullable=False)

    nav_rs_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    lt_quality_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    composite_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    rank_in_category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_in_category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # 6-factor independent percentiles
    factor_momentum_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    factor_quality_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    factor_resilience_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    factor_holdings_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    factor_cost_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    factor_consistency_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    lookthrough_rs_3m: Mapped[float | None] = mapped_column(Double, nullable=True)
    lookthrough_rs_12m: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_holdings_leader: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_holdings_emerging: Mapped[float | None] = mapped_column(Double, nullable=True)
    sector_herfindahl: Mapped[float | None] = mapped_column(Double, nullable=True)
    top10_concentration: Mapped[float | None] = mapped_column(Double, nullable=True)
    cap_tilt: Mapped[str | None] = mapped_column(String(20), nullable=True)
    aum_cr: Mapped[float | None] = mapped_column(Double, nullable=True)
    expense_ratio: Mapped[float | None] = mapped_column(Double, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_mf_rankings_tenant_date_cat", "tenant_id", "date", "mf_category"),
    )


# ─── Unified Pipeline Log ───────────────────────────────────────────────────

class UnifiedPipelineLog(Base):
    __tablename__ = "unified_pipeline_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(50), nullable=False, server_default="default")
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    phase: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    rows_processed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "run_date", "phase", name="uq_pipeline_log"),
        Index("idx_pipeline_log_tenant_date", "tenant_id", "run_date"),
    )
