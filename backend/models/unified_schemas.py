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

    # Trend
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    above_ema_20: Optional[bool] = None
    above_ema_50: Optional[bool] = None
    golden_cross: Optional[bool] = None

    # Volume
    rvol_20d: Optional[float] = None
    vol_trend: Optional[float] = None

    # Risk
    vol_21d: Optional[float] = None
    max_dd_252d: Optional[float] = None
    current_dd: Optional[float] = None

    # Technicals
    rsi_14: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    pct_from_52w_high: Optional[float] = None

    # RS (primary — Nifty)
    rs_nifty_3m_rank: Optional[float] = None
    rs_nifty_12m_rank: Optional[float] = None
    rs_nifty_persistence: Optional[float] = None

    # State & Action
    state: Optional[str] = None
    state_stability: Optional[float] = None
    frag_score: Optional[float] = None
    frag_level: Optional[str] = None
    action: Optional[str] = None
    action_confidence: Optional[float] = None


class NarrativeBlock(BaseModel):
    verdict: str
    reasons: list[str]
    risks: list[str]
    technical_snapshot: str
    recommended_action: str


class SnapshotResponse(BaseModel):
    instrument: InstrumentIdentity
    metrics: MetricSnapshot
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
