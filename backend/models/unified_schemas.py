"""Pydantic v2 request/response schemas for the Unified RS Intelligence Engine."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class CohortType(str, Enum):
    SECTOR = "sector"
    CAP_CATEGORY = "cap_category"
    MF_CATEGORY = "mf_category"
    INSTRUMENT_TYPE = "instrument_type"
    STATE = "state"
    ACTION = "action"
    COUNTRY = "country"
    GLOBAL_SECTOR = "global_sector"


class Benchmark(str, Enum):
    NIFTY = "nifty"
    NIFTY_500 = "nifty500"
    SP_500 = "sp500"
    MSCI = "msci"
    GOLD = "gold"


class Period(str, Enum):
    D1 = "1d"
    W1 = "1w"
    M1 = "1m"
    M3 = "3m"
    M6 = "6m"
    M12 = "12m"
    M24 = "24m"
    M36 = "36m"


class SortDirection(str, Enum):
    ASC = "asc"
    DESC = "desc"


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------


class ResponseMeta(BaseModel):
    data_as_of: Optional[date] = None
    record_count: int = 0
    query_ms: Optional[int] = None
    cache_hit: Optional[bool] = None
    tenant_id: str = "default"


# ---------------------------------------------------------------------------
# Snapshot
# ---------------------------------------------------------------------------


class InstrumentIdentity(BaseModel):
    instrument_id: str
    symbol: str
    name: str
    instrument_type: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: str = "IN"
    exchange: Optional[str] = None
    cap_category: Optional[str] = None
    mf_category: Optional[str] = None
    is_active: bool = True


class MetricSnapshot(BaseModel):
    date: date

    # Returns
    ret_1d: Optional[float] = None
    ret_1w: Optional[float] = None
    ret_1m: Optional[float] = None
    ret_3m: Optional[float] = None
    ret_6m: Optional[float] = None
    ret_12m: Optional[float] = None
    ret_24m: Optional[float] = None
    ret_36m: Optional[float] = None
    ret_ytd: Optional[float] = None

    # Trend
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    above_ema_20: Optional[bool] = None
    above_ema_50: Optional[bool] = None
    above_ema_200: Optional[bool] = None
    golden_cross: Optional[bool] = None

    # Volume
    rvol_20d: Optional[float] = None
    vol_trend: Optional[float] = None

    # Risk
    vol_21d: Optional[float] = None
    vol_63d: Optional[float] = None
    max_dd_252d: Optional[float] = None
    current_dd: Optional[float] = None

    # Technicals
    rsi_14: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    pct_from_52w_high: Optional[float] = None

    # RS vs Nifty — 8 periods
    rs_nifty_1d_rank: Optional[float] = None
    rs_nifty_1w_rank: Optional[float] = None
    rs_nifty_1m_rank: Optional[float] = None
    rs_nifty_3m_rank: Optional[float] = None
    rs_nifty_6m_rank: Optional[float] = None
    rs_nifty_12m_rank: Optional[float] = None
    rs_nifty_24m_rank: Optional[float] = None
    rs_nifty_36m_rank: Optional[float] = None

    # RS vs Nifty — momentum (8 periods)
    rs_nifty_1d_momentum: Optional[float] = None
    rs_nifty_1w_momentum: Optional[float] = None
    rs_nifty_1m_momentum: Optional[float] = None
    rs_nifty_3m_momentum: Optional[float] = None
    rs_nifty_6m_momentum: Optional[float] = None
    rs_nifty_12m_momentum: Optional[float] = None
    rs_nifty_24m_momentum: Optional[float] = None
    rs_nifty_36m_momentum: Optional[float] = None
    rs_nifty_persistence: Optional[float] = None

    # RS vs Nifty 500 — 8 periods
    rs_nifty500_1d_rank: Optional[float] = None
    rs_nifty500_1w_rank: Optional[float] = None
    rs_nifty500_1m_rank: Optional[float] = None
    rs_nifty500_3m_rank: Optional[float] = None
    rs_nifty500_6m_rank: Optional[float] = None
    rs_nifty500_12m_rank: Optional[float] = None
    rs_nifty500_24m_rank: Optional[float] = None
    rs_nifty500_36m_rank: Optional[float] = None
    rs_nifty500_persistence: Optional[float] = None

    # RS vs S&P 500 — 8 periods
    rs_sp500_1d_rank: Optional[float] = None
    rs_sp500_1w_rank: Optional[float] = None
    rs_sp500_1m_rank: Optional[float] = None
    rs_sp500_3m_rank: Optional[float] = None
    rs_sp500_6m_rank: Optional[float] = None
    rs_sp500_12m_rank: Optional[float] = None
    rs_sp500_24m_rank: Optional[float] = None
    rs_sp500_36m_rank: Optional[float] = None
    rs_sp500_persistence: Optional[float] = None

    # RS vs MSCI World — 8 periods
    rs_msci_1d_rank: Optional[float] = None
    rs_msci_1w_rank: Optional[float] = None
    rs_msci_1m_rank: Optional[float] = None
    rs_msci_3m_rank: Optional[float] = None
    rs_msci_6m_rank: Optional[float] = None
    rs_msci_12m_rank: Optional[float] = None
    rs_msci_24m_rank: Optional[float] = None
    rs_msci_36m_rank: Optional[float] = None
    rs_msci_persistence: Optional[float] = None

    # RS vs Gold — 8 periods
    rs_gold_1d_rank: Optional[float] = None
    rs_gold_1w_rank: Optional[float] = None
    rs_gold_1m_rank: Optional[float] = None
    rs_gold_3m_rank: Optional[float] = None
    rs_gold_6m_rank: Optional[float] = None
    rs_gold_12m_rank: Optional[float] = None
    rs_gold_24m_rank: Optional[float] = None
    rs_gold_36m_rank: Optional[float] = None
    rs_gold_persistence: Optional[float] = None

    # State & Action
    state: Optional[str] = None
    state_stability: Optional[float] = None
    frag_score: Optional[float] = None
    frag_level: Optional[str] = None
    action: Optional[str] = None
    action_confidence: Optional[float] = None


class LookthroughSummary(BaseModel):
    lookthrough_rs_3m: Optional[float] = None
    lookthrough_rs_12m: Optional[float] = None
    pct_holdings_leader: Optional[float] = None
    pct_holdings_emerging: Optional[float] = None
    pct_holdings_broken: Optional[float] = None
    top_sector: Optional[str] = None
    sector_herfindahl: Optional[float] = None
    num_holdings: Optional[int] = None
    top10_concentration: Optional[float] = None
    avg_holding_ret_3m: Optional[float] = None
    avg_holding_frag_score: Optional[float] = None
    cap_large_pct: Optional[float] = None
    cap_mid_pct: Optional[float] = None
    cap_small_pct: Optional[float] = None
    cap_tilt: Optional[str] = None
    dominant_sectors: Optional[list[dict[str, Any]]] = None


class FactorPercentiles(BaseModel):
    factor_momentum_pct: Optional[float] = None
    factor_quality_pct: Optional[float] = None
    factor_resilience_pct: Optional[float] = None
    factor_holdings_pct: Optional[float] = None
    factor_cost_pct: Optional[float] = None
    factor_consistency_pct: Optional[float] = None
    rank_in_category: Optional[int] = None
    total_in_category: Optional[int] = None


class NarrativeBlock(BaseModel):
    verdict: str
    reasons: list[str]
    risks: list[str]
    technical_snapshot: str
    recommended_action: str


class SnapshotResponse(BaseModel):
    instrument: InstrumentIdentity
    metrics: MetricSnapshot
    lookthrough: Optional[LookthroughSummary] = None
    factor_percentiles: Optional[FactorPercentiles] = None
    narrative: Optional[NarrativeBlock] = None
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Aggregate (bubble + table)
# ---------------------------------------------------------------------------


class CohortPoint(BaseModel):
    cohort_key: str
    cohort_label: Optional[str] = None
    member_count: int
    median_rs_rank: Optional[float] = None
    median_ret_3m: Optional[float] = None
    median_ret_12m: Optional[float] = None
    pct_above_ema_50: Optional[float] = None
    pct_leader_state: Optional[float] = None
    avg_frag_score: Optional[float] = None
    consensus_action: Optional[str] = None
    action_confidence: Optional[float] = None
    bubble_x: Optional[float] = None  # e.g. median_rs_rank
    bubble_y: Optional[float] = None  # e.g. median_ret_3m
    bubble_size: Optional[float] = None  # e.g. member_count
    bubble_color: Optional[str] = None  # e.g. consensus_action


class AggregateResponse(BaseModel):
    cohort_type: CohortType
    benchmark: Benchmark
    period: Period
    points: list[CohortPoint]
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Screener
# ---------------------------------------------------------------------------


class FilterClause(BaseModel):
    field: str
    op: str = Field(default="gte", pattern="^(eq|ne|gt|gte|lt|lte|in|not_in|between|contains)$")
    value: Any


class ScreenerRequest(BaseModel):
    filters: list[FilterClause] = Field(default_factory=list)
    sort_field: Optional[str] = None
    sort_direction: SortDirection = SortDirection.DESC
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    include_narrative: bool = False


class ScreenerRow(BaseModel):
    instrument_id: str
    symbol: str
    name: str
    instrument_type: str
    sector: Optional[str] = None
    cap_category: Optional[str] = None
    mf_category: Optional[str] = None
    state: Optional[str] = None
    action: Optional[str] = None
    action_confidence: Optional[float] = None
    rs_nifty_3m_rank: Optional[float] = None
    rs_nifty_12m_rank: Optional[float] = None
    ret_3m: Optional[float] = None
    ret_12m: Optional[float] = None
    rsi_14: Optional[float] = None
    frag_score: Optional[float] = None
    above_ema_50: Optional[bool] = None


class ScreenerResponse(BaseModel):
    rows: list[ScreenerRow]
    total_count: int
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Regime
# ---------------------------------------------------------------------------


class RegimeMetrics(BaseModel):
    date: date
    pct_above_ema_20: Optional[float] = None
    pct_above_ema_50: Optional[float] = None
    pct_above_ema_200: Optional[float] = None
    pct_golden_cross: Optional[float] = None
    participation: Optional[float] = None
    rs_dispersion: Optional[float] = None
    health_score: Optional[float] = None
    health_zone: Optional[str] = None


class RegimeResponse(BaseModel):
    regime: Optional[str] = None
    direction: Optional[str] = None
    metrics: RegimeMetrics
    narrative: Optional[NarrativeBlock] = None
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Fund Rankings (6-factor heatmap)
# ---------------------------------------------------------------------------


class FundRankingRow(BaseModel):
    instrument_id: str
    symbol: str
    name: str
    instrument_type: str
    mf_category: str
    cap_tilt: Optional[str] = None
    lookthrough_rs_3m: Optional[float] = None
    aum_cr: Optional[float] = None
    expense_ratio: Optional[float] = None
    factor_momentum_pct: Optional[float] = None
    factor_quality_pct: Optional[float] = None
    factor_resilience_pct: Optional[float] = None
    factor_holdings_pct: Optional[float] = None
    factor_cost_pct: Optional[float] = None
    factor_consistency_pct: Optional[float] = None
    action: Optional[str] = None
    rank_in_category: Optional[int] = None
    total_in_category: Optional[int] = None


class FundRankingsResponse(BaseModel):
    rows: list[FundRankingRow]
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Fund X-Ray
# ---------------------------------------------------------------------------


class HoldingRow(BaseModel):
    child_id: Optional[str] = None
    child_name: Optional[str] = None
    weight_pct: Optional[float] = None
    sector: Optional[str] = None
    state: Optional[str] = None
    action: Optional[str] = None
    rs_nifty_3m_rank: Optional[float] = None
    ret_3m: Optional[float] = None
    frag_score: Optional[float] = None


class FundXrayResponse(BaseModel):
    instrument: InstrumentIdentity
    lookthrough: LookthroughSummary
    factor_percentiles: FactorPercentiles
    holdings: list[HoldingRow]
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Fund Holdings
# ---------------------------------------------------------------------------


class FundHoldingsResponse(BaseModel):
    instrument: InstrumentIdentity
    holdings: list[HoldingRow]
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Fund Categories
# ---------------------------------------------------------------------------


class CategoryAggregate(BaseModel):
    mf_category: str
    fund_count: int
    median_momentum_pct: Optional[float] = None
    median_quality_pct: Optional[float] = None
    median_resilience_pct: Optional[float] = None
    median_holdings_pct: Optional[float] = None
    median_cost_pct: Optional[float] = None
    median_consistency_pct: Optional[float] = None
    avg_aum_cr: Optional[float] = None


class FundCategoriesResponse(BaseModel):
    categories: list[CategoryAggregate]
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Fund Screen
# ---------------------------------------------------------------------------


class FundScreenRequest(BaseModel):
    filters: list[FilterClause] = Field(default_factory=list)
    sort_field: Optional[str] = None
    sort_direction: SortDirection = SortDirection.DESC
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class FundScreenRow(BaseModel):
    instrument_id: str
    symbol: str
    name: str
    mf_category: str
    cap_tilt: Optional[str] = None
    factor_momentum_pct: Optional[float] = None
    factor_quality_pct: Optional[float] = None
    factor_resilience_pct: Optional[float] = None
    factor_holdings_pct: Optional[float] = None
    factor_cost_pct: Optional[float] = None
    factor_consistency_pct: Optional[float] = None
    action: Optional[str] = None
    aum_cr: Optional[float] = None
    expense_ratio: Optional[float] = None


class FundScreenResponse(BaseModel):
    rows: list[FundScreenRow]
    total_count: int
    meta: ResponseMeta


# ---------------------------------------------------------------------------
# Global Aggregate
# ---------------------------------------------------------------------------


class GlobalAggregatePoint(BaseModel):
    country: str
    instrument_count: int
    median_rs_sp500_3m: Optional[float] = None
    median_rs_msci_3m: Optional[float] = None
    median_ret_3m: Optional[float] = None
    median_ret_12m: Optional[float] = None
    pct_leader: Optional[float] = None
    bubble_x: Optional[float] = None
    bubble_y: Optional[float] = None
    bubble_size: Optional[float] = None
    bubble_color: Optional[str] = None


class GlobalAggregateResponse(BaseModel):
    points: list[GlobalAggregatePoint]
    meta: ResponseMeta
