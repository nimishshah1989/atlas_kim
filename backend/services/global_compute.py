"""Global market compute pipeline.

1. Syncs global instruments into unified_instruments.
2. Computes returns, RS ranks vs MSCI World / S&P 500, states & actions.
3. Stores in unified_metrics.
4. Computes global regime/breadth and stores in unified_market_regime with region='GLOBAL'.

Deterministic — no LLMs.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory

log = structlog.get_logger()
TENANT_ID = "default"

_TARGET_GLOBAL_TICKERS: list[str] = [
    "^SPX", "^NDQ", "^DAX", "^DJI", "^NKX", "^UKX", "^AXJO", "^CAC",
    "^SHBS", "^TNX", "^TYX",
    "SPY", "QQQ", "EEM", "EFA", "GLD", "SLV", "VTI", "VOO",
    "XLF", "XLK", "XLE",
]

_PERIODS: list[tuple[str, int]] = [
    ("1d", 1),
    ("1w", 5),
    ("1m", 21),
    ("3m", 63),
    ("6m", 126),
    ("12m", 252),
]


async def sync_global_instruments(db: AsyncSession) -> int:
    """Ensure target global tickers exist in unified_instruments."""
    log.info("sync_global_instruments_start")

    sql = """
    INSERT INTO unified_instruments (
        instrument_id, tenant_id, symbol, name, instrument_type,
        sector, industry, country, exchange, cap_category, mf_category, is_active,
        benchmarks, meta, created_at, updated_at
    )
    SELECT
        gp.ticker,
        :tenant_id,
        gp.ticker,
        COALESCE(gim.name, gp.ticker),
        CASE WHEN gim.instrument_type = 'etf' THEN 'ETF'::text ELSE 'INDEX_GLOBAL'::text END,
        NULL::text,
        NULL::text,
        CASE
            WHEN gp.ticker LIKE '^%' THEN
                CASE
                    WHEN gp.ticker IN ('^SPX', '^NDQ', '^DJI', '^TNX', '^TYX') THEN 'US'
                    WHEN gp.ticker = '^DAX' THEN 'DE'
                    WHEN gp.ticker = '^NKX' THEN 'JP'
                    WHEN gp.ticker = '^UKX' THEN 'GB'
                    WHEN gp.ticker = '^AXJO' THEN 'AU'
                    WHEN gp.ticker = '^CAC' THEN 'FR'
                    WHEN gp.ticker = '^SHBS' THEN 'CN'
                    ELSE 'US'
                END
            ELSE 'US'
        END::text,
        'GLOBAL'::text,
        NULL::text,
        NULL::text,
        true,
        '[]'::jsonb,
        '{}'::jsonb,
        NOW(), NOW()
    FROM (SELECT DISTINCT ticker FROM de_global_price_daily
          WHERE ticker = ANY(:tickers)) gp
    LEFT JOIN de_global_instrument_master gim ON gim.ticker = gp.ticker
    ON CONFLICT (instrument_id) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        instrument_type = EXCLUDED.instrument_type,
        country = EXCLUDED.country,
        updated_at = NOW()
    """
    await db.execute(text(sql), {
        "tenant_id": TENANT_ID,
        "tickers": _TARGET_GLOBAL_TICKERS,
    })
    await db.commit()

    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_instruments
        WHERE tenant_id = :tenant_id AND instrument_id = ANY(:tickers)
    """), {"tenant_id": TENANT_ID, "tickers": _TARGET_GLOBAL_TICKERS})
    cnt = cnt_res.scalar_one()
    log.info("sync_global_instruments_done", count=cnt)
    return cnt


