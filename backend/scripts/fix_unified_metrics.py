#!/usr/bin/env python3
"""
Fix Unified Metrics Pipeline — Backfill ALL instrument types.

This script handles the key gap: different instrument types have data on different
dates (MF NAV lags by 1-2 days). It uses source-specific returns and technicals
to ensure every instrument has ≥1 complete row.

Usage:
    PYTHONPATH=/home/ubuntu/atlas_kim python backend/scripts/fix_unified_metrics.py [--full-backfill]
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory
from backend.services.unified_compute import (
    sync_instruments,
    compute_metrics_for_date,
    backfill_technicals_for_date,
    TENANT_ID,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_trading_date() -> date:
    d = datetime.utcnow().date()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


# ---------------------------------------------------------------------------
# MF-specific backfill (uses pre-computed returns from de_mf_nav_daily)
# ---------------------------------------------------------------------------

async def backfill_mf_metrics(db: AsyncSession) -> int:
    """Backfill MF metrics using de_mf_nav_daily returns + de_mf_technical_daily."""
    log.info("backfill_mf_start")

    sql = """
    WITH target_funds AS (
        SELECT mm.mstar_id
        FROM de_mf_master mm
        WHERE mm.is_etf = false AND mm.is_index_fund = false
          AND mm.broad_category = 'Equity'
          AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
          AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
          AND EXISTS (SELECT 1 FROM de_mf_nav_daily nav WHERE nav.mstar_id = mm.mstar_id)
    ),
    latest_nav_date AS (
        SELECT mstar_id, MAX(nav_date) AS d
        FROM de_mf_nav_daily
        WHERE mstar_id IN (SELECT mstar_id FROM target_funds)
        GROUP BY mstar_id
    ),
    latest_nav AS (
        SELECT nav.mstar_id, nav.nav_date AS date,
               nav.return_1d, nav.return_1w, nav.return_1m,
               nav.return_3m, nav.return_6m, nav.return_1y,
               nav.return_3y, nav.return_5y,
               nav.nav_52wk_high, nav.nav_52wk_low,
               nav.nav_adj, nav.nav
        FROM de_mf_nav_daily nav
        JOIN latest_nav_date lnd ON lnd.mstar_id = nav.mstar_id AND lnd.d = nav.nav_date
    ),
    latest_tech_date AS (
        SELECT mstar_id, MAX(nav_date) AS d
        FROM de_mf_technical_daily
        WHERE mstar_id IN (SELECT mstar_id FROM target_funds)
        GROUP BY mstar_id
    ),
    latest_tech AS (
        SELECT t.mstar_id,
               t.ema_20, t.ema_50, t.ema_200,
               t.rsi_14, t.macd_line AS macd, t.macd_signal,
               t.volatility_20d, t.max_drawdown_1y,
               t.above_50dma, t.above_200dma, t.above_20ema
        FROM de_mf_technical_daily t
        JOIN latest_tech_date ltd ON ltd.mstar_id = t.mstar_id AND ltd.d = t.nav_date
    ),
    ranked AS (
        SELECT
            ln.mstar_id,
            ln.date,
            ln.return_1d, ln.return_1w, ln.return_1m,
            ln.return_3m, ln.return_6m, ln.return_1y,
            ln.return_3y, ln.return_5y,
            ln.nav_52wk_high, ln.nav_52wk_low,
            COALESCE(ln.nav_adj, ln.nav)::numeric AS px,
            lt.ema_20, lt.ema_50, lt.ema_200,
            lt.rsi_14, lt.macd, lt.macd_signal,
            lt.volatility_20d, lt.max_drawdown_1y,
            lt.above_20ema, lt.above_50dma, lt.above_200dma,
            (PERCENT_RANK() OVER (ORDER BY ln.return_3m DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_3m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_6m DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_6m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1y DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_12m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1m DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_1m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1w DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_1w_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1d DESC NULLS LAST) * 100.0)::double precision AS rs_nifty_1d_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_3m DESC NULLS LAST) * 100.0)::double precision AS rs_nifty500_3m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1y DESC NULLS LAST) * 100.0)::double precision AS rs_nifty500_12m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_3m DESC NULLS LAST) * 100.0)::double precision AS rs_sp500_3m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1y DESC NULLS LAST) * 100.0)::double precision AS rs_sp500_12m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_3m DESC NULLS LAST) * 100.0)::double precision AS rs_msci_3m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1y DESC NULLS LAST) * 100.0)::double precision AS rs_msci_12m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_3m DESC NULLS LAST) * 100.0)::double precision AS rs_gold_3m_rank,
            (PERCENT_RANK() OVER (ORDER BY ln.return_1y DESC NULLS LAST) * 100.0)::double precision AS rs_gold_12m_rank
        FROM latest_nav ln
        LEFT JOIN latest_tech lt ON lt.mstar_id = ln.mstar_id
    )
    INSERT INTO unified_metrics (
        tenant_id, instrument_id, date,
        ret_1d, ret_1w, ret_1m, ret_3m, ret_6m, ret_12m, ret_24m, ret_36m,
        ema_20, ema_50, ema_200,
        above_ema_20, above_ema_50, golden_cross,
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
        r.mstar_id,
        r.date,
        r.return_1d::double precision, r.return_1w::double precision,
        r.return_1m::double precision, r.return_3m::double precision,
        r.return_6m::double precision, r.return_1y::double precision,
        r.return_3y::double precision, r.return_5y::double precision,
        r.ema_20::double precision, r.ema_50::double precision, r.ema_200::double precision,
        r.above_20ema::boolean, r.above_50dma::boolean,
        (r.above_50dma AND r.above_200dma)::boolean,
        r.rsi_14::double precision, r.macd::double precision, r.macd_signal::double precision,
        r.volatility_20d::double precision, r.max_drawdown_1y::double precision,
        r.rs_nifty_1d_rank, r.rs_nifty_1w_rank, r.rs_nifty_1m_rank, r.rs_nifty_3m_rank,
        r.rs_nifty_6m_rank, r.rs_nifty_12m_rank, NULL, NULL,
        r.rs_nifty500_3m_rank, r.rs_nifty500_12m_rank,
        r.rs_sp500_3m_rank, r.rs_sp500_12m_rank,
        r.rs_msci_3m_rank, r.rs_msci_12m_rank,
        r.rs_gold_3m_rank, r.rs_gold_12m_rank,
        CASE
            WHEN r.rs_nifty_3m_rank >= 80 AND r.rs_nifty_12m_rank >= 70 AND r.above_50dma = true THEN 'LEADER'
            WHEN r.rs_nifty_3m_rank >= 60 AND r.rs_nifty_12m_rank >= 50 AND r.above_50dma = true THEN 'EMERGING'
            WHEN r.rs_nifty_3m_rank < 40 AND r.rs_nifty_12m_rank < 40 AND r.above_50dma = false THEN 'LAGGING'
            WHEN r.rs_nifty_3m_rank < 30 AND r.above_50dma = false THEN 'BROKEN'
            WHEN r.rs_nifty_3m_rank >= 60 AND (r.rs_nifty_12m_rank < 50 OR r.above_50dma = false) THEN 'WEAKENING'
            WHEN r.rs_nifty_3m_rank >= 40 AND r.rs_nifty_3m_rank < 80 AND r.above_50dma = true THEN 'HOLDING'
            ELSE 'BASE'
        END::text,
        CASE
            WHEN r.rs_nifty_3m_rank >= 80 AND r.above_50dma = true AND (r.above_50dma AND r.above_200dma) THEN 'STRONG_ACCUMULATE'
            WHEN r.rs_nifty_3m_rank >= 60 AND r.above_50dma = true THEN 'ACCUMULATE'
            WHEN r.rs_nifty_3m_rank < 30 AND r.above_50dma = false THEN 'EXIT'
            WHEN r.rs_nifty_3m_rank < 40 AND r.above_50dma = false THEN 'REDUCE'
            ELSE 'HOLD'
        END::text,
        LEAST(1.0, GREATEST(0.0,
            (COALESCE(r.rs_nifty_3m_rank, 50) / 100.0) * 0.3 +
            (COALESCE(r.rs_nifty_12m_rank, 50) / 100.0) * 0.3 +
            (CASE WHEN r.above_50dma THEN 1.0 ELSE 0.0 END) * 0.2 +
            (CASE WHEN r.above_50dma AND r.above_200dma THEN 1.0 ELSE 0.0 END) * 0.2
        ))::double precision,
        LEAST(1.0, GREATEST(0.0,
            (1.0 - COALESCE(r.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
            (CASE WHEN r.above_50dma THEN 0.0 ELSE 1.0 END) * 0.3 +
            COALESCE(ABS(r.return_3m), 0.0) * 0.01 * 0.3
        ))::double precision,
        CASE
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(r.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN r.above_50dma THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(r.return_3m), 0.0) * 0.01 * 0.3
            )) >= 0.7 THEN 'CRITICAL'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(r.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN r.above_50dma THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(r.return_3m), 0.0) * 0.01 * 0.3
            )) >= 0.4 THEN 'HIGH'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(r.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN r.above_50dma THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(r.return_3m), 0.0) * 0.01 * 0.3
            )) >= 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END::text,
        NOW(), NOW()
    FROM ranked r
    ON CONFLICT (tenant_id, instrument_id, date) DO UPDATE SET
        ret_1d = EXCLUDED.ret_1d, ret_1w = EXCLUDED.ret_1w,
        ret_1m = EXCLUDED.ret_1m, ret_3m = EXCLUDED.ret_3m,
        ret_6m = EXCLUDED.ret_6m, ret_12m = EXCLUDED.ret_12m,
        ret_24m = EXCLUDED.ret_24m, ret_36m = EXCLUDED.ret_36m,
        ema_20 = EXCLUDED.ema_20, ema_50 = EXCLUDED.ema_50, ema_200 = EXCLUDED.ema_200,
        above_ema_20 = EXCLUDED.above_ema_20, above_ema_50 = EXCLUDED.above_ema_50, golden_cross = EXCLUDED.golden_cross,
        rsi_14 = EXCLUDED.rsi_14, macd = EXCLUDED.macd, macd_signal = EXCLUDED.macd_signal,
        vol_21d = EXCLUDED.vol_21d, max_dd_252d = EXCLUDED.max_dd_252d,
        rs_nifty_1d_rank = EXCLUDED.rs_nifty_1d_rank, rs_nifty_1w_rank = EXCLUDED.rs_nifty_1w_rank,
        rs_nifty_1m_rank = EXCLUDED.rs_nifty_1m_rank, rs_nifty_3m_rank = EXCLUDED.rs_nifty_3m_rank,
        rs_nifty_6m_rank = EXCLUDED.rs_nifty_6m_rank, rs_nifty_12m_rank = EXCLUDED.rs_nifty_12m_rank,
        rs_nifty500_3m_rank = EXCLUDED.rs_nifty500_3m_rank, rs_nifty500_12m_rank = EXCLUDED.rs_nifty500_12m_rank,
        rs_sp500_3m_rank = EXCLUDED.rs_sp500_3m_rank, rs_sp500_12m_rank = EXCLUDED.rs_sp500_12m_rank,
        rs_msci_3m_rank = EXCLUDED.rs_msci_3m_rank, rs_msci_12m_rank = EXCLUDED.rs_msci_12m_rank,
        rs_gold_3m_rank = EXCLUDED.rs_gold_3m_rank, rs_gold_12m_rank = EXCLUDED.rs_gold_12m_rank,
        state = EXCLUDED.state, action = EXCLUDED.action,
        action_confidence = EXCLUDED.action_confidence,
        frag_score = EXCLUDED.frag_score, frag_level = EXCLUDED.frag_level,
        updated_at = NOW()
    """
    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    result = await db.execute(text(sql), {"tenant_id": TENANT_ID})
    await db.commit()

    # Count
    cnt_res = await db.execute(
        text("""
            SELECT COUNT(*) FROM unified_metrics m
            JOIN de_mf_master mm ON mm.mstar_id = m.instrument_id
            WHERE mm.is_etf = false AND mm.is_index_fund = false
              AND mm.broad_category = 'Equity'
              AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
              AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
        """),
    )
    cnt = cnt_res.scalar_one()
    log.info("backfill_mf_done", rows=cnt)
    return cnt


# ---------------------------------------------------------------------------
# Per-type latest-date backfill for ETFs, Indices, Global
# ---------------------------------------------------------------------------

async def backfill_latest_for_type(db: AsyncSession, instrument_type: str) -> int:
    """Ensure every instrument of a given type has a metrics row on its latest price date."""
    log.info("backfill_latest_for_type_start", type=instrument_type)

    if instrument_type == "ETF":
        price_sql = """
            SELECT ticker AS instrument_id, MAX(date) AS d
            FROM de_etf_ohlcv
            WHERE ticker IN (SELECT instrument_id FROM unified_instruments WHERE instrument_type = 'ETF')
            GROUP BY ticker
        """
    elif instrument_type == "INDEX":
        price_sql = """
            SELECT index_code AS instrument_id, MAX(date) AS d
            FROM de_index_prices
            WHERE index_code IN (SELECT instrument_id FROM unified_instruments WHERE instrument_type = 'INDEX')
            GROUP BY index_code
        """
    elif instrument_type == "INDEX_GLOBAL":
        price_sql = """
            SELECT ticker AS instrument_id, MAX(date) AS d
            FROM de_global_prices
            WHERE ticker IN (SELECT instrument_id FROM unified_instruments WHERE instrument_type = 'INDEX_GLOBAL')
            GROUP BY ticker
        """
    else:
        return 0

    r = await db.execute(text(price_sql))
    latest_dates = {row[0]: row[1] for row in r.fetchall()}
    log.info("latest_dates_found", type=instrument_type, count=len(latest_dates))

    total = 0
    for inst_id, d in latest_dates.items():
        try:
            cnt = await compute_metrics_for_date(db, d)
            total += cnt
        except Exception as exc:
            log.warning("compute_failed", instrument=inst_id, date=d.isoformat(), error=str(exc))
            await db.rollback()

    log.info("backfill_latest_for_type_done", type=instrument_type, total=total)
    return total


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

async def run_validation(db: AsyncSession) -> dict[str, Any]:
    """Run validation queries and return counts."""
    log.info("validation_start")
    results: dict[str, Any] = {}

    r = await db.execute(text("""
        SELECT i.instrument_type,
               COUNT(DISTINCT i.instrument_id) AS total,
               COUNT(DISTINCT m.instrument_id) AS with_metrics
        FROM unified_instruments i
        LEFT JOIN unified_metrics m ON i.instrument_id = m.instrument_id
        WHERE i.tenant_id = :tenant_id
        GROUP BY i.instrument_type
    """), {"tenant_id": TENANT_ID})
    results["coverage_by_type"] = {
        row[0]: {"total": row[1], "with_metrics": row[2]}
        for row in r.fetchall()
    }

    r = await db.execute(text("SELECT MAX(date) FROM unified_metrics"))
    latest_date = r.scalar()
    results["latest_date"] = str(latest_date) if latest_date else None

    if latest_date:
        r = await db.execute(text("""
            SELECT COUNT(*) FROM unified_metrics
            WHERE tenant_id = :tenant_id AND date = :d
        """), {"tenant_id": TENANT_ID, "d": latest_date})
        results["latest_date_rows"] = r.scalar()

        r = await db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE rsi_14 IS NULL) AS null_rsi,
                COUNT(*) FILTER (WHERE macd IS NULL) AS null_macd,
                COUNT(*) FILTER (WHERE ema_20 IS NULL) AS null_ema20,
                COUNT(*) FILTER (WHERE rs_nifty_3m_rank IS NULL) AS null_rs_nifty_3m,
                COUNT(*) AS total
            FROM unified_metrics
            WHERE tenant_id = :tenant_id AND date = :d
        """), {"tenant_id": TENANT_ID, "d": latest_date})
        row = r.fetchone()
        results["nulls_on_latest"] = dict(row._mapping)

        r = await db.execute(text("""
            SELECT instrument_type, COUNT(*) AS cnt
            FROM unified_metrics m
            JOIN unified_instruments i ON i.instrument_id = m.instrument_id
            WHERE m.tenant_id = :tenant_id AND m.date = :d
            GROUP BY instrument_type
        """), {"tenant_id": TENANT_ID, "d": latest_date})
        results["rows_by_type_on_latest"] = dict(r.fetchall())

    r = await db.execute(text("""
        SELECT COUNT(*) FROM de_mf_master mm
        WHERE mm.is_etf = false AND mm.is_index_fund = false
          AND mm.broad_category = 'Equity'
          AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
          AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
          AND EXISTS (SELECT 1 FROM de_mf_nav_daily nav WHERE nav.mstar_id = mm.mstar_id)
    """))
    results["mf_target_total"] = r.scalar()

    r = await db.execute(text("""
        SELECT COUNT(DISTINCT mm.mstar_id)
        FROM de_mf_master mm
        JOIN unified_metrics m ON m.instrument_id = mm.mstar_id
        WHERE mm.is_etf = false AND mm.is_index_fund = false
          AND mm.broad_category = 'Equity'
          AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
          AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
    """))
    results["mf_target_with_metrics"] = r.scalar()

    r = await db.execute(text("SELECT COUNT(*) FROM unified_metrics"))
    results["total_metrics_rows"] = r.scalar()

    log.info("validation_done", results=results)
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(full_backfill: bool = False):
    log.info("fix_unified_metrics_start", full_backfill=full_backfill)

    async with async_session_factory() as db:
        # Phase 1: Sync instruments (adds all 135 indices, all globals)
        try:
            inst_cnt = await sync_instruments(db)
            log.info("sync_instruments_done", count=inst_cnt)
        except Exception as exc:
            log.error("sync_instruments_failed", error=str(exc))
            raise

        # Phase 2: MF backfill (fast, uses pre-computed returns)
        try:
            mf_cnt = await backfill_mf_metrics(db)
            log.info("mf_backfill_done", rows=mf_cnt)
        except Exception as exc:
            log.error("mf_backfill_failed", error=str(exc))
            await db.rollback()

        # Phase 3: Compute metrics for recent dates (equity, ETF, index, global)
        dates_to_compute = []
        if full_backfill:
            r = await db.execute(text("""
                SELECT DISTINCT date FROM (
                    SELECT date FROM de_equity_ohlcv WHERE date >= '2024-01-01'
                    UNION SELECT date FROM de_etf_ohlcv WHERE date >= '2024-01-01'
                    UNION SELECT date FROM de_index_prices WHERE date >= '2024-01-01'
                    UNION SELECT date FROM de_global_prices WHERE date >= '2024-01-01'
                ) t ORDER BY date
            """))
            dates_to_compute = [row[0] for row in r.fetchall()]
        else:
            d = _latest_trading_date()
            dates_to_compute = [d - timedelta(days=i) for i in range(4, -1, -1) if (d - timedelta(days=i)).weekday() < 5]

        log.info("dates_to_compute", count=len(dates_to_compute), first=str(dates_to_compute[0]) if dates_to_compute else None, last=str(dates_to_compute[-1]) if dates_to_compute else None)

        total_metrics = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                cnt = await compute_metrics_for_date(db, target_date)
                total_metrics += cnt
                log.info("compute_metrics_date", date=target_date.isoformat(), rows=cnt)
            except Exception as exc:
                log.warning("compute_metrics_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        # Phase 4: Backfill technicals for computed dates
        total_backfill = 0
        for target_date in dates_to_compute:
            if target_date.weekday() >= 5:
                continue
            try:
                cnt = await backfill_technicals_for_date(db, target_date)
                total_backfill += cnt
                log.info("backfill_tech_date", date=target_date.isoformat(), rows_with_tech=cnt)
            except Exception as exc:
                log.warning("backfill_tech_failed", date=target_date.isoformat(), error=str(exc))
                await db.rollback()

        # Phase 5: Validation
        validation = await run_validation(db)

    # Print report
    print("\n" + "=" * 60)
    print("UNIFIED METRICS FIX — VALIDATION REPORT")
    print("=" * 60)
    print(f"\nLatest metrics date: {validation.get('latest_date')}")
    print(f"Total metrics rows: {validation.get('total_metrics_rows'):,}")
    print(f"Rows on latest date: {validation.get('latest_date_rows'):,}")

    print("\n--- Coverage by Instrument Type ---")
    for typ, vals in validation.get("coverage_by_type", {}).items():
        pct = (vals["with_metrics"] / vals["total"] * 100) if vals["total"] else 0
        status = "✅" if pct >= 95 else "⚠️"
        print(f"  {status} {typ:12s}: {vals['with_metrics']:,} / {vals['total']:,} ({pct:.1f}%)")

    print("\n--- Nulls on Latest Date ---")
    nulls = validation.get("nulls_on_latest", {})
    total = nulls.get("total", 0)
    if total:
        for col in ["null_rsi", "null_macd", "null_ema20", "null_rs_nifty_3m"]:
            cnt = nulls.get(col, 0)
            pct = (cnt / total * 100)
            status = "✅" if pct <= 5 else "⚠️"
            print(f"  {status} {col:20s}: {cnt:,} / {total:,} ({pct:.1f}%)")

    print("\n--- Rows by Type on Latest Date ---")
    for typ, cnt in validation.get("rows_by_type_on_latest", {}).items():
        print(f"  {typ:12s}: {cnt:,}")

    print(f"\n--- MF Target Validation ---")
    print(f"  Target MFs: {validation.get('mf_target_total')}")
    print(f"  With metrics: {validation.get('mf_target_with_metrics')}")

    print("\n" + "=" * 60)
    return validation


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix Unified Metrics Pipeline")
    parser.add_argument("--full-backfill", action="store_true", help="Backfill ALL dates since 2024-01-01 (SLOW)")
    args = parser.parse_args()

    result = asyncio.run(main(full_backfill=args.full_backfill))
