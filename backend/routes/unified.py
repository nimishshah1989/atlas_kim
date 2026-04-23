"""Unified RS Intelligence Engine API routes.

Endpoints:
  GET  /api/unified/snapshot/{instrument_id}
  GET  /api/unified/aggregate
  POST /api/unified/screen
  GET  /api/unified/regime
  GET  /api/unified/funds/rankings
  GET  /api/unified/funds/{id}/xray
  GET  /api/unified/funds/{id}/holdings
  GET  /api/unified/funds/categories
  POST /api/unified/funds/screen
  GET  /api/unified/global/regime
  GET  /api/unified/global/aggregate
"""

from __future__ import annotations

import time
from datetime import date
from typing import Any, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.models.unified_schemas import (
    AggregateResponse,
    Benchmark,
    CohortType,
    CohortPoint,
    FilterClause,
    FundCategoriesResponse,
    CategoryAggregate,
    FundHoldingsResponse,
    FundRankingRow,
    FundRankingsResponse,
    FundScreenRequest,
    FundScreenResponse,
    FundScreenRow,
    FundXrayResponse,
    GlobalAggregatePoint,
    GlobalAggregateResponse,
    HoldingRow,
    LookthroughSummary,
    FactorPercentiles,
    NarrativeBlock,
    Period,
    ResponseMeta,
    ScreenerRequest,
    ScreenerResponse,
    ScreenerRow,
    SnapshotResponse,
    RegimeResponse,
    RegimeMetrics,
    InstrumentIdentity,
    MetricSnapshot,
)
from backend.services.unified_narrative import generate_narrative
from backend.services.unified_query import (
    get_cohort_aggregate,
    get_fund_categories,
    get_fund_holdings,
    get_fund_rankings,
    get_fund_xray,
    get_global_aggregate,
    get_instrument_snapshot,
    get_market_regime,
    run_fund_screen,
    run_screen,
)

log = structlog.get_logger()
router = APIRouter(prefix="/api/unified", tags=["unified"])

# ---------------------------------------------------------------------------
# Tenant dependency
# ---------------------------------------------------------------------------


def _tenant_id(tenant_id: str = Query("default", description="Tenant identifier")) -> str:
    return tenant_id


# ---------------------------------------------------------------------------
# 1. Snapshot
# ---------------------------------------------------------------------------