async def compute_global_metrics_for_date(db: AsyncSession, target_date: date) -> int:
    """Compute unified_metrics for global instruments for a single date."""
    log.info("compute_global_metrics", date=target_date.isoformat())

    start_date = target_date - timedelta(days=400)

    sql = """
    WITH price_union AS (
        SELECT ticker AS instrument_id, date, close::numeric AS px
        FROM de_global_price_daily
        WHERE ticker = ANY(:tickers)
          AND date BETWEEN :start_date AND :end_date
    ),
    bench_msci AS (
        SELECT date, close::numeric AS bench_px
        FROM de_global_price_daily
        WHERE ticker = 'URTH'
          AND date BETWEEN :start_date AND :end_date
    ),
    bench_sp500 AS (
        SELECT date, close::numeric AS bench_px
        FROM de_global_price_daily
        WHERE ticker = '^GSPC'
          AND date BETWEEN :start_date AND :end_date
    ),
    computed AS (
        SELECT
            pu.instrument_id,
            pu.date,
            pu.px,
            (pu.px / NULLIF(LAG(pu.px, 1) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_1d,
            (pu.px / NULLIF(LAG(pu.px, 5) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_1w,
            (pu.px / NULLIF(LAG(pu.px, 21) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_1m,
            (pu.px / NULLIF(LAG(pu.px, 63) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_3m,
            (pu.px / NULLIF(LAG(pu.px, 126) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_6m,
            (pu.px / NULLIF(LAG(pu.px, 252) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_12m,
            -- RS vs MSCI World
            (PERCENT_RANK() OVER (PARTITION BY pu.date ORDER BY (pu.px / NULLIF(bm.bench_px, 0) - 1.0) DESC NULLS LAST) * 100.0)::double precision AS rs_msci_3m_rank,
            (PERCENT_RANK() OVER (PARTITION BY pu.date ORDER BY (pu.px / NULLIF(bm.bench_px, 0) - 1.0) DESC NULLS LAST) * 100.0)::double precision AS rs_msci_12m_rank,
            -- RS vs S&P 500
            (PERCENT_RANK() OVER (PARTITION BY pu.date ORDER BY (pu.px / NULLIF(bs.bench_px, 0) - 1.0) DESC NULLS LAST) * 100.0)::double precision AS rs_sp500_3m_rank,
            (PERCENT_RANK() OVER (PARTITION BY pu.date ORDER BY (pu.px / NULLIF(bs.bench_px, 0) - 1.0) DESC NULLS LAST) * 100.0)::double precision AS rs_sp500_12m_rank
        FROM price_union pu
        LEFT JOIN bench_msci bm ON bm.date = pu.date
        LEFT JOIN bench_sp500 bs ON bs.date = pu.date
    )
    INSERT INTO unified_metrics (
        tenant_id, instrument_id, date,
        ret_1d, ret_1w, ret_1m, ret_3m, ret_6m, ret_12m,
        rs_msci_3m_rank, rs_msci_12m_rank,
        rs_sp500_3m_rank, rs_sp500_12m_rank,
        state, action, frag_score, frag_level,
        created_at, updated_at
    )
    SELECT
        :tenant_id,
        c.instrument_id,
        c.date,
        c.ret_1d, c.ret_1w, c.ret_1m, c.ret_3m, c.ret_6m, c.ret_12m,
        c.rs_msci_3m_rank, c.rs_msci_12m_rank,
        c.rs_sp500_3m_rank, c.rs_sp500_12m_rank,
        CASE
            WHEN c.rs_sp500_3m_rank >= 80 AND c.rs_sp500_12m_rank >= 70 THEN 'LEADER'
            WHEN c.rs_sp500_3m_rank >= 60 AND c.rs_sp500_12m_rank >= 50 THEN 'EMERGING'
            WHEN c.rs_sp500_3m_rank < 40 AND c.rs_sp500_12m_rank < 40 THEN 'LAGGING'
            WHEN c.rs_sp500_3m_rank < 30 THEN 'BROKEN'
            WHEN c.rs_sp500_3m_rank >= 60 AND c.rs_sp500_12m_rank < 50 THEN 'WEAKENING'
            WHEN c.rs_sp500_3m_rank >= 40 AND c.rs_sp500_3m_rank < 80 THEN 'HOLDING'
            ELSE 'BASE'
        END::text,
        CASE
            WHEN c.rs_sp500_3m_rank >= 80 THEN 'STRONG_ACCUMULATE'
            WHEN c.rs_sp500_3m_rank >= 60 THEN 'ACCUMULATE'
            WHEN c.rs_sp500_3m_rank < 30 THEN 'EXIT'
            WHEN c.rs_sp500_3m_rank < 40 THEN 'REDUCE'
            ELSE 'HOLD'
        END::text,
        LEAST(1.0, GREATEST(0.0,
            (1.0 - COALESCE(c.rs_sp500_3m_rank, 50) / 100.0) * 0.5 +
            COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.5
        ))::double precision,
        CASE
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_sp500_3m_rank, 50) / 100.0) * 0.5 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.5
            )) >= 0.7 THEN 'CRITICAL'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_sp500_3m_rank, 50) / 100.0) * 0.5 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.5
            )) >= 0.4 THEN 'HIGH'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_sp500_3m_rank, 50) / 100.0) * 0.5 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.5
            )) >= 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END::text,
        NOW(), NOW()
    FROM computed c
    WHERE c.date = :target_date
      AND c.px IS NOT NULL
    ON CONFLICT (tenant_id, instrument_id, date) DO UPDATE SET
        ret_1d = EXCLUDED.ret_1d,
        ret_1w = EXCLUDED.ret_1w,
        ret_1m = EXCLUDED.ret_1m,
        ret_3m = EXCLUDED.ret_3m,
        ret_6m = EXCLUDED.ret_6m,
        ret_12m = EXCLUDED.ret_12m,
        rs_msci_3m_rank = EXCLUDED.rs_msci_3m_rank,
        rs_msci_12m_rank = EXCLUDED.rs_msci_12m_rank,
        rs_sp500_3m_rank = EXCLUDED.rs_sp500_3m_rank,
        rs_sp500_12m_rank = EXCLUDED.rs_sp500_12m_rank,
        state = EXCLUDED.state,
        action = EXCLUDED.action,
        frag_score = EXCLUDED.frag_score,
        frag_level = EXCLUDED.frag_level,
        updated_at = NOW()
    """

    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    await db.execute(text(sql), {
        "tenant_id": TENANT_ID,
        "tickers": _TARGET_GLOBAL_TICKERS,
        "start_date": start_date,
        "end_date": target_date,
        "target_date": target_date,
    })
    await db.commit()

    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_metrics
        WHERE tenant_id = :tenant_id AND date = :target_date
          AND instrument_id = ANY(:tickers)
    """), {"tenant_id": TENANT_ID, "target_date": target_date, "tickers": _TARGET_GLOBAL_TICKERS})
    cnt = cnt_res.scalar_one()
    log.info("compute_global_metrics_done", date=target_date.isoformat(), rows=cnt)
    return cnt


async def compute_global_regime(db: AsyncSession, target_date: date) -> int:
    """Compute global market regime using global tickers as universe."""
    log.info("compute_global_regime", date=target_date.isoformat())

    sql = """
    WITH params AS (SELECT CAST(:target_date AS date) AS d, CAST(:tenant_id AS varchar) AS t),
    daily AS (
        SELECT
            COUNT(*) AS total,
            AVG(CASE WHEN m.ret_1m > 0 THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_positive_1m,
            AVG(CASE WHEN m.ret_3m > 0 THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_positive_3m,
            AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0 AS participation,
            STDDEV_SAMP(COALESCE(m.rs_sp500_3m_rank, 50)) AS rs_dispersion,
            AVG(CASE WHEN m.action IN ('STRONG_ACCUMULATE','ACCUMULATE') THEN 1.0 ELSE 0.0 END) * 100.0 AS accumulate_pct
        FROM unified_metrics m
        CROSS JOIN params p
        WHERE m.tenant_id = p.t
          AND m.date = p.d
          AND m.instrument_id = ANY(:tickers)
    )
    INSERT INTO unified_market_regime (
        date, tenant_id, region,
        pct_above_ema_20, pct_above_ema_50, pct_above_ema_200, pct_golden_cross,
        participation, rs_dispersion, health_score, health_zone, regime, direction
    )
    SELECT
        p.d,
        p.t,
        'GLOBAL',
        d.pct_positive_1m::double precision,
        d.pct_positive_3m::double precision,
        NULL::double precision,
        NULL::double precision,
        d.participation::double precision,
        d.rs_dispersion::double precision,
        (
            (COALESCE(d.pct_positive_3m, 50) / 100.0) * 0.4 +
            (COALESCE(d.participation, 10) / 100.0) * 0.3 +
            (COALESCE(d.accumulate_pct, 50) / 100.0) * 0.3
        ) * 100.0::double precision AS health_score,
        CASE
            WHEN d.participation >= 20 AND d.pct_positive_3m >= 60 THEN 'BULLISH'
            WHEN d.participation >= 10 AND d.pct_positive_3m >= 45 THEN 'HEALTHY'
            WHEN d.participation >= 5  AND d.pct_positive_3m >= 30 THEN 'NEUTRAL'
            WHEN d.pct_positive_3m >= 20 THEN 'WEAK'
            ELSE 'FEAR'
        END::text AS health_zone,
        CASE
            WHEN d.participation >= 20 AND d.pct_positive_3m >= 60 AND d.accumulate_pct >= 60 THEN 'BULLISH_FULL_RISK'
            WHEN d.participation >= 10 AND d.pct_positive_3m >= 45 THEN 'CAUTION_SELECTIVE'
            WHEN d.pct_positive_3m >= 30 THEN 'CAUTION_DEFENSIVE'
            ELSE 'BEARISH_ACCUMULATE'
        END::text AS regime,
        CASE
            WHEN d.participation >= 20 AND d.pct_positive_3m >= 60 THEN 'ACCELERATING'
            WHEN d.participation >= 10 AND d.pct_positive_3m >= 45 THEN 'IMPROVING'
            WHEN d.pct_positive_3m >= 30 THEN 'MIXED'
            ELSE 'DETERIORATING'
        END::text AS direction
    FROM daily d, params p
    ON CONFLICT (date, tenant_id, region) DO UPDATE SET
        pct_above_ema_20 = EXCLUDED.pct_above_ema_20,
        pct_above_ema_50 = EXCLUDED.pct_above_ema_50,
        pct_golden_cross = EXCLUDED.pct_golden_cross,
        participation    = EXCLUDED.participation,
        rs_dispersion    = EXCLUDED.rs_dispersion,
        health_score     = EXCLUDED.health_score,
        health_zone      = EXCLUDED.health_zone,
        regime           = EXCLUDED.regime,
        direction        = EXCLUDED.direction,
        updated_at       = NOW()
    """
    await db.execute(text(sql), {
        "tenant_id": TENANT_ID,
        "target_date": target_date,
        "tickers": _TARGET_GLOBAL_TICKERS,
    })
    await db.commit()
    return 1


async def run_global_pipeline(
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Run the full global compute pipeline."""
    log.info("global_pipeline_start")
    results: dict[str, Any] = {"phases": []}

    async with async_session_factory() as db:
        # Phase 1: Sync instruments
        try:
            inst_cnt = await sync_global_instruments(db)
            results["phases"].append({"phase": "instruments", "status": "SUCCESS", "rows": inst_cnt})
        except Exception as exc:
            log.error("global_instruments_failed", error=str(exc))
            results["phases"].append({"phase": "instruments", "status": "FAILED", "error": str(exc)})
            return results

        if end_date is None:
            end_date = datetime.utcnow().date()
        if start_date is None:
            start_date = end_date

        dates_to_compute = []
        d = start_date
        while d <= end_date:
            dates_to_compute.append(d)
            d += timedelta(days=1)

        # Phase 2: Metrics
        total_metrics = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                cnt = await compute_global_metrics_for_date(db, target_date)
                total_metrics += cnt
            except Exception as exc:
                log.warning("global_metrics_date_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        results["phases"].append({"phase": "metrics", "status": "SUCCESS", "rows": total_metrics})

        # Phase 3: Global Regime
        total_regime = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                await compute_global_regime(db, target_date)
                total_regime += 1
            except Exception as exc:
                log.warning("global_regime_date_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        results["phases"].append({"phase": "global_regime", "status": "SUCCESS", "rows": total_regime})

    return results
