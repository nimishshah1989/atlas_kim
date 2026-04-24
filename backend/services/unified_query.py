"""Unified RS Intelligence Engine — query helpers.

All functions accept an AsyncSession and operate on the unified_* tables.
A simple in-memory TTL cache (900 s) is applied to aggregate queries.
"""

from __future__ import annotations

import time
from datetime import date
from typing import Any, Optional

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.unified_models import (
    UnifiedInstrument,
    UnifiedMarketRegime,
    UnifiedMetric,
    UnifiedMFLookthrough,
    UnifiedMFRanking,
    UnifiedMFHoldingsDetail,
)

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# In-memory TTL cache for aggregates (15 minutes)
# ---------------------------------------------------------------------------

_AGGREGATE_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SECONDS = 900


def _cache_key(*parts: str) -> str:
    return "|".join(parts)


def _get_cached(key: str) -> Any:
    entry = _AGGREGATE_CACHE.get(key)
    if entry is None:
        return None
    inserted_at, value = entry
    if time.monotonic() - inserted_at > _CACHE_TTL_SECONDS:
        del _AGGREGATE_CACHE[key]
        return None
    return value


def _set_cached(key: str, value: Any) -> None:
    _AGGREGATE_CACHE[key] = (time.monotonic(), value)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _latest_metric_date(db: AsyncSession, tenant_id: str) -> Optional[date]:
    result = await db.execute(
        select(UnifiedMetric.date)
        .where(UnifiedMetric.tenant_id == tenant_id)
        .order_by(UnifiedMetric.date.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row


# ---------------------------------------------------------------------------
# 1. Snapshot
# ---------------------------------------------------------------------------


async def get_instrument_snapshot(
    db: AsyncSession,
    instrument_id: str,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> Optional[dict[str, Any]]:
    """Fetch instrument identity + latest metrics for a single instrument."""
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return None

    # Instrument identity
    inst_result = await db.execute(
        select(UnifiedInstrument).where(
            UnifiedInstrument.instrument_id == instrument_id,
            UnifiedInstrument.tenant_id == tenant_id,
        )
    )
    instrument = inst_result.scalar_one_or_none()
    if instrument is None:
        return None

    # Metrics
    metric_result = await db.execute(
        select(UnifiedMetric).where(
            UnifiedMetric.tenant_id == tenant_id,
            UnifiedMetric.instrument_id == instrument_id,
            UnifiedMetric.date == target_date,
        )
    )
    metric = metric_result.scalar_one_or_none()

    # Lookthrough for MF/ETF/Index
    lookthrough = None
    if instrument.instrument_type in ("MF", "ETF", "INDEX", "INDEX_GLOBAL"):
        lt_result = await db.execute(
            select(UnifiedMFLookthrough).where(
                UnifiedMFLookthrough.tenant_id == tenant_id,
                UnifiedMFLookthrough.mf_id == instrument_id,
                UnifiedMFLookthrough.date <= target_date,
            ).order_by(UnifiedMFLookthrough.date.desc()).limit(1)
        )
        lookthrough = lt_result.scalar_one_or_none()

    # Factor percentiles for MF/ETF
    factor_percentiles = None
    if instrument.instrument_type in ("MF", "ETF"):
        rank_result = await db.execute(
            select(UnifiedMFRanking).where(
                UnifiedMFRanking.tenant_id == tenant_id,
                UnifiedMFRanking.mf_id == instrument_id,
                UnifiedMFRanking.date <= target_date,
            ).order_by(UnifiedMFRanking.date.desc()).limit(1)
        )
        factor_percentiles = rank_result.scalar_one_or_none()

    return {
        "instrument": instrument,
        "metric": metric,
        "lookthrough": lookthrough,
        "factor_percentiles": factor_percentiles,
        "date": target_date,
    }


# ---------------------------------------------------------------------------
# 2. Cohort aggregate
# ---------------------------------------------------------------------------


_COHORT_COLUMN_MAP: dict[str, str] = {
    "sector": "i.sector",
    "cap_category": "i.cap_category",
    "mf_category": "i.mf_category",
    "instrument_type": "i.instrument_type",
    "state": "m.state",
    "action": "m.action",
    "country": "i.country",
    "global_sector": "i.sector",
}

_BENCHMARK_RS_COLUMN: dict[str, str] = {
    "nifty": "m.rs_nifty_3m_rank",
    "nifty500": "m.rs_nifty500_3m_rank",
    "sp500": "m.rs_sp500_3m_rank",
    "msci": "m.rs_msci_3m_rank",
    "gold": "m.rs_gold_3m_rank",
}

_RET_COLUMN_MAP: dict[str, str] = {
    "1d": "m.ret_1d",
    "1w": "m.ret_1w",
    "1m": "m.ret_1m",
    "3m": "m.ret_3m",
    "6m": "m.ret_6m",
    "12m": "m.ret_12m",
    "24m": "m.ret_24m",
    "36m": "m.ret_36m",
}


async def get_cohort_aggregate(
    db: AsyncSession,
    cohort_type: str,
    benchmark: str,
    period: str,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
    instrument_types: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    """Return bubble-chart + table aggregates grouped by cohort."""
    cache_key = _cache_key("aggregate", tenant_id, cohort_type, benchmark, period, str(snapshot_date), str(instrument_types))
    cached = _get_cached(cache_key)
    if cached is not None:
        log.debug("aggregate_cache_hit", key=cache_key)
        return cached

    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return []

    cohort_col = _COHORT_COLUMN_MAP.get(cohort_type)
    if cohort_col is None:
        raise ValueError(f"Invalid cohort_type: {cohort_type}")

    rs_col = _BENCHMARK_RS_COLUMN.get(benchmark, "m.rs_nifty_3m_rank")
    ret_col = _RET_COLUMN_MAP.get(period, "m.ret_3m")

    # For sector cohorts, default to EQUITY only to avoid ETF theme pollution
    effective_types = instrument_types
    if cohort_type == "sector" and effective_types is None:
        effective_types = ["EQUITY"]

    type_filter = ""
    params: dict[str, Any] = {"tenant_id": tenant_id, "target_date": target_date}
    if effective_types:
        type_filter = "AND i.instrument_type = ANY(:instrument_types)"
        params["instrument_types"] = effective_types

    sql = text(f"""
    SELECT
        {cohort_col} AS cohort_key,
        COUNT(*) AS member_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {rs_col} ASC NULLS LAST) AS median_rs_rank,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {ret_col} ASC NULLS LAST) AS median_ret,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.ret_12m ASC NULLS LAST) AS median_ret_12m,
        AVG(CASE WHEN m.above_ema_50 = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_above_ema_50,
        AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_leader_state,
        AVG(m.frag_score) AS avg_frag_score,
        MODE() WITHIN GROUP (ORDER BY m.action) AS consensus_action,
        AVG(m.action_confidence) AS action_confidence
    FROM unified_metrics m
    JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        AND i.tenant_id = m.tenant_id
    WHERE m.tenant_id = :tenant_id
      AND m.date = :target_date
      AND {cohort_col} IS NOT NULL
      {type_filter}
    GROUP BY {cohort_col}
    ORDER BY member_count DESC
    """)

    result = await db.execute(sql, params)
    rows = result.mappings().all()

    output: list[dict[str, Any]] = []
    for row in rows:
        output.append({
            "cohort_key": row["cohort_key"],
            "member_count": row["member_count"],
            "median_rs_rank": row["median_rs_rank"],
            "median_ret_3m": row["median_ret"],
            "median_ret_12m": row["median_ret_12m"],
            "pct_above_ema_50": row["pct_above_ema_50"],
            "pct_leader_state": row["pct_leader_state"],
            "avg_frag_score": row["avg_frag_score"],
            "consensus_action": row["consensus_action"],
            "action_confidence": row["action_confidence"],
        })

    _set_cached(cache_key, output)
    return output


# ---------------------------------------------------------------------------
# 3. Screener
# ---------------------------------------------------------------------------


_ALLOWED_SCREEN_FIELDS: set[str] = {
    "instrument_type",
    "sector",
    "cap_category",
    "mf_category",
    "state",
    "action",
    "frag_level",
    "above_ema_20",
    "above_ema_50",
    "golden_cross",
    "rs_nifty_3m_rank",
    "rs_nifty_12m_rank",
    "rs_nifty500_3m_rank",
    "rs_sp500_3m_rank",
    "rs_msci_3m_rank",
    "rs_gold_3m_rank",
    "ret_1d",
    "ret_1w",
    "ret_1m",
    "ret_3m",
    "ret_6m",
    "ret_12m",
    "rsi_14",
    "macd",
    "vol_21d",
    "frag_score",
    "action_confidence",
    "state_stability",
    "country", "symbol", "name",
}

_INSTRUMENT_FIELDS: set[str] = {"instrument_type", "sector", "cap_category", "mf_category", "country", "symbol", "name"}

_ALLOWED_OPS: set[str] = {"eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in", "between", "contains"}

_SQL_OP_MAP: dict[str, str] = {
    "eq": "=",
    "ne": "!=",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
}


def _build_where_fragment(field: str, op: str, value: Any, param_idx: int) -> tuple[str, dict[str, Any]]:
    if field not in _ALLOWED_SCREEN_FIELDS:
        raise ValueError(f"Invalid filter field: {field}")
    if op not in _ALLOWED_OPS:
        raise ValueError(f"Invalid filter op: {op}")

    table = "i" if field in _INSTRUMENT_FIELDS else "m"
    col = f"{table}.{field}"
    pname = f"p{param_idx}"
    params: dict[str, Any] = {}

    if op in _SQL_OP_MAP:
        fragment = f"{col} {_SQL_OP_MAP[op]} :{pname}"
        params[pname] = value
    elif op == "in":
        fragment = f"{col} = ANY(:{pname})"
        params[pname] = list(value) if isinstance(value, (list, tuple, set)) else [value]
    elif op == "not_in":
        fragment = f"{col} IS DISTINCT FROM ALL(:{pname})"
        params[pname] = list(value) if isinstance(value, (list, tuple, set)) else [value]
    elif op == "between":
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise ValueError("between requires a 2-element list/tuple")
        fragment = f"{col} BETWEEN :{pname}_a AND :{pname}_b"
        params[f"{pname}_a"] = value[0]
        params[f"{pname}_b"] = value[1]
    elif op == "contains":
        fragment = f"{col}::text ILIKE :{pname}"
        params[pname] = f"%{value}%"
    else:
        raise ValueError(f"Unsupported op: {op}")

    return fragment, params


async def run_screen(
    db: AsyncSession,
    filters: list[dict[str, Any]],
    sort_field: Optional[str],
    sort_direction: str,
    limit: int,
    offset: int,
    tenant_id: str = "default",
) -> dict[str, Any]:
    """Run a filterable screener over unified_metrics.

    Returns {"rows": [...], "total_count": int}
    """
    target_date = await _latest_metric_date(db, tenant_id)
    if target_date is None:
        return {"rows": [], "total_count": 0}

    where_clauses: list[str] = ["m.tenant_id = :tenant_id", "m.date = :target_date"]
    params: dict[str, Any] = {"tenant_id": tenant_id, "target_date": target_date}

    # Default to India-only unless an explicit country filter is provided
    has_country_filter = any(f.get("field") == "country" for f in filters)
    if not has_country_filter:
        where_clauses.append("i.country = 'IN'")

    for idx, f in enumerate(filters):
        field = f.get("field")
        op = f.get("op", "gte")
        value = f.get("value")
        if field is None:
            continue
        fragment, frag_params = _build_where_fragment(field, op, value, idx)
        where_clauses.append(fragment)
        params.update(frag_params)

    where_sql = " AND ".join(where_clauses)

    # Sort validation
    sort_col = f"m.{sort_field}" if sort_field in _ALLOWED_SCREEN_FIELDS else "m.rs_nifty_3m_rank"
    sort_dir = "ASC" if sort_direction.lower() == "asc" else "DESC"

    count_sql = text(f"""
    SELECT COUNT(*) AS cnt
    FROM unified_metrics m
    JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        AND i.tenant_id = m.tenant_id
    WHERE {where_sql}
    """)

    data_sql = text(f"""
    SELECT
        m.instrument_id,
        i.symbol,
        i.name,
        i.instrument_type,
        i.sector,
        i.cap_category,
        i.mf_category,
        m.state,
        m.action,
        m.action_confidence,
        m.rs_nifty_3m_rank,
        m.rs_nifty_12m_rank,
        m.ret_3m,
        m.ret_12m,
        m.rsi_14,
        m.frag_score,
        m.above_ema_50
    FROM unified_metrics m
    JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        AND i.tenant_id = m.tenant_id
    WHERE {where_sql}
    ORDER BY {sort_col} {sort_dir} NULLS LAST
    LIMIT :limit OFFSET :offset
    """)

    params_with_pagination = {**params, "limit": limit, "offset": offset}

    count_result = await db.execute(count_sql, params)
    total_count = count_result.scalar_one_or_none() or 0

    data_result = await db.execute(data_sql, params_with_pagination)
    rows = data_result.mappings().all()

    return {
        "rows": [dict(r) for r in rows],
        "total_count": total_count,
    }


# ---------------------------------------------------------------------------
# 4. Market regime
# ---------------------------------------------------------------------------


async def get_market_regime(
    db: AsyncSession,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
    region: str = "IN",
) -> Optional[dict[str, Any]]:
    """Fetch the latest market regime row."""
    stmt = select(UnifiedMarketRegime).where(
        UnifiedMarketRegime.tenant_id == tenant_id,
        UnifiedMarketRegime.region == region,
    )
    if snapshot_date:
        stmt = stmt.where(UnifiedMarketRegime.date == snapshot_date)
    else:
        stmt = stmt.order_by(UnifiedMarketRegime.date.desc())

    stmt = stmt.limit(1)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return {
        "date": row.date,
        "regime": row.regime,
        "direction": row.direction,
        "pct_above_ema_20": row.pct_above_ema_20,
        "pct_above_ema_50": row.pct_above_ema_50,
        "pct_above_ema_200": row.pct_above_ema_200,
        "pct_golden_cross": row.pct_golden_cross,
        "participation": row.participation,
        "rs_dispersion": row.rs_dispersion,
        "health_score": row.health_score,
        "health_zone": row.health_zone,
        "narrative": row.narrative,
    }


# ---------------------------------------------------------------------------
# 5. Fund Rankings
# ---------------------------------------------------------------------------


async def get_fund_rankings(
    db: AsyncSession,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> list[dict[str, Any]]:
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return []

    sql = text("""
    SELECT
        r.mf_id AS instrument_id,
        i.symbol,
        i.name,
        i.instrument_type,
        r.mf_category,
        r.cap_tilt,
        r.lookthrough_rs_3m,
        r.aum_cr,
        r.expense_ratio,
        r.factor_momentum_pct,
        r.factor_quality_pct,
        r.factor_resilience_pct,
        r.factor_holdings_pct,
        r.factor_cost_pct,
        r.factor_consistency_pct,
        r.action,
        r.rank_in_category,
        r.total_in_category
    FROM unified_mf_rankings r
    JOIN unified_instruments i ON i.instrument_id = r.mf_id AND i.tenant_id = r.tenant_id
    JOIN de_mf_master mm ON mm.mstar_id = r.mf_id
    WHERE r.tenant_id = :tenant_id
      AND r.date = :target_date
      AND mm.is_etf = false
      AND mm.is_index_fund = false
      AND mm.broad_category = 'Equity'
      AND (mm.fund_name ILIKE '%Reg%' OR mm.fund_name ILIKE '%Regular%')
      AND (mm.fund_name ILIKE '%Gr%' OR mm.fund_name ILIKE '%Growth%')
    ORDER BY r.mf_category, r.rank_in_category
    """)
    result = await db.execute(sql, {"tenant_id": tenant_id, "target_date": target_date})
    return [dict(r) for r in result.mappings().all()]


# ---------------------------------------------------------------------------
# 6. Fund X-Ray
# ---------------------------------------------------------------------------


async def get_fund_xray(
    db: AsyncSession,
    instrument_id: str,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> Optional[dict[str, Any]]:
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return None

    # Instrument
    inst_result = await db.execute(
        select(UnifiedInstrument).where(
            UnifiedInstrument.instrument_id == instrument_id,
            UnifiedInstrument.tenant_id == tenant_id,
        )
    )
    instrument = inst_result.scalar_one_or_none()
    if instrument is None:
        return None

    # Lookthrough
    lt_result = await db.execute(
        select(UnifiedMFLookthrough).where(
            UnifiedMFLookthrough.tenant_id == tenant_id,
            UnifiedMFLookthrough.mf_id == instrument_id,
            UnifiedMFLookthrough.date <= target_date,
        ).order_by(UnifiedMFLookthrough.date.desc()).limit(1)
    )
    lookthrough = lt_result.scalar_one_or_none()

    # Rankings
    rank_result = await db.execute(
        select(UnifiedMFRanking).where(
            UnifiedMFRanking.tenant_id == tenant_id,
            UnifiedMFRanking.mf_id == instrument_id,
            UnifiedMFRanking.date <= target_date,
        ).order_by(UnifiedMFRanking.date.desc()).limit(1)
    )
    factor_percentiles = rank_result.scalar_one_or_none()

    # Holdings (top 20)
    holdings_result = await db.execute(text("""
        SELECT
            h.child_id,
            h.child_name,
            h.weight_pct,
            h.sector,
            m.state AS child_state,
            m.action AS child_action,
            m.rs_nifty_3m_rank,
            m.ret_3m,
            m.frag_score
        FROM unified_mf_holdings_detail h
        LEFT JOIN unified_metrics m ON m.instrument_id = h.child_id
            AND m.tenant_id = h.tenant_id
            AND m.date = (
                SELECT MAX(date) FROM unified_metrics
                WHERE tenant_id = h.tenant_id AND instrument_id = h.child_id AND date <= h.date
            )
        WHERE h.tenant_id = :tenant_id
          AND h.mf_id = :mf_id
          AND h.date = (
              SELECT MAX(date) FROM unified_mf_holdings_detail
              WHERE tenant_id = :tenant_id AND mf_id = :mf_id
          )
          AND h.child_id IS NOT NULL
        ORDER BY h.weight_pct DESC NULLS LAST
        LIMIT 20
    """), {"tenant_id": tenant_id, "mf_id": instrument_id})
    holdings = [dict(r) for r in holdings_result.mappings().all()]

    return {
        "instrument": instrument,
        "lookthrough": lookthrough,
        "factor_percentiles": factor_percentiles,
        "holdings": holdings,
        "date": target_date,
    }


# ---------------------------------------------------------------------------
# 7. Fund Holdings
# ---------------------------------------------------------------------------


async def get_fund_holdings(
    db: AsyncSession,
    instrument_id: str,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> Optional[dict[str, Any]]:
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return None

    inst_result = await db.execute(
        select(UnifiedInstrument).where(
            UnifiedInstrument.instrument_id == instrument_id,
            UnifiedInstrument.tenant_id == tenant_id,
        )
    )
    instrument = inst_result.scalar_one_or_none()
    if instrument is None:
        return None

    holdings_result = await db.execute(text("""
        SELECT
            h.child_id,
            h.child_name,
            h.weight_pct,
            h.sector,
            m.state AS child_state,
            m.action AS child_action,
            m.rs_nifty_3m_rank,
            m.ret_3m,
            m.frag_score
        FROM unified_mf_holdings_detail h
        LEFT JOIN unified_metrics m ON m.instrument_id = h.child_id
            AND m.tenant_id = h.tenant_id
            AND m.date = (
                SELECT MAX(date) FROM unified_metrics
                WHERE tenant_id = h.tenant_id AND instrument_id = h.child_id AND date <= h.date
            )
        WHERE h.tenant_id = :tenant_id
          AND h.mf_id = :mf_id
          AND h.date = (
              SELECT MAX(date) FROM unified_mf_holdings_detail
              WHERE tenant_id = :tenant_id AND mf_id = :mf_id
          )
          AND h.child_id IS NOT NULL
        ORDER BY h.weight_pct DESC NULLS LAST
        LIMIT 20
    """), {"tenant_id": tenant_id, "mf_id": instrument_id})
    holdings = [dict(r) for r in holdings_result.mappings().all()]

    return {
        "instrument": instrument,
        "holdings": holdings,
        "date": target_date,
    }


# ---------------------------------------------------------------------------
# 8. Fund Categories
# ---------------------------------------------------------------------------


async def get_fund_categories(
    db: AsyncSession,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> list[dict[str, Any]]:
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return []

    sql = text("""
    SELECT
        r.mf_category,
        COUNT(*) AS fund_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_momentum_pct) AS median_momentum_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_quality_pct) AS median_quality_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_resilience_pct) AS median_resilience_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_holdings_pct) AS median_holdings_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_cost_pct) AS median_cost_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.factor_consistency_pct) AS median_consistency_pct,
        AVG(r.aum_cr) AS avg_aum_cr
    FROM unified_mf_rankings r
    WHERE r.tenant_id = :tenant_id
      AND r.date = :target_date
    GROUP BY r.mf_category
    ORDER BY fund_count DESC
    """)
    result = await db.execute(sql, {"tenant_id": tenant_id, "target_date": target_date})
    return [dict(r) for r in result.mappings().all()]


# ---------------------------------------------------------------------------
# 9. Fund Screen
# ---------------------------------------------------------------------------


_ALLOWED_FUND_SCREEN_FIELDS: set[str] = {
    "mf_category",
    "cap_tilt",
    "factor_momentum_pct",
    "factor_quality_pct",
    "factor_resilience_pct",
    "factor_holdings_pct",
    "factor_cost_pct",
    "factor_consistency_pct",
    "action",
    "aum_cr",
    "expense_ratio",
}


async def run_fund_screen(
    db: AsyncSession,
    filters: list[dict[str, Any]],
    sort_field: Optional[str],
    sort_direction: str,
    limit: int,
    offset: int,
    tenant_id: str = "default",
) -> dict[str, Any]:
    target_date = await _latest_metric_date(db, tenant_id)
    if target_date is None:
        return {"rows": [], "total_count": 0}

    where_clauses: list[str] = ["r.tenant_id = :tenant_id", "r.date = :target_date"]
    params: dict[str, Any] = {"tenant_id": tenant_id, "target_date": target_date}

    for idx, f in enumerate(filters):
        field = f.get("field")
        op = f.get("op", "gte")
        value = f.get("value")
        if field is None or field not in _ALLOWED_FUND_SCREEN_FIELDS:
            continue
        fragment, frag_params = _build_where_fragment(field, op, value, idx)
        # remap column prefix from m. to r.
        fragment = fragment.replace("m.", "r.")
        where_clauses.append(fragment)
        params.update(frag_params)

    where_sql = " AND ".join(where_clauses)

    sort_col = f"r.{sort_field}" if sort_field in _ALLOWED_FUND_SCREEN_FIELDS else "r.factor_momentum_pct"
    sort_dir = "ASC" if sort_direction.lower() == "asc" else "DESC"

    count_sql = text(f"""
    SELECT COUNT(*) AS cnt
    FROM unified_mf_rankings r
    WHERE {where_sql}
    """)

    data_sql = text(f"""
    SELECT
        r.mf_id AS instrument_id,
        i.symbol,
        i.name,
        r.mf_category,
        r.cap_tilt,
        r.factor_momentum_pct,
        r.factor_quality_pct,
        r.factor_resilience_pct,
        r.factor_holdings_pct,
        r.factor_cost_pct,
        r.factor_consistency_pct,
        r.action,
        r.aum_cr,
        r.expense_ratio
    FROM unified_mf_rankings r
    JOIN unified_instruments i ON i.instrument_id = r.mf_id AND i.tenant_id = r.tenant_id
    WHERE {where_sql}
    ORDER BY {sort_col} {sort_dir} NULLS LAST
    LIMIT :limit OFFSET :offset
    """)

    params_with_pagination = {**params, "limit": limit, "offset": offset}

    count_result = await db.execute(count_sql, params)
    total_count = count_result.scalar_one_or_none() or 0

    data_result = await db.execute(data_sql, params_with_pagination)
    rows = data_result.mappings().all()

    return {
        "rows": [dict(r) for r in rows],
        "total_count": total_count,
    }


# ---------------------------------------------------------------------------
# 10. Global Aggregate
# ---------------------------------------------------------------------------


async def get_global_aggregate(
    db: AsyncSession,
    snapshot_date: Optional[date] = None,
    tenant_id: str = "default",
) -> list[dict[str, Any]]:
    target_date = snapshot_date
    if target_date is None:
        target_date = await _latest_metric_date(db, tenant_id)
        if target_date is None:
            return []

    sql = text("""
    SELECT
        i.country AS country,
        COUNT(*) AS instrument_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_sp500_3m_rank) AS median_rs_sp500_3m,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_msci_3m_rank) AS median_rs_msci_3m,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.ret_3m) AS median_ret_3m,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.ret_12m) AS median_ret_12m,
        AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_leader,
        MODE() WITHIN GROUP (ORDER BY m.action) AS consensus_action
    FROM unified_metrics m
    JOIN unified_instruments i ON i.instrument_id = m.instrument_id AND i.tenant_id = m.tenant_id
    WHERE m.tenant_id = :tenant_id
      AND m.date = :target_date
      AND i.instrument_type IN ('INDEX_GLOBAL', 'ETF')
      AND i.country != 'IN'
    GROUP BY i.country
    ORDER BY instrument_count DESC
    """)
    result = await db.execute(sql, {"tenant_id": tenant_id, "target_date": target_date})
    return [dict(r) for r in result.mappings().all()]
