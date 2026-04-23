"""Unified RS Intelligence Engine — compute pipeline.

Deterministic, SQL-window-function-based pipeline that:
  1. Populates unified_instruments from source masters.
  2. Computes returns, RS ranks, states, actions for every active date.
  3. Computes market regime & sector breadth.
  4. Writes idempotently.

No LLMs. Heavy lifting in PostgreSQL.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from typing import Any, Optional

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory

log = structlog.get_logger()

TENANT_ID = "default"

_BENCHMARKS: dict[str, dict[str, str]] = {
    "nifty":    {"table": "de_index_prices",   "code_col": "index_code", "code": "NIFTY 50",   "col": "close"},
    "nifty500": {"table": "de_index_prices",   "code_col": "index_code", "code": "NIFTY 500",  "col": "close"},
    "sp500":    {"table": "de_global_prices",  "code_col": "ticker",     "code": "^GSPC",      "col": "close"},
    "msci":     {"table": "de_global_prices",  "code_col": "ticker",     "code": "URTH",       "col": "close"},
    "gold":     {"table": "de_global_prices",  "code_col": "ticker",     "code": "GC=F",       "col": "close"},
}

_PERIODS: list[tuple[str, int]] = [
    ("1d", 1),
    ("1w", 5),
    ("1m", 21),
    ("3m", 63),
    ("6m", 126),
    ("12m", 252),
    ("24m", 504),
    ("36m", 756),
]


def _today() -> date:
    return datetime.utcnow().date()


async def _log_phase(
    db: AsyncSession,
    phase: str,
    status: str,
    rows_processed: int | None = None,
    error_message: str | None = None,
) -> None:
    stmt = text("""
        INSERT INTO unified_pipeline_log
            (tenant_id, run_date, phase, status, rows_processed, error_message, started_at, completed_at)
        VALUES
            (:tenant_id, :run_date, :phase, :status, :rows_processed, :error_message, :started_at, :completed_at)
        ON CONFLICT (tenant_id, run_date, phase) DO UPDATE SET
            status = EXCLUDED.status,
            rows_processed = EXCLUDED.rows_processed,
            error_message = EXCLUDED.error_message,
            completed_at = EXCLUDED.completed_at
    """)
    now = datetime.utcnow()
    await db.execute(stmt, {
        "tenant_id": TENANT_ID,
        "run_date": _today(),
        "phase": phase,
        "status": status,
        "rows_processed": rows_processed,
        "error_message": error_message,
        "started_at": now,
        "completed_at": now,
    })
    await db.commit()


# ---------------------------------------------------------------------------
# 1. Instruments
# ---------------------------------------------------------------------------

async def sync_instruments(db: AsyncSession) -> int:
    log.info("sync_instruments_start")
    sql = """
    WITH sources AS (
        SELECT
            i.id::text                        AS instrument_id,
            i.current_symbol                  AS symbol,
            COALESCE(i.company_name, i.current_symbol) AS name,
            'EQUITY'::text                    AS instrument_type,
            i.sector,
            i.industry,
            'IN'::text                        AS country,
            i.exchange,
            CASE
                WHEN i.nifty_50  THEN 'LARGE'::text
                WHEN i.nifty_200 THEN 'MID'::text
                WHEN i.nifty_500 THEN 'SMALL'::text
                ELSE NULL
            END                               AS cap_category,
            NULL::text                        AS mf_category,
            i.is_active
        FROM de_instrument i
        WHERE i.is_active = true
          AND i.series IN ('EQ', 'BE', 'BZ')

        UNION ALL

        SELECT
            em.ticker                         AS instrument_id,
            em.ticker                         AS symbol,
            COALESCE(em.name, em.ticker)      AS name,
            'ETF'::text                       AS instrument_type,
            em.sector,
            NULL::text                        AS industry,
            COALESCE(em.country, 'IN')::text  AS country,
            em.exchange,
            NULL::text                        AS cap_category,
            em.category                       AS mf_category,
            em.is_active
        FROM de_etf_master em
        WHERE em.is_active = true

        UNION ALL

        SELECT
            mm.mstar_id                       AS instrument_id,
            COALESCE(mm.amfi_code, mm.mstar_id) AS symbol,
            mm.fund_name                      AS name,
            'MF'::text                        AS instrument_type,
            NULL::text                        AS sector,
            NULL::text                        AS industry,
            'IN'::text                        AS country,
            NULL::text                        AS exchange,
            NULL::text                        AS cap_category,
            mm.category_name                  AS mf_category,
            mm.is_active
        FROM de_mf_master mm
        WHERE mm.is_active = true
          AND mm.closure_date IS NULL

        UNION ALL

        SELECT
            ip.index_code                     AS instrument_id,
            ip.index_code                     AS symbol,
            ip.index_code                     AS name,
            'INDEX'::text                     AS instrument_type,
            NULL::text                        AS sector,
            NULL::text                        AS industry,
            'IN'::text                        AS country,
            'NSE'::text                       AS exchange,
            NULL::text                        AS cap_category,
            NULL::text                        AS mf_category,
            true                              AS is_active
        FROM (SELECT DISTINCT index_code FROM de_index_prices) ip
        WHERE ip.index_code IN ('NIFTY 50','NIFTY 500','NIFTY BANK','NIFTY IT','NIFTY AUTO',
                                'NIFTY METAL','NIFTY PHARMA','NIFTY FMCG','NIFTY ENERGY',
                                'INDIA VIX','NIFTY MIDCAP 100','NIFTY SMALLCAP 250')

        UNION ALL

        SELECT
            gp.ticker                         AS instrument_id,
            gp.ticker                         AS symbol,
            gp.ticker                         AS name,
            'INDEX_GLOBAL'::text              AS instrument_type,
            NULL::text                        AS sector,
            NULL::text                        AS industry,
            CASE WHEN gp.ticker LIKE '^%' THEN 'US' ELSE 'US' END::text AS country,
            'GLOBAL'::text                    AS exchange,
            NULL::text                        AS cap_category,
            NULL::text                        AS mf_category,
            true                              AS is_active
        FROM (SELECT DISTINCT ticker FROM de_global_prices) gp
        WHERE gp.ticker IN ('^GSPC','URTH','GC=F')
    )
    INSERT INTO unified_instruments (
        instrument_id, tenant_id, symbol, name, instrument_type,
        sector, industry, country, exchange, cap_category, mf_category, is_active,
        benchmarks, meta, created_at, updated_at
    )
    SELECT
        instrument_id,
        :tenant_id,
        symbol,
        name,
        instrument_type,
        sector,
        industry,
        country,
        exchange,
        cap_category,
        mf_category,
        is_active,
        '[]'::jsonb,
        '{}'::jsonb,
        NOW(),
        NOW()
    FROM sources s
    ON CONFLICT (instrument_id) DO UPDATE SET
        symbol       = EXCLUDED.symbol,
        name         = EXCLUDED.name,
        sector       = EXCLUDED.sector,
        industry     = EXCLUDED.industry,
        exchange     = EXCLUDED.exchange,
        cap_category = EXCLUDED.cap_category,
        mf_category  = EXCLUDED.mf_category,
        is_active    = EXCLUDED.is_active,
        updated_at   = NOW()
    """
    result = await db.execute(text(sql), {"tenant_id": TENANT_ID})
    await db.commit()
    # Approximate count
    cnt_res = await db.execute(text("SELECT COUNT(*) FROM unified_instruments WHERE tenant_id = :tenant_id"),
                               {"tenant_id": TENANT_ID})
    cnt = cnt_res.scalar_one()
    log.info("sync_instruments_done", count=cnt)
    return cnt


# ---------------------------------------------------------------------------
# 2. Returns + Technicals + RS Ranks (single-date batch)
# ---------------------------------------------------------------------------

async def compute_metrics_for_date(db: AsyncSession, target_date: date) -> int:
    """Compute and insert unified_metrics for a single date."""
    log.info("compute_metrics_for_date", date=target_date.isoformat())

    start_date = target_date - timedelta(days=1100)  # ~3 years back for 36m ret

    # Build benchmark CTEs for each benchmark
    bench_ctes = []
    for alias, cfg in _BENCHMARKS.items():
        bench_ctes.append(f"""
        {alias}_bench AS (
            SELECT date, {cfg['col']}::numeric AS bench_px
            FROM {cfg['table']}
            WHERE {cfg['code_col']} = '{cfg['code']}'
              AND date BETWEEN :start_date AND :end_date
        )""")

    bench_cte_sql = ",\n".join(bench_ctes)

    # Build return lag expressions
    ret_cols = []
    for alias, days in _PERIODS:
        ret_cols.append(f"""
            (pu.px / NULLIF(LAG(pu.px, {days}) OVER (PARTITION BY pu.instrument_id ORDER BY pu.date), 0) - 1.0)::double precision AS ret_{alias}""")

    ret_col_sql = ",\n".join(ret_cols)

    # Build RS rank expressions
    rs_rank_cols = []
    for alias, _ in _PERIODS:
        for bench_alias in _BENCHMARKS:
            rs_rank_cols.append(f"""
            (PERCENT_RANK() OVER (PARTITION BY pu.date ORDER BY (pu.px / NULLIF({bench_alias}_bench.bench_px, 0) - 1.0) DESC NULLS LAST) * 100.0)::double precision AS rs_{bench_alias}_{alias}_rank""")

    rs_rank_col_sql = ",\n".join(rs_rank_cols)

    # Momentum omitted for MVP — nested window functions are invalid in PG.
    # Can be added in a follow-up pass if needed.
    rs_mom_col_sql = "NULL::double precision AS _dummy_momentum  -- placeholder"

    # Main compute SQL
    sql = f"""
    WITH price_union_raw AS (
        SELECT i.instrument_id, o.date, COALESCE(o.close_adj, o.close)::numeric AS px
        FROM de_equity_ohlcv o
        JOIN unified_instruments i ON i.instrument_id = o.instrument_id::text
        WHERE o.date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT e.ticker, e.date, e.close::numeric
        FROM de_etf_ohlcv e
        JOIN unified_instruments ui ON ui.instrument_id = e.ticker
        WHERE e.date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT n.mstar_id, n.nav_date, COALESCE(n.nav_adj, n.nav)::numeric
        FROM de_mf_nav_daily n
        JOIN unified_instruments ui ON ui.instrument_id = n.mstar_id
        WHERE n.nav_date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT g.ticker, g.date, g.close::numeric
        FROM de_global_prices g
        JOIN unified_instruments ui ON ui.instrument_id = g.ticker
        WHERE g.date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT ip.index_code, ip.date, ip.close::numeric
        FROM de_index_prices ip
        JOIN unified_instruments ui ON ui.instrument_id = ip.index_code
        WHERE ip.date BETWEEN :start_date AND :end_date
    ),
    price_union AS (
        SELECT DISTINCT ON (instrument_id, date) instrument_id, date, px
        FROM price_union_raw
        ORDER BY instrument_id, date
    ),
    tech_union AS (
        SELECT instrument_id::text AS instrument_id, date,
            ema_20, ema_50, ema_200,
            rsi_14, macd_line AS macd, macd_signal,
            volatility_20d, max_drawdown_1y
        FROM de_equity_technical_daily
        WHERE date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT ticker AS instrument_id, date,
            ema_20, ema_50, ema_200,
            NULL, NULL, NULL,
            NULL, NULL
        FROM de_etf_technical_daily
        WHERE date BETWEEN :start_date AND :end_date
        UNION ALL
        SELECT mstar_id AS instrument_id, nav_date AS date,
            ema_20, ema_50, ema_200,
            NULL, NULL, NULL,
            NULL, NULL
        FROM de_mf_technical_daily
        WHERE nav_date BETWEEN :start_date AND :end_date
    ),
    {bench_cte_sql},
    computed AS (
        SELECT
            pu.instrument_id,
            pu.date,
            pu.px,
            {ret_col_sql},
            -- Trend flags from technicals
            t.ema_20::double precision,
            t.ema_50::double precision,
            t.ema_200::double precision,
            (pu.px > t.ema_20)::boolean AS above_ema_20,
            (pu.px > t.ema_50)::boolean AS above_ema_50,
            (t.ema_50 > t.ema_200)::boolean AS golden_cross,
            t.rsi_14::double precision,
            t.macd::double precision,
            t.macd_signal::double precision,
            t.volatility_20d::double precision AS vol_21d,
            t.max_drawdown_1y::double precision AS max_dd_252d,
            -- RS vs benchmarks
            {rs_rank_col_sql},
            {rs_mom_col_sql}
        FROM price_union pu
        LEFT JOIN tech_union t
            ON t.instrument_id = pu.instrument_id AND t.date = pu.date
        LEFT JOIN nifty_bench     ON nifty_bench.date     = pu.date
        LEFT JOIN nifty500_bench  ON nifty500_bench.date  = pu.date
        LEFT JOIN sp500_bench     ON sp500_bench.date     = pu.date
        LEFT JOIN msci_bench      ON msci_bench.date      = pu.date
        LEFT JOIN gold_bench      ON gold_bench.date      = pu.date
    )
    INSERT INTO unified_metrics (
        tenant_id, instrument_id, date,
        ret_1d, ret_1w, ret_1m, ret_3m, ret_6m, ret_12m, ret_24m, ret_36m,
        ema_20, ema_50, ema_200, above_ema_20, above_ema_50, golden_cross,
        rsi_14, macd, macd_signal,
        vol_21d, max_dd_252d,
        rs_nifty_1d_rank, rs_nifty_1w_rank, rs_nifty_1m_rank, rs_nifty_3m_rank,
        rs_nifty_6m_rank, rs_nifty_12m_rank, rs_nifty_24m_rank, rs_nifty_36m_rank,
        rs_nifty500_3m_rank, rs_nifty500_12m_rank,
        rs_sp500_3m_rank, rs_sp500_12m_rank,
        rs_msci_3m_rank, rs_msci_12m_rank,
        rs_gold_3m_rank, rs_gold_12m_rank,
        state, action, action_confidence, frag_score, frag_level,
        created_at, updated_at
    )
    SELECT
        :tenant_id,
        c.instrument_id,
        c.date,
        c.ret_1d, c.ret_1w, c.ret_1m, c.ret_3m, c.ret_6m, c.ret_12m, c.ret_24m, c.ret_36m,
        c.ema_20, c.ema_50, c.ema_200, c.above_ema_20, c.above_ema_50, c.golden_cross,
        c.rsi_14, c.macd, c.macd_signal,
        c.vol_21d, c.max_dd_252d,
        c.rs_nifty_1d_rank, c.rs_nifty_1w_rank, c.rs_nifty_1m_rank, c.rs_nifty_3m_rank,
        c.rs_nifty_6m_rank, c.rs_nifty_12m_rank, c.rs_nifty_24m_rank, c.rs_nifty_36m_rank,
        c.rs_nifty500_3m_rank, c.rs_nifty500_12m_rank,
        c.rs_sp500_3m_rank, c.rs_sp500_12m_rank,
        c.rs_msci_3m_rank, c.rs_msci_12m_rank,
        c.rs_gold_3m_rank, c.rs_gold_12m_rank,
        CASE
            WHEN c.rs_nifty_3m_rank >= 80 AND c.rs_nifty_12m_rank >= 70 AND c.above_ema_50 = true THEN 'LEADER'
            WHEN c.rs_nifty_3m_rank >= 60 AND c.rs_nifty_12m_rank >= 50 AND c.above_ema_50 = true THEN 'EMERGING'
            WHEN c.rs_nifty_3m_rank < 40 AND c.rs_nifty_12m_rank < 40 AND c.above_ema_50 = false THEN 'LAGGING'
            WHEN c.rs_nifty_3m_rank < 30 AND c.above_ema_50 = false THEN 'BROKEN'
            WHEN c.rs_nifty_3m_rank >= 60 AND (c.rs_nifty_12m_rank < 50 OR c.above_ema_50 = false) THEN 'WEAKENING'
            WHEN c.rs_nifty_3m_rank >= 40 AND c.rs_nifty_3m_rank < 80 AND c.above_ema_50 = true THEN 'HOLDING'
            ELSE 'BASE'
        END::text,
        CASE
            WHEN c.rs_nifty_3m_rank >= 80 AND c.above_ema_50 = true AND c.golden_cross = true THEN 'STRONG_ACCUMULATE'
            WHEN c.rs_nifty_3m_rank >= 60 AND c.above_ema_50 = true THEN 'ACCUMULATE'
            WHEN c.rs_nifty_3m_rank < 30 AND c.above_ema_50 = false THEN 'EXIT'
            WHEN c.rs_nifty_3m_rank < 40 AND c.above_ema_50 = false THEN 'REDUCE'
            ELSE 'HOLD'
        END::text,
        LEAST(1.0, GREATEST(0.0,
            (COALESCE(c.rs_nifty_3m_rank, 50) / 100.0) * 0.3 +
            (COALESCE(c.rs_nifty_12m_rank, 50) / 100.0) * 0.3 +
            (CASE WHEN c.above_ema_50 THEN 1.0 ELSE 0.0 END) * 0.2 +
            (CASE WHEN c.golden_cross THEN 1.0 ELSE 0.0 END) * 0.2
        ))::double precision,
        LEAST(1.0, GREATEST(0.0,
            (1.0 - COALESCE(c.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
            (CASE WHEN c.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
            COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.3
        ))::double precision,
        CASE
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN c.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.7 THEN 'CRITICAL'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN c.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.4 THEN 'HIGH'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(c.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN c.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(c.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END::text,
        NOW(),
        NOW()
    FROM computed c
    WHERE c.date = :target_date
      AND c.px IS NOT NULL
    ON CONFLICT (tenant_id, instrument_id, date) DO UPDATE SET
        ret_1d           = EXCLUDED.ret_1d,
        ret_1w           = EXCLUDED.ret_1w,
        ret_1m           = EXCLUDED.ret_1m,
        ret_3m           = EXCLUDED.ret_3m,
        ret_6m           = EXCLUDED.ret_6m,
        ret_12m          = EXCLUDED.ret_12m,
        ret_24m          = EXCLUDED.ret_24m,
        ret_36m          = EXCLUDED.ret_36m,
        ema_20           = EXCLUDED.ema_20,
        ema_50           = EXCLUDED.ema_50,
        ema_200          = EXCLUDED.ema_200,
        above_ema_20     = EXCLUDED.above_ema_20,
        above_ema_50     = EXCLUDED.above_ema_50,
        golden_cross     = EXCLUDED.golden_cross,
        rsi_14           = EXCLUDED.rsi_14,
        macd             = EXCLUDED.macd,
        macd_signal      = EXCLUDED.macd_signal,
        vol_21d          = EXCLUDED.vol_21d,
        max_dd_252d      = EXCLUDED.max_dd_252d,
        rs_nifty_1d_rank = EXCLUDED.rs_nifty_1d_rank,
        rs_nifty_1w_rank = EXCLUDED.rs_nifty_1w_rank,
        rs_nifty_1m_rank = EXCLUDED.rs_nifty_1m_rank,
        rs_nifty_3m_rank = EXCLUDED.rs_nifty_3m_rank,
        rs_nifty_6m_rank = EXCLUDED.rs_nifty_6m_rank,
        rs_nifty_12m_rank = EXCLUDED.rs_nifty_12m_rank,
        rs_nifty_24m_rank = EXCLUDED.rs_nifty_24m_rank,
        rs_nifty_36m_rank = EXCLUDED.rs_nifty_36m_rank,
        rs_nifty500_3m_rank = EXCLUDED.rs_nifty500_3m_rank,
        rs_nifty500_12m_rank = EXCLUDED.rs_nifty500_12m_rank,
        rs_sp500_3m_rank = EXCLUDED.rs_sp500_3m_rank,
        rs_sp500_12m_rank = EXCLUDED.rs_sp500_12m_rank,
        rs_msci_3m_rank = EXCLUDED.rs_msci_3m_rank,
        rs_msci_12m_rank = EXCLUDED.rs_msci_12m_rank,
        rs_gold_3m_rank = EXCLUDED.rs_gold_3m_rank,
        rs_gold_12m_rank = EXCLUDED.rs_gold_12m_rank,
        state            = EXCLUDED.state,
        action           = EXCLUDED.action,
        action_confidence = EXCLUDED.action_confidence,
        frag_score       = EXCLUDED.frag_score,
        frag_level       = EXCLUDED.frag_level,
        updated_at       = NOW()
    """

    # Raise local statement timeout for heavy window-function query
    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    result = await db.execute(
        text(sql),
        {
            "tenant_id": TENANT_ID,
            "start_date": start_date,
            "end_date": target_date,
            "target_date": target_date,
        },
    )
    await db.commit()

    # Count rows for this date
    cnt_res = await db.execute(
        text("SELECT COUNT(*) FROM unified_metrics WHERE tenant_id = :tenant_id AND date = :target_date"),
        {"tenant_id": TENANT_ID, "target_date": target_date},
    )
    cnt = cnt_res.scalar_one()
    log.info("compute_metrics_done", date=target_date.isoformat(), rows=cnt)
    return cnt


# ---------------------------------------------------------------------------
# 4. Market Regime
# ---------------------------------------------------------------------------

async def compute_market_regime(db: AsyncSession, target_date: date) -> int:
    log.info("compute_market_regime", date=target_date.isoformat())

    sql = """
    WITH params AS (SELECT CAST(:target_date AS date) AS d, CAST(:tenant_id AS varchar) AS t),
    daily AS (
        SELECT
            COUNT(*) AS total,
            AVG(CASE WHEN m.above_ema_20 = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_above_ema_20,
            AVG(CASE WHEN m.above_ema_50 = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_above_ema_50,
            AVG(CASE WHEN m.golden_cross = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_golden_cross,
            AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0 AS participation,
            STDDEV_SAMP(COALESCE(m.rs_nifty_3m_rank, 50)) AS rs_dispersion,
            AVG(CASE WHEN m.action IN ('STRONG_ACCUMULATE','ACCUMULATE') THEN 1.0 ELSE 0.0 END) * 100.0 AS accumulate_pct
        FROM unified_metrics m
        JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        CROSS JOIN params p
        WHERE m.tenant_id = p.t
          AND m.date = p.d
          AND i.instrument_type IN ('EQUITY', 'ETF')
    )
    INSERT INTO unified_market_regime (
        date, tenant_id,
        pct_above_ema_20, pct_above_ema_50, pct_above_ema_200, pct_golden_cross,
        participation, rs_dispersion, health_score, health_zone, regime, direction
    )
    SELECT
        p.d,
        p.t,
        d.pct_above_ema_20::double precision,
        d.pct_above_ema_50::double precision,
        NULL::double precision,
        d.pct_golden_cross::double precision,
        d.participation::double precision,
        d.rs_dispersion::double precision,
        (
            (COALESCE(d.pct_above_ema_50, 50) / 100.0) * 0.3 +
            (COALESCE(d.pct_golden_cross, 50) / 100.0) * 0.3 +
            (COALESCE(d.participation, 10) / 100.0) * 0.2 +
            (COALESCE(d.accumulate_pct, 50) / 100.0) * 0.2
        ) * 100.0::double precision AS health_score,
        CASE
            WHEN d.participation >= 20 AND d.pct_above_ema_50 >= 60 THEN 'BULLISH'
            WHEN d.participation >= 10 AND d.pct_above_ema_50 >= 45 THEN 'HEALTHY'
            WHEN d.participation >= 5  AND d.pct_above_ema_50 >= 30 THEN 'NEUTRAL'
            WHEN d.pct_above_ema_50 >= 20 THEN 'WEAK'
            ELSE 'FEAR'
        END::text AS health_zone,
        CASE
            WHEN d.participation >= 20 AND d.pct_above_ema_50 >= 60 AND d.accumulate_pct >= 60 THEN 'BULLISH_FULL_RISK'
            WHEN d.participation >= 10 AND d.pct_above_ema_50 >= 45 THEN 'CAUTION_SELECTIVE'
            WHEN d.pct_above_ema_50 >= 30 THEN 'CAUTION_DEFENSIVE'
            ELSE 'BEARISH_ACCUMULATE'
        END::text AS regime,
        CASE
            WHEN d.participation >= 20 AND d.pct_above_ema_50 >= 60 THEN 'ACCELERATING'
            WHEN d.participation >= 10 AND d.pct_above_ema_50 >= 45 THEN 'IMPROVING'
            WHEN d.pct_above_ema_50 >= 30 THEN 'MIXED'
            ELSE 'DETERIORATING'
        END::text AS direction
    FROM daily d, params p
    ON CONFLICT (date, tenant_id) DO UPDATE SET
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
    await db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    await db.commit()
    return 1


# ---------------------------------------------------------------------------
# 5. Sector Breadth
# ---------------------------------------------------------------------------

async def compute_sector_breadth(db: AsyncSession, target_date: date) -> int:
    log.info("compute_sector_breadth", date=target_date.isoformat())

    sql = """
    WITH params AS (SELECT CAST(:target_date AS date) AS d, CAST(:tenant_id AS varchar) AS t)
    INSERT INTO unified_sector_breadth (
        date, tenant_id, sector,
        member_count, median_rs_3m, median_rs_12m,
        pct_above_ema_50, participation, frag_score, action, action_confidence
    )
    SELECT
        p.d,
        p.t,
        i.sector,
        COUNT(*)::int,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_nifty_3m_rank ASC NULLS LAST)::double precision,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_nifty_12m_rank ASC NULLS LAST)::double precision,
        (AVG(CASE WHEN m.above_ema_50 = true THEN 1.0 ELSE 0.0 END) * 100.0)::double precision,
        (AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0)::double precision,
        AVG(m.frag_score)::double precision,
        MODE() WITHIN GROUP (ORDER BY m.action),
        AVG(m.action_confidence)::double precision
    FROM unified_metrics m
    JOIN unified_instruments i ON i.instrument_id = m.instrument_id
    CROSS JOIN params p
    WHERE m.tenant_id = p.t
      AND m.date = p.d
      AND i.sector IS NOT NULL
      AND i.instrument_type = 'EQUITY'
    GROUP BY p.d, p.t, i.sector
    ON CONFLICT (date, tenant_id, sector) DO UPDATE SET
        member_count     = EXCLUDED.member_count,
        median_rs_3m     = EXCLUDED.median_rs_3m,
        median_rs_12m    = EXCLUDED.median_rs_12m,
        pct_above_ema_50 = EXCLUDED.pct_above_ema_50,
        participation    = EXCLUDED.participation,
        frag_score       = EXCLUDED.frag_score,
        action           = EXCLUDED.action,
        action_confidence = EXCLUDED.action_confidence
    """
    result = await db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    await db.commit()

    cnt_res = await db.execute(
        text("SELECT COUNT(*) FROM unified_sector_breadth WHERE tenant_id = :tenant_id AND date = :target_date"),
        {"tenant_id": TENANT_ID, "target_date": target_date},
    )
    cnt = cnt_res.scalar_one()
    log.info("compute_sector_breadth_done", date=target_date.isoformat(), rows=cnt)
    return cnt


# ---------------------------------------------------------------------------
# 6. Orchestrator
# ---------------------------------------------------------------------------

async def run_pipeline(
    start_date: date | None = None,
    end_date: date | None = None,
    backfill: bool = False,
) -> dict[str, Any]:
    """Run the full compute pipeline.

    Args:
        start_date: First date to compute (defaults to latest date with prices).
        end_date: Last date to compute (defaults to start_date).
        backfill: If True, compute all dates from start_date to end_date.
    """
    log.info("pipeline_start", backfill=backfill)
    results: dict[str, Any] = {"phases": []}

    async with async_session_factory() as db:
        # Phase 1: Instruments
        try:
            inst_cnt = await sync_instruments(db)
            await _log_phase(db, "instruments", "SUCCESS", rows_processed=inst_cnt)
            results["phases"].append({"phase": "instruments", "status": "SUCCESS", "rows": inst_cnt})
        except Exception as exc:
            log.error("instruments_failed", error=str(exc))
            await _log_phase(db, "instruments", "FAILED", error_message=str(exc))
            results["phases"].append({"phase": "instruments", "status": "FAILED", "error": str(exc)})
            return results

        # Determine target dates
        if end_date is None:
            end_date = _today()
        if start_date is None:
            start_date = end_date

        # If not backfill, just compute the single end_date
        dates_to_compute = []
        if backfill:
            d = start_date
            while d <= end_date:
                dates_to_compute.append(d)
                d += timedelta(days=1)
        else:
            dates_to_compute = [end_date]

        # Phase 2: Metrics
        total_metrics = 0
        for target_date in dates_to_compute:
            try:
                # Skip weekends (simple heuristic)
                if target_date.weekday() >= 5:
                    continue
                cnt = await compute_metrics_for_date(db, target_date)
                total_metrics += cnt
            except Exception as exc:
                log.warning("metrics_date_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        await _log_phase(db, "metrics", "SUCCESS" if total_metrics > 0 else "PARTIAL", rows_processed=total_metrics)
        results["phases"].append({"phase": "metrics", "status": "SUCCESS", "rows": total_metrics})

        # Phase 3: Market Regime
        total_regime = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                await compute_market_regime(db, target_date)
                total_regime += 1
            except Exception as exc:
                log.warning("regime_date_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        await _log_phase(db, "regime", "SUCCESS" if total_regime > 0 else "PARTIAL", rows_processed=total_regime)
        results["phases"].append({"phase": "regime", "status": "SUCCESS", "rows": total_regime})

        # Phase 4: Sector Breadth
        total_sector = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                cnt = await compute_sector_breadth(db, target_date)
                total_sector += cnt
            except Exception as exc:
                log.warning("sector_date_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        await _log_phase(db, "sector_breadth", "SUCCESS" if total_sector > 0 else "PARTIAL", rows_processed=total_sector)
        results["phases"].append({"phase": "sector_breadth", "status": "SUCCESS", "rows": total_sector})

    log.info("pipeline_complete", results=results)
    return results


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ATLAS Kim — Unified Compute Pipeline")
    parser.add_argument("--date", type=date.fromisoformat, help="Target date (ISO format)")
    parser.add_argument("--backfill", action="store_true", help="Backfill from start to end date")
    parser.add_argument("--start-date", type=date.fromisoformat, help="Start date for backfill")
    parser.add_argument("--end-date", type=date.fromisoformat, help="End date for backfill")
    args = parser.parse_args()

    end_date = args.date or args.end_date or _today()
    start_date = args.start_date or (args.date if not args.backfill else end_date)

    result = asyncio.run(run_pipeline(
        start_date=start_date,
        end_date=end_date,
        backfill=args.backfill,
    ))
    print(result)
