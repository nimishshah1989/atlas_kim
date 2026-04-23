"""MF / ETF 6-factor ranking engine.

Computes independent factor percentiles within each category.
No composite score — 6 independent percentiles only.

Deterministic — no LLMs. Heavy lifting in PostgreSQL.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory

log = structlog.get_logger()
TENANT_ID = "default"

_MF_UNIVERSE_PATH = Path("/tmp/mf_universe.json")
_ETF_UNIVERSE_PATH = Path("/tmp/etf_universe.json")


def _load_cost_map() -> dict[str, tuple[float | None, float | None]]:
    """Load expense_ratio and AUM (INR Cr) from Morningstar universe JSONs."""
    mapping: dict[str, tuple[float | None, float | None]] = {}
    for path in (_MF_UNIVERSE_PATH, _ETF_UNIVERSE_PATH):
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
            for item in data:
                sid = item.get("mstar_id") or item.get("isin")
                if not sid:
                    continue
                er = item.get("expense_ratio")
                aum = item.get("aum")
                mapping[sid] = (
                    float(er) if er is not None else None,
                    float(aum) / 1_00_00_000 if aum is not None else None,  # convert to Cr
                )
        except Exception as exc:
            log.warning("cost_map_load_failed", path=str(path), error=str(exc))
    return mapping


async def _upsert_cost_data(db: AsyncSession) -> int:
    """Upsert expense_ratio / AUM into a temp mapping table for SQL joins."""
    cost_map = _load_cost_map()
    if not cost_map:
        return 0

    # Create temp table (preserved across commits in this session)
    await db.execute(text("""
        CREATE TEMP TABLE IF NOT EXISTS _mf_cost_map (
            instrument_id VARCHAR(50) PRIMARY KEY,
            expense_ratio DOUBLE PRECISION,
            aum_cr DOUBLE PRECISION
        )
    """))
    await db.execute(text("TRUNCATE _mf_cost_map"))

    # Bulk insert
    values = []
    for sid, (er, aum) in cost_map.items():
        values.append({"id": sid, "er": er, "aum": aum})

    if values:
        await db.execute(text("""
            INSERT INTO _mf_cost_map (instrument_id, expense_ratio, aum_cr)
            VALUES (:id, :er, :aum)
            ON CONFLICT (instrument_id) DO UPDATE SET
                expense_ratio = EXCLUDED.expense_ratio,
                aum_cr = EXCLUDED.aum_cr
        """), values)
    await db.commit()
    return len(values)


async def compute_mf_rankings(db: AsyncSession, target_date: date | None = None) -> int:
    """Compute 6-factor independent percentiles for MFs and ETFs."""
    if target_date is None:
        r = await db.execute(text("""
            SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id
        """), {"tenant_id": TENANT_ID})
        target_date = r.scalar_one()
        if target_date is None:
            return 0

    log.info("compute_mf_rankings_start", date=target_date.isoformat())

    # Load cost data into temp table
    cost_rows = await _upsert_cost_data(db)
    log.info("cost_data_loaded", rows=cost_rows)

    sql = """
    WITH base AS (
        SELECT
            i.instrument_id,
            i.mf_category,
            i.instrument_type,
            m.rs_nifty_3m_rank,
            m.rs_nifty_12m_rank,
            m.above_ema_50,
            m.golden_cross,
            m.ret_3m,
            m.ret_6m,
            m.ret_12m,
            m.vol_21d,
            t.sharpe_1y,
            t.sortino_1y,
            t.calmar_ratio,
            t.max_drawdown_1y,
            t.volatility_20d,
            t.volatility_60d,
            t.beta_nifty,
            t.roc_252,
            t.information_ratio_3y,
            lt.lookthrough_rs_3m,
            lt.pct_holdings_leader,
            lt.top10_concentration,
            lt.sector_herfindahl,
            lt.cap_tilt,
            COALESCE(cm.expense_ratio, mm.expense_ratio, em.expense_ratio) AS expense_ratio,
            COALESCE(cm.aum_cr, 0) AS aum_cr
        FROM unified_instruments i
        JOIN unified_metrics m ON m.instrument_id = i.instrument_id
            AND m.tenant_id = i.tenant_id
            AND m.date = :target_date
        LEFT JOIN de_mf_technical_daily t ON t.mstar_id = i.instrument_id
            AND t.nav_date = (
                SELECT MAX(nav_date) FROM de_mf_technical_daily
                WHERE mstar_id = i.instrument_id AND nav_date <= :target_date
            )
        LEFT JOIN unified_mf_lookthrough lt ON lt.mf_id = i.instrument_id
            AND lt.tenant_id = i.tenant_id
            AND lt.date = (
                SELECT MAX(date) FROM unified_mf_lookthrough
                WHERE mf_id = i.instrument_id AND tenant_id = i.tenant_id AND date <= :target_date
            )
        LEFT JOIN _mf_cost_map cm ON cm.instrument_id = i.instrument_id
        LEFT JOIN de_mf_master mm ON mm.mstar_id = i.instrument_id
        LEFT JOIN de_etf_master em ON em.ticker = i.instrument_id
        WHERE i.tenant_id = :tenant_id
          AND i.instrument_type IN ('MF', 'ETF')
          AND i.mf_category IS NOT NULL
    ),
    -- Raw factor scores (higher = better for all factors)
    scored AS (
        SELECT
            instrument_id,
            mf_category,
            instrument_type,
            cap_tilt,
            lookthrough_rs_3m,
            pct_holdings_leader,
            top10_concentration,
            sector_herfindahl,
            expense_ratio,
            aum_cr,

            -- 1. Momentum: NAV RS + trend flags
            (
                COALESCE(rs_nifty_3m_rank, 50) * 0.4 +
                COALESCE(rs_nifty_12m_rank, 50) * 0.3 +
                (CASE WHEN above_ema_50 THEN 100.0 ELSE 0.0 END) * 0.15 +
                (CASE WHEN golden_cross THEN 100.0 ELSE 0.0 END) * 0.15
            ) AS raw_momentum,

            -- 2. Risk-Adjusted Quality: Sharpe, Sortino, Calmar
            (
                COALESCE(sharpe_1y, 0) * 30.0 +
                COALESCE(sortino_1y, 0) * 30.0 +
                COALESCE(calmar_ratio, 0) * 20.0 +
                COALESCE(information_ratio_3y, 0) * 20.0
            ) AS raw_quality,

            -- 3. Resilience: inverted drawdown + low vol
            (
                COALESCE(-max_drawdown_1y, 0) * 5.0 +
                GREATEST(0, 50.0 - COALESCE(volatility_20d, 20.0)) * 2.0 +
                GREATEST(0, 50.0 - COALESCE(volatility_60d, 20.0)) * 1.0
            ) AS raw_resilience,

            -- 4. Holdings Quality: lookthrough RS + leader % + concentration
            (
                COALESCE(lookthrough_rs_3m, 50) * 0.4 +
                COALESCE(pct_holdings_leader, 0) * 3.0 +
                GREATEST(0, 100.0 - COALESCE(top10_concentration, 50.0)) * 0.2
            ) AS raw_holdings,

            -- 5. Cost Efficiency: inverted expense ratio + log AUM
            (
                GREATEST(0, 3.0 - COALESCE(expense_ratio, 1.5)) * 50.0 +
                CASE WHEN aum_cr > 0 THEN LN(aum_cr) * 10.0 ELSE 0 END
            ) AS raw_cost,

            -- 6. Consistency: positive return consistency + low std dev
            (
                (CASE WHEN ret_3m > 0 THEN 25.0 ELSE 0 END) +
                (CASE WHEN ret_6m > 0 THEN 25.0 ELSE 0 END) +
                (CASE WHEN ret_12m > 0 THEN 25.0 ELSE 0 END) +
                GREATEST(0, 30.0 - COALESCE(volatility_20d, 15.0)) * 1.0
            ) AS raw_consistency

        FROM base
    ),
    -- Percentile rank within each category (higher = better)
    ranked AS (
        SELECT
            *,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_momentum) * 100.0)::double precision AS factor_momentum_pct,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_quality) * 100.0)::double precision AS factor_quality_pct,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_resilience) * 100.0)::double precision AS factor_resilience_pct,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_holdings) * 100.0)::double precision AS factor_holdings_pct,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_cost) * 100.0)::double precision AS factor_cost_pct,
            (PERCENT_RANK() OVER (PARTITION BY mf_category ORDER BY raw_consistency) * 100.0)::double precision AS factor_consistency_pct,
            COUNT(*) OVER (PARTITION BY mf_category) AS total_in_category
        FROM scored
    )
    INSERT INTO unified_mf_rankings (
        date, tenant_id, mf_id, mf_category,
        factor_momentum_pct, factor_quality_pct, factor_resilience_pct,
        factor_holdings_pct, factor_cost_pct, factor_consistency_pct,
        lookthrough_rs_3m, lookthrough_rs_12m,
        pct_holdings_leader, pct_holdings_emerging,
        sector_herfindahl, top10_concentration,
        cap_tilt, aum_cr, expense_ratio,
        action,
        rank_in_category, total_in_category,
        created_at
    )
    SELECT
        :target_date,
        :tenant_id,
        instrument_id,
        mf_category,
        factor_momentum_pct,
        factor_quality_pct,
        factor_resilience_pct,
        factor_holdings_pct,
        factor_cost_pct,
        factor_consistency_pct,
        lookthrough_rs_3m,
        NULL::double precision,
        pct_holdings_leader,
        NULL::double precision,
        sector_herfindahl,
        top10_concentration,
        cap_tilt,
        aum_cr,
        expense_ratio,
        CASE
            WHEN factor_momentum_pct >= 80 AND factor_holdings_pct >= 70 THEN 'STRONG_ACCUMULATE'
            WHEN factor_momentum_pct >= 60 AND factor_holdings_pct >= 50 THEN 'ACCUMULATE'
            WHEN factor_momentum_pct < 30 AND factor_resilience_pct < 30 THEN 'EXIT'
            WHEN factor_momentum_pct < 50 AND factor_resilience_pct < 40 THEN 'REDUCE'
            ELSE 'HOLD'
        END,
        ROW_NUMBER() OVER (PARTITION BY mf_category ORDER BY factor_momentum_pct + factor_holdings_pct DESC),
        total_in_category,
        NOW()
    FROM ranked
    ON CONFLICT (date, tenant_id, mf_id) DO UPDATE SET
        mf_category = EXCLUDED.mf_category,
        factor_momentum_pct = EXCLUDED.factor_momentum_pct,
        factor_quality_pct = EXCLUDED.factor_quality_pct,
        factor_resilience_pct = EXCLUDED.factor_resilience_pct,
        factor_holdings_pct = EXCLUDED.factor_holdings_pct,
        factor_cost_pct = EXCLUDED.factor_cost_pct,
        factor_consistency_pct = EXCLUDED.factor_consistency_pct,
        lookthrough_rs_3m = EXCLUDED.lookthrough_rs_3m,
        pct_holdings_leader = EXCLUDED.pct_holdings_leader,
        sector_herfindahl = EXCLUDED.sector_herfindahl,
        top10_concentration = EXCLUDED.top10_concentration,
        cap_tilt = EXCLUDED.cap_tilt,
        aum_cr = EXCLUDED.aum_cr,
        expense_ratio = EXCLUDED.expense_ratio,
        action = EXCLUDED.action,
        rank_in_category = EXCLUDED.rank_in_category,
        total_in_category = EXCLUDED.total_in_category,
        updated_at = NOW()
    """

    await db.execute(text("SET LOCAL statement_timeout = '600000'"))
    await db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    await db.commit()

    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_mf_rankings
        WHERE tenant_id = :tenant_id AND date = :target_date
    """), {"tenant_id": TENANT_ID, "target_date": target_date})
    cnt = cnt_res.scalar_one()
    log.info("compute_mf_rankings_done", date=target_date.isoformat(), rows=cnt)
    return cnt


async def run_ranking_pipeline(target_date: date | None = None) -> dict[str, Any]:
    """Run the 6-factor ranking pipeline."""
    results: dict[str, Any] = {}
    async with async_session_factory() as db:
        try:
            cnt = await compute_mf_rankings(db, target_date)
            results["rankings"] = {"status": "SUCCESS", "rows": cnt}
        except Exception as exc:
            log.error("rankings_failed", error=str(exc))
            await db.rollback()
            results["rankings"] = {"status": "FAILED", "error": str(exc)}
    return results