@router.get(
    "/snapshot/{instrument_id}",
    response_model=SnapshotResponse,
    summary="Instrument evidence card",
    description="Returns identity, latest metrics, lookthrough, factor percentiles, and deterministic narrative.",
)
async def get_snapshot(
    request: Request,
    instrument_id: str,
    date: Optional[date] = Query(None, description="Optional snapshot date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> SnapshotResponse:
    t0 = time.monotonic()

    data = await get_instrument_snapshot(db, instrument_id, date, tenant_id)
    if data is None or data.get("instrument") is None:
        raise HTTPException(status_code=404, detail=f"Instrument {instrument_id} not found")

    instrument = data["instrument"]
    metric = data["metric"]
    lookthrough = data.get("lookthrough")
    factor_percentiles = data.get("factor_percentiles")
    snapshot_date = data["date"]

    # Build metric snapshot
    metrics_model = MetricSnapshot(
        date=snapshot_date,
        **({k: getattr(metric, k) for k in MetricSnapshot.model_fields if k != "date" and hasattr(metric, k)} if metric else {})
    ) if metric else MetricSnapshot(date=snapshot_date)

    # Build identity
    identity = InstrumentIdentity(
        instrument_id=instrument.instrument_id,
        symbol=instrument.symbol,
        name=instrument.name,
        instrument_type=instrument.instrument_type,
        sector=instrument.sector,
        industry=instrument.industry,
        country=instrument.country,
        exchange=instrument.exchange,
        cap_category=instrument.cap_category,
        mf_category=instrument.mf_category,
        is_active=instrument.is_active,
    )

    # Lookthrough summary
    lt_summary = None
    if lookthrough:
        lt_summary = LookthroughSummary(
            **{k: getattr(lookthrough, k) for k in LookthroughSummary.model_fields if hasattr(lookthrough, k)}
        )

    # Factor percentiles
    factor_model = None
    if factor_percentiles:
        factor_model = FactorPercentiles(
            **{k: getattr(factor_percentiles, k) for k in FactorPercentiles.model_fields if hasattr(factor_percentiles, k)}
        )

    # Narrative
    regime_data = await get_market_regime(db, snapshot_date, tenant_id)
    metric_dict = metrics_model.model_dump() if metric else {}
    lt_dict = lt_summary.model_dump() if lt_summary else None
    factor_dict = factor_model.model_dump() if factor_model else None
    narrative = generate_narrative(
        metric_dict,
        regime_data,
        instrument_type=instrument.instrument_type,
        lookthrough_dict=lt_dict,
        factor_dict=factor_dict,
    )
    narrative_block = NarrativeBlock(**narrative)

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return SnapshotResponse(
        instrument=identity,
        metrics=metrics_model,
        lookthrough=lt_summary,
        factor_percentiles=factor_model,
        narrative=narrative_block,
        meta=ResponseMeta(
            data_as_of=snapshot_date,
            record_count=1,
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 2. Aggregate
# ---------------------------------------------------------------------------


@router.get(
    "/aggregate",
    response_model=AggregateResponse,
    summary="Cohort aggregate (bubble + table)",
    description="Returns aggregated metrics grouped by cohort (sector, cap, state, mf_category, country, global_sector, etc.).",
)
async def get_aggregate(
    request: Request,
    cohort_type: CohortType = Query(..., description="Dimension to group by"),
    benchmark: Benchmark = Query(Benchmark.NIFTY, description="Benchmark for RS calculation"),
    period: Period = Query(Period.M3, description="Return period for median"),
    date: Optional[date] = Query(None, description="Optional snapshot date (defaults to latest)"),
    instrument_type: Optional[str] = Query(None, description="Filter by instrument type (e.g. EQUITY, MF, ETF, INDEX_GLOBAL)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> AggregateResponse:
    t0 = time.monotonic()

    instrument_types = [instrument_type] if instrument_type else None
    rows = await get_cohort_aggregate(
        db,
        cohort_type=cohort_type.value,
        benchmark=benchmark.value,
        period=period.value,
        snapshot_date=date,
        tenant_id=tenant_id,
        instrument_types=instrument_types,
    )

    points: list[CohortPoint] = []
    for r in rows:
        points.append(
            CohortPoint(
                cohort_key=r["cohort_key"],
                member_count=r["member_count"],
                median_rs_rank=r.get("median_rs_rank"),
                median_ret_3m=r.get("median_ret_3m"),
                median_ret_12m=r.get("median_ret_12m"),
                pct_above_ema_50=r.get("pct_above_ema_50"),
                pct_leader_state=r.get("pct_leader_state"),
                avg_frag_score=r.get("avg_frag_score"),
                consensus_action=r.get("consensus_action"),
                action_confidence=r.get("action_confidence"),
                bubble_x=r.get("median_rs_rank"),
                bubble_y=r.get("median_ret_3m"),
                bubble_size=r.get("member_count"),
                bubble_color=r.get("consensus_action"),
            )
        )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return AggregateResponse(
        cohort_type=cohort_type,
        benchmark=benchmark,
        period=period,
        points=points,
        meta=ResponseMeta(
            record_count=len(points),
            query_ms=elapsed_ms,
            cache_hit=True,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 3. Screener
# ---------------------------------------------------------------------------


@router.post(
    "/screen",
    response_model=ScreenerResponse,
    summary="Filterable screener",
    description="Apply metric filters and return paginated rows.",
)
async def post_screen(
    request: Request,
    body: ScreenerRequest,
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> ScreenerResponse:
    t0 = time.monotonic()

    filters = [f.model_dump() for f in body.filters]
    result = await run_screen(
        db,
        filters=filters,
        sort_field=body.sort_field,
        sort_direction=body.sort_direction.value,
        limit=body.limit,
        offset=body.offset,
        tenant_id=tenant_id,
    )

    rows: list[ScreenerRow] = []
    for r in result["rows"]:
        rows.append(ScreenerRow(**r))

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return ScreenerResponse(
        rows=rows,
        total_count=result["total_count"],
        meta=ResponseMeta(
            record_count=len(rows),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 4. Regime
# ---------------------------------------------------------------------------


@router.get(
    "/regime",
    response_model=RegimeResponse,
    summary="Current market regime",
    description="Returns the latest unified market regime with deterministic narrative.",
)
async def get_regime(
    request: Request,
    date: Optional[date] = Query(None, description="Optional regime date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> RegimeResponse:
    t0 = time.monotonic()

    row = await get_market_regime(db, date, tenant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Market regime data not found")

    metrics = RegimeMetrics(
        date=row["date"],
        pct_above_ema_20=row.get("pct_above_ema_20"),
        pct_above_ema_50=row.get("pct_above_ema_50"),
        pct_above_ema_200=row.get("pct_above_ema_200"),
        pct_golden_cross=row.get("pct_golden_cross"),
        participation=row.get("participation"),
        rs_dispersion=row.get("rs_dispersion"),
        health_score=row.get("health_score"),
        health_zone=row.get("health_zone"),
    )

    narrative = generate_narrative(
        {
            "pct_above_ema_20": row.get("pct_above_ema_20"),
            "pct_above_ema_50": row.get("pct_above_ema_50"),
            "pct_above_ema_200": row.get("pct_above_ema_200"),
            "participation": row.get("participation"),
            "rs_dispersion": row.get("rs_dispersion"),
            "health_score": row.get("health_score"),
        },
        row,
    )
    narrative_block = NarrativeBlock(**narrative)

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return RegimeResponse(
        regime=row.get("regime"),
        direction=row.get("direction"),
        metrics=metrics,
        narrative=narrative_block,
        meta=ResponseMeta(
            data_as_of=row["date"],
            record_count=1,
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 5. Fund Rankings
# ---------------------------------------------------------------------------


@router.get(
    "/funds/rankings",
    response_model=FundRankingsResponse,
    summary="MF 6-factor heatmap data",
    description="Returns all funds with their 6 independent factor percentiles.",
)
async def get_funds_rankings(
    request: Request,
    date: Optional[date] = Query(None, description="Optional date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> FundRankingsResponse:
    t0 = time.monotonic()

    rows = await get_fund_rankings(db, date, tenant_id)
    result_rows: list[FundRankingRow] = [FundRankingRow(**r) for r in rows]

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return FundRankingsResponse(
        rows=result_rows,
        meta=ResponseMeta(
            record_count=len(result_rows),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 6. Fund X-Ray
# ---------------------------------------------------------------------------


@router.get(
    "/funds/{instrument_id}/xray",
    response_model=FundXrayResponse,
    summary="Full fund evidence + holdings + factors",
    description="Returns lookthrough, factor percentiles, and top 20 holdings for a fund/ETF/index.",
)
async def get_fund_xray_endpoint(
    request: Request,
    instrument_id: str,
    date: Optional[date] = Query(None, description="Optional date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> FundXrayResponse:
    t0 = time.monotonic()

    data = await get_fund_xray(db, instrument_id, date, tenant_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Fund {instrument_id} not found")

    instrument = data["instrument"]
    lookthrough = data["lookthrough"]
    factor_percentiles = data["factor_percentiles"]
    holdings = data["holdings"]
    snapshot_date = data["date"]

    identity = InstrumentIdentity(
        instrument_id=instrument.instrument_id,
        symbol=instrument.symbol,
        name=instrument.name,
        instrument_type=instrument.instrument_type,
        sector=instrument.sector,
        industry=instrument.industry,
        country=instrument.country,
        exchange=instrument.exchange,
        cap_category=instrument.cap_category,
        mf_category=instrument.mf_category,
        is_active=instrument.is_active,
    )

    lt_summary = LookthroughSummary(
        **{k: getattr(lookthrough, k) for k in LookthroughSummary.model_fields if lookthrough and hasattr(lookthrough, k)}
    ) if lookthrough else LookthroughSummary()

    factor_model = FactorPercentiles(
        **{k: getattr(factor_percentiles, k) for k in FactorPercentiles.model_fields if factor_percentiles and hasattr(factor_percentiles, k)}
    ) if factor_percentiles else FactorPercentiles()

    holding_rows: list[HoldingRow] = [HoldingRow(**h) for h in holdings]

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return FundXrayResponse(
        instrument=identity,
        lookthrough=lt_summary,
        factor_percentiles=factor_model,
        holdings=holding_rows,
        meta=ResponseMeta(
            data_as_of=snapshot_date,
            record_count=1,
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 7. Fund Holdings
# ---------------------------------------------------------------------------


@router.get(
    "/funds/{instrument_id}/holdings",
    response_model=FundHoldingsResponse,
    summary="Top 20 holdings with child metrics",
    description="Returns the top 20 holdings for a fund with child-level metrics.",
)
async def get_fund_holdings_endpoint(
    request: Request,
    instrument_id: str,
    date: Optional[date] = Query(None, description="Optional date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> FundHoldingsResponse:
    t0 = time.monotonic()

    data = await get_fund_holdings(db, instrument_id, date, tenant_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Fund {instrument_id} not found")

    instrument = data["instrument"]
    holdings = data["holdings"]
    snapshot_date = data["date"]

    identity = InstrumentIdentity(
        instrument_id=instrument.instrument_id,
        symbol=instrument.symbol,
        name=instrument.name,
        instrument_type=instrument.instrument_type,
        sector=instrument.sector,
        industry=instrument.industry,
        country=instrument.country,
        exchange=instrument.exchange,
        cap_category=instrument.cap_category,
        mf_category=instrument.mf_category,
        is_active=instrument.is_active,
    )

    holding_rows: list[HoldingRow] = [HoldingRow(**h) for h in holdings]

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return FundHoldingsResponse(
        instrument=identity,
        holdings=holding_rows,
        meta=ResponseMeta(
            data_as_of=snapshot_date,
            record_count=len(holding_rows),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 8. Fund Categories
# ---------------------------------------------------------------------------


@router.get(
    "/funds/categories",
    response_model=FundCategoriesResponse,
    summary="Distinct categories with aggregates",
    description="Returns all MF categories with median factor percentiles and fund counts.",
)
async def get_funds_categories(
    request: Request,
    date: Optional[date] = Query(None, description="Optional date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> FundCategoriesResponse:
    t0 = time.monotonic()

    rows = await get_fund_categories(db, date, tenant_id)
    categories: list[CategoryAggregate] = [CategoryAggregate(**r) for r in rows]

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return FundCategoriesResponse(
        categories=categories,
        meta=ResponseMeta(
            record_count=len(categories),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 9. Fund Screen
# ---------------------------------------------------------------------------


@router.post(
    "/funds/screen",
    response_model=FundScreenResponse,
    summary="Filter by factors, category, cap tilt",
    description="Screen funds using 6-factor percentiles and category filters.",
)
async def post_fund_screen(
    request: Request,
    body: FundScreenRequest,
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> FundScreenResponse:
    t0 = time.monotonic()

    filters = [f.model_dump() for f in body.filters]
    result = await run_fund_screen(
        db,
        filters=filters,
        sort_field=body.sort_field,
        sort_direction=body.sort_direction.value,
        limit=body.limit,
        offset=body.offset,
        tenant_id=tenant_id,
    )

    rows: list[FundScreenRow] = []
    for r in result["rows"]:
        rows.append(FundScreenRow(**r))

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return FundScreenResponse(
        rows=rows,
        total_count=result["total_count"],
        meta=ResponseMeta(
            record_count=len(rows),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 10. Global Regime
# ---------------------------------------------------------------------------


@router.get(
    "/global/regime",
    response_model=RegimeResponse,
    summary="Global market regime",
    description="Returns the latest global market regime with deterministic narrative.",
)
async def get_global_regime(
    request: Request,
    date: Optional[date] = Query(None, description="Optional regime date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> RegimeResponse:
    t0 = time.monotonic()

    row = await get_market_regime(db, date, tenant_id, region="GLOBAL")
    if row is None:
        raise HTTPException(status_code=404, detail="Global regime data not found")

    metrics = RegimeMetrics(
        date=row["date"],
        pct_above_ema_20=row.get("pct_above_ema_20"),
        pct_above_ema_50=row.get("pct_above_ema_50"),
        pct_above_ema_200=row.get("pct_above_ema_200"),
        pct_golden_cross=row.get("pct_golden_cross"),
        participation=row.get("participation"),
        rs_dispersion=row.get("rs_dispersion"),
        health_score=row.get("health_score"),
        health_zone=row.get("health_zone"),
    )

    narrative = generate_narrative(
        {
            "pct_above_ema_20": row.get("pct_above_ema_20"),
            "pct_above_ema_50": row.get("pct_above_ema_50"),
            "participation": row.get("participation"),
            "rs_dispersion": row.get("rs_dispersion"),
            "health_score": row.get("health_score"),
        },
        row,
        instrument_type="INDEX_GLOBAL",
    )
    narrative_block = NarrativeBlock(**narrative)

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return RegimeResponse(
        regime=row.get("regime"),
        direction=row.get("direction"),
        metrics=metrics,
        narrative=narrative_block,
        meta=ResponseMeta(
            data_as_of=row["date"],
            record_count=1,
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )


# ---------------------------------------------------------------------------
# 11. Global Aggregate
# ---------------------------------------------------------------------------


@router.get(
    "/global/aggregate",
    response_model=GlobalAggregateResponse,
    summary="Country/region bubble chart data",
    description="Returns aggregated global metrics grouped by country for bubble chart.",
)
async def get_global_aggregate_endpoint(
    request: Request,
    date: Optional[date] = Query(None, description="Optional snapshot date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> GlobalAggregateResponse:
    t0 = time.monotonic()

    rows = await get_global_aggregate(db, date, tenant_id)
    points: list[GlobalAggregatePoint] = []
    for r in rows:
        points.append(
            GlobalAggregatePoint(
                country=r["country"],
                instrument_count=r["instrument_count"],
                median_rs_sp500_3m=r.get("median_rs_sp500_3m"),
                median_rs_msci_3m=r.get("median_rs_msci_3m"),
                median_ret_3m=r.get("median_ret_3m"),
                median_ret_12m=r.get("median_ret_12m"),
                pct_leader=r.get("pct_leader"),
                bubble_x=r.get("median_rs_sp500_3m"),
                bubble_y=r.get("median_ret_3m"),
                bubble_size=r.get("instrument_count"),
                bubble_color=r.get("consensus_action"),
            )
        )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return GlobalAggregateResponse(
        points=points,
        meta=ResponseMeta(
            record_count=len(points),
            query_ms=elapsed_ms,
            tenant_id=tenant_id,
        ),
    )
