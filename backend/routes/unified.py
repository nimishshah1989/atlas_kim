"""Unified RS Intelligence Engine API routes.

4 endpoints:
  GET  /api/unified/snapshot/{instrument_id}
  GET  /api/unified/aggregate
  POST /api/unified/screen
  GET  /api/unified/regime
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
    get_instrument_snapshot,
    get_market_regime,
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
    description="Returns identity, latest metrics, and deterministic narrative for a single instrument.",
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

    # Narrative
    regime_data = await get_market_regime(db, snapshot_date, tenant_id)
    metric_dict = metrics_model.model_dump() if metric else {}
    narrative = generate_narrative(metric_dict, regime_data)
    narrative_block = NarrativeBlock(**narrative)

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    return SnapshotResponse(
        instrument=identity,
        metrics=metrics_model,
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
    description="Returns aggregated metrics grouped by cohort (sector, cap, state, etc.).",
)
async def get_aggregate(
    request: Request,
    cohort_type: CohortType = Query(..., description="Dimension to group by"),
    benchmark: Benchmark = Query(Benchmark.NIFTY, description="Benchmark for RS calculation"),
    period: Period = Query(Period.M3, description="Return period for median"),
    date: Optional[date] = Query(None, description="Optional snapshot date (defaults to latest)"),
    tenant_id: str = Depends(_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> AggregateResponse:
    t0 = time.monotonic()

    rows = await get_cohort_aggregate(
        db,
        cohort_type=cohort_type.value,
        benchmark=benchmark.value,
        period=period.value,
        snapshot_date=date,
        tenant_id=tenant_id,
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
            cache_hit=True,  # get_cohort_aggregate handles TTL internally
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

    # Narrative from regime-only context
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
