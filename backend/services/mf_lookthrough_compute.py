"""MF / ETF / Index look-through compute.

Computes weighted aggregate metrics for fund holdings and index constituents
and stores them in unified_mf_lookthrough.

Deterministic — no LLMs. Heavy lifting in PostgreSQL.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory

log = structlog.get_logger()
TENANT_ID = "default"


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
        "run_date": date.today(),
        "phase": phase,
        "status": status,
        "rows_processed": rows_processed,
        "error_message": error_message,
        "started_at": now,
        "completed_at": now,
    })
    await db.commit()


# ---------------------------------------------------------------------------
# MF / ETF look-through
# ---------------------------------------------------------------------------

async def compute_mf_lookthrough(db: AsyncSession, target_date: date | None = None) -> int:
    """Compute look-through aggregates for MF/ETF holdings.

    If target_date is None, computes for the latest date with >100 funds.
    """
    if target_date is None:
        r = await db.execute(text("""
            SELECT date, COUNT(DISTINCT mf_id) as funds
            FROM unified_mf_holdings_detail
            WHERE tenant_id = :tenant_id
            GROUP BY date
            HAVING COUNT(DISTINCT mf_id) > 100
            ORDER BY date DESC
            LIMIT 1
        """), {"tenant_id": TENANT_ID})
        row = r.fetchone()
        if row is None:
            log.warning("no_substantial_holdings_data")
            return 0
        target_date = row[0]

    log.info("compute_mf_lookthrough_start", date=target_date.isoformat())

    sql = """
    WITH holdings_deduped AS (
        SELECT DISTINCT ON (h.mf_id, h.child_id)
            h.mf_id,
            h.child_id,
            h.weight_pct,
            h.sector
        FROM unified_mf_holdings_detail h
        JOIN unified_instruments ui ON ui.instrument_id = h.mf_id AND ui.tenant_id = h.tenant_id
        WHERE h.tenant_id = :tenant_id
          AND h.date = :target_date
          AND h.child_id IS NOT NULL
        ORDER BY h.mf_id, h.child_id, h.weight_pct DESC
    ),
    holdings AS (
        SELECT mf_id, child_id, weight_pct / 100.0 AS weight_pct, sector
        FROM holdings_deduped
    ),
    latest_metric_date AS (
        SELECT MAX(date) AS d FROM unified_metrics
        WHERE tenant_id = :tenant_id AND date <= :target_date
    ),
    child_metrics AS (
        SELECT
            m.instrument_id,
            m.rs_nifty_3m_rank,
            m.rs_nifty_12m_rank,
            m.ret_3m,
            m.frag_score,
            m.state,
            m.action
        FROM unified_metrics m
        CROSS JOIN latest_metric_date lmd
        WHERE m.tenant_id = :tenant_id
          AND m.date = lmd.d
    ),
    child_caps AS (
        SELECT instrument_id, cap_category
        FROM unified_instruments
        WHERE tenant_id = :tenant_id
    ),
    weighted AS (
        SELECT
            h.mf_id,
            h.child_id,
            h.weight_pct,
            h.sector,
            cm.rs_nifty_3m_rank,
            cm.rs_nifty_12m_rank,
            cm.ret_3m,
            cm.frag_score,
            cm.state,
            cm.action,
            cc.cap_category
        FROM holdings h
        LEFT JOIN child_metrics cm ON cm.instrument_id = h.child_id
        LEFT JOIN child_caps cc ON cc.instrument_id = h.child_id
    ),
    -- Pre-compute top10 concentration per fund using window function
    weighted_ranked AS (
        SELECT
            *,
            ROW_NUMBER() OVER (PARTITION BY mf_id ORDER BY weight_pct DESC) AS weight_rn
        FROM weighted
    ),
    top10_agg AS (
        SELECT mf_id, SUM(weight_pct) AS top10_concentration
        FROM weighted_ranked
        WHERE weight_rn <= 10
        GROUP BY mf_id
    ),
    sector_agg AS (
        SELECT
            mf_id,
            sector,
            SUM(weight_pct) AS sector_weight
        FROM weighted
        WHERE sector IS NOT NULL
        GROUP BY mf_id, sector
    ),
    sector_ranked AS (
        SELECT
            mf_id,
            sector,
            sector_weight,
            ROW_NUMBER() OVER (PARTITION BY mf_id ORDER BY sector_weight DESC) AS rn
        FROM sector_agg
    ),
    top_sectors AS (
        SELECT
            mf_id,
            JSONB_AGG(
                JSONB_BUILD_OBJECT('sector', sector, 'weight_pct', ROUND(sector_weight::numeric, 2))
                ORDER BY sector_weight DESC
            ) AS dominant_sectors
        FROM sector_ranked
        WHERE rn <= 3
        GROUP BY mf_id
    ),
    top_sector_single AS (
        SELECT DISTINCT ON (mf_id)
            mf_id,
            sector AS top_sector
        FROM sector_ranked
        ORDER BY mf_id, rn
    ),
    sector_herf AS (
        SELECT mf_id, SUM(POWER(sector_weight, 2)) AS sector_herfindahl
        FROM sector_agg
        GROUP BY mf_id
    ),
    fund_agg AS (
        SELECT
            w.mf_id,
            COUNT(DISTINCT w.child_id) AS num_holdings,
            SUM(w.weight_pct * COALESCE(w.rs_nifty_3m_rank, 50)) AS lookthrough_rs_3m,
            SUM(w.weight_pct * COALESCE(w.rs_nifty_12m_rank, 50)) AS lookthrough_rs_12m,
            SUM(CASE WHEN w.state = 'LEADER' THEN w.weight_pct ELSE 0 END) AS pct_holdings_leader,
            SUM(CASE WHEN w.state = 'EMERGING' THEN w.weight_pct ELSE 0 END) AS pct_holdings_emerging,
            SUM(CASE WHEN w.state = 'BROKEN' THEN w.weight_pct ELSE 0 END) AS pct_holdings_broken,
            SUM(w.weight_pct * COALESCE(w.ret_3m, 0)) AS avg_holding_ret_3m,
            SUM(w.weight_pct * COALESCE(w.frag_score, 0.5)) AS avg_holding_frag_score,
            SUM(CASE WHEN w.cap_category = 'LARGE' THEN w.weight_pct ELSE 0 END) AS cap_large_pct,
            SUM(CASE WHEN w.cap_category = 'MID' THEN w.weight_pct ELSE 0 END) AS cap_mid_pct,
            SUM(CASE WHEN w.cap_category = 'SMALL' THEN w.weight_pct ELSE 0 END) AS cap_small_pct
        FROM weighted w
        GROUP BY w.mf_id
    )
    INSERT INTO unified_mf_lookthrough (
        tenant_id, mf_id, date,
        num_holdings,
        lookthrough_rs_3m, lookthrough_rs_12m,
        pct_holdings_leader, pct_holdings_emerging, pct_holdings_broken,
        top_sector, sector_herfindahl, top10_concentration,
        avg_holding_ret_3m, avg_holding_frag_score,
        cap_large_pct, cap_mid_pct, cap_small_pct, cap_tilt, dominant_sectors,
        n_holdings, lt_leader_participation, lt_weighted_rs, staleness, staleness_days,
        created_at, updated_at
    )
    SELECT
        :tenant_id,
        fa.mf_id,
        :target_date,
        fa.num_holdings,
        fa.lookthrough_rs_3m,
        fa.lookthrough_rs_12m,
        fa.pct_holdings_leader,
        fa.pct_holdings_emerging,
        fa.pct_holdings_broken,
        ts.top_sector,
        sh.sector_herfindahl,
        t10.top10_concentration,
        fa.avg_holding_ret_3m,
        fa.avg_holding_frag_score,
        fa.cap_large_pct,
        fa.cap_mid_pct,
        fa.cap_small_pct,
        CASE
            WHEN GREATEST(fa.cap_large_pct, fa.cap_mid_pct, fa.cap_small_pct) = fa.cap_large_pct THEN 'LARGE'
            WHEN GREATEST(fa.cap_large_pct, fa.cap_mid_pct, fa.cap_small_pct) = fa.cap_mid_pct THEN 'MID'
            ELSE 'SMALL'
        END,
        COALESCE(tops.dominant_sectors, '[]'::jsonb),
        fa.num_holdings,
        fa.pct_holdings_leader,
        fa.lookthrough_rs_3m,
        'FRESH',
        0,
        NOW(), NOW()
    FROM fund_agg fa
    LEFT JOIN top_sector_single ts ON ts.mf_id = fa.mf_id
    LEFT JOIN top_sectors tops ON tops.mf_id = fa.mf_id
    LEFT JOIN sector_herf sh ON sh.mf_id = fa.mf_id
    LEFT JOIN top10_agg t10 ON t10.mf_id = fa.mf_id
    ON CONFLICT (tenant_id, mf_id, date) DO UPDATE SET
        num_holdings = EXCLUDED.num_holdings,
        lookthrough_rs_3m = EXCLUDED.lookthrough_rs_3m,
        lookthrough_rs_12m = EXCLUDED.lookthrough_rs_12m,
        pct_holdings_leader = EXCLUDED.pct_holdings_leader,
        pct_holdings_emerging = EXCLUDED.pct_holdings_emerging,
        pct_holdings_broken = EXCLUDED.pct_holdings_broken,
        top_sector = EXCLUDED.top_sector,
        sector_herfindahl = EXCLUDED.sector_herfindahl,
        top10_concentration = EXCLUDED.top10_concentration,
        avg_holding_ret_3m = EXCLUDED.avg_holding_ret_3m,
        avg_holding_frag_score = EXCLUDED.avg_holding_frag_score,
        cap_large_pct = EXCLUDED.cap_large_pct,
        cap_mid_pct = EXCLUDED.cap_mid_pct,
        cap_small_pct = EXCLUDED.cap_small_pct,
        cap_tilt = EXCLUDED.cap_tilt,
        dominant_sectors = EXCLUDED.dominant_sectors,
        n_holdings = EXCLUDED.n_holdings,
        lt_leader_participation = EXCLUDED.lt_leader_participation,
        lt_weighted_rs = EXCLUDED.lt_weighted_rs,
        staleness = EXCLUDED.staleness,
        staleness_days = EXCLUDED.staleness_days,
        updated_at = NOW()
    """

    await db.execute(text("SET LOCAL statement_timeout = '600000'"))
    await db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    await db.commit()

    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_mf_lookthrough
        WHERE tenant_id = :tenant_id AND date = :target_date
    """), {"tenant_id": TENANT_ID, "target_date": target_date})
    cnt = cnt_res.scalar_one()
    log.info("compute_mf_lookthrough_done", date=target_date.isoformat(), rows=cnt)
    return cnt


# ---------------------------------------------------------------------------
# Index look-through (equal weight)
# ---------------------------------------------------------------------------

async def compute_index_lookthrough(db: AsyncSession, target_date: date | None = None) -> int:
    """Compute equal-weight look-through for indices (de_index_constituents has NULL weights)."""
    if target_date is None:
        r = await db.execute(text("""
            SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id
        """), {"tenant_id": TENANT_ID})
        target_date = r.scalar_one()
        if target_date is None:
            return 0

    log.info("compute_index_lookthrough_start", date=target_date.isoformat())

    sql = """
    WITH constituents AS (
        SELECT
            ic.index_code AS mf_id,
            ic.instrument_id::text AS child_id,
            COALESCE(ic.weight_pct, 0) / 100.0 AS weight_pct,
            i.sector
        FROM de_index_constituents ic
        JOIN unified_instruments i ON i.instrument_id = ic.instrument_id::text
        WHERE ic.effective_from <= :target_date
          AND (ic.effective_to IS NULL OR ic.effective_to >= :target_date)
    ),
    -- Equal weight for indices where all weights are NULL
    equal_weights AS (
        SELECT
            mf_id,
            child_id,
            sector,
            CASE
                WHEN SUM(weight_pct) OVER (PARTITION BY mf_id) = 0
                THEN 1.0 / COUNT(*) OVER (PARTITION BY mf_id)
                ELSE weight_pct
            END AS weight_pct
        FROM constituents
    ),
    child_metrics AS (
        SELECT
            m.instrument_id,
            m.rs_nifty_3m_rank,
            m.rs_nifty_12m_rank,
            m.ret_3m,
            m.frag_score,
            m.state,
            m.action
        FROM unified_metrics m
        WHERE m.tenant_id = :tenant_id
          AND m.date = :target_date
    ),
    child_caps AS (
        SELECT instrument_id, cap_category
        FROM unified_instruments
        WHERE tenant_id = :tenant_id
    ),
    weighted AS (
        SELECT
            ew.mf_id,
            ew.child_id,
            ew.weight_pct,
            ew.sector,
            cm.rs_nifty_3m_rank,
            cm.rs_nifty_12m_rank,
            cm.ret_3m,
            cm.frag_score,
            cm.state,
            cm.action,
            cc.cap_category
        FROM equal_weights ew
        LEFT JOIN child_metrics cm ON cm.instrument_id = ew.child_id
        LEFT JOIN child_caps cc ON cc.instrument_id = ew.child_id
    ),
    weighted_ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY mf_id ORDER BY weight_pct DESC) AS weight_rn
        FROM weighted
    ),
    top10_agg AS (
        SELECT mf_id, SUM(weight_pct) AS top10_concentration
        FROM weighted_ranked
        WHERE weight_rn <= 10
        GROUP BY mf_id
    ),
    sector_agg AS (
        SELECT mf_id, sector, SUM(weight_pct) AS sector_weight
        FROM weighted
        WHERE sector IS NOT NULL
        GROUP BY mf_id, sector
    ),
    sector_ranked AS (
        SELECT
            mf_id, sector, sector_weight,
            ROW_NUMBER() OVER (PARTITION BY mf_id ORDER BY sector_weight DESC) AS rn
        FROM sector_agg
    ),
    top_sectors AS (
        SELECT
            mf_id,
            JSONB_AGG(
                JSONB_BUILD_OBJECT('sector', sector, 'weight_pct', ROUND(sector_weight::numeric, 2))
                ORDER BY sector_weight DESC
            ) AS dominant_sectors
        FROM sector_ranked
        WHERE rn <= 3
        GROUP BY mf_id
    ),
    top_sector_single AS (
        SELECT DISTINCT ON (mf_id) mf_id, sector AS top_sector
        FROM sector_ranked
        ORDER BY mf_id, rn
    ),
    sector_herf AS (
        SELECT mf_id, SUM(POWER(sector_weight, 2)) AS sector_herfindahl
        FROM sector_agg
        GROUP BY mf_id
    ),
    fund_agg AS (
        SELECT
            w.mf_id,
            COUNT(DISTINCT w.child_id) AS num_holdings,
            SUM(w.weight_pct * COALESCE(w.rs_nifty_3m_rank, 50)) AS lookthrough_rs_3m,
            SUM(w.weight_pct * COALESCE(w.rs_nifty_12m_rank, 50)) AS lookthrough_rs_12m,
            SUM(CASE WHEN w.state = 'LEADER' THEN w.weight_pct ELSE 0 END) AS pct_holdings_leader,
            SUM(CASE WHEN w.state = 'EMERGING' THEN w.weight_pct ELSE 0 END) AS pct_holdings_emerging,
            SUM(CASE WHEN w.state = 'BROKEN' THEN w.weight_pct ELSE 0 END) AS pct_holdings_broken,
            SUM(w.weight_pct * COALESCE(w.ret_3m, 0)) AS avg_holding_ret_3m,
            SUM(w.weight_pct * COALESCE(w.frag_score, 0.5)) AS avg_holding_frag_score,
            SUM(CASE WHEN w.cap_category = 'LARGE' THEN w.weight_pct ELSE 0 END) AS cap_large_pct,
            SUM(CASE WHEN w.cap_category = 'MID' THEN w.weight_pct ELSE 0 END) AS cap_mid_pct,
            SUM(CASE WHEN w.cap_category = 'SMALL' THEN w.weight_pct ELSE 0 END) AS cap_small_pct
        FROM weighted w
        GROUP BY w.mf_id
    )
    INSERT INTO unified_mf_lookthrough (
        tenant_id, mf_id, date,
        num_holdings,
        lookthrough_rs_3m, lookthrough_rs_12m,
        pct_holdings_leader, pct_holdings_emerging, pct_holdings_broken,
        top_sector, sector_herfindahl, top10_concentration,
        avg_holding_ret_3m, avg_holding_frag_score,
        cap_large_pct, cap_mid_pct, cap_small_pct, cap_tilt, dominant_sectors,
        n_holdings, lt_leader_participation, lt_weighted_rs, staleness, staleness_days,
        created_at, updated_at
    )
    SELECT
        :tenant_id,
        fa.mf_id,
        :target_date,
        fa.num_holdings,
        fa.lookthrough_rs_3m,
        fa.lookthrough_rs_12m,
        fa.pct_holdings_leader,
        fa.pct_holdings_emerging,
        fa.pct_holdings_broken,
        ts.top_sector,
        sh.sector_herfindahl,
        t10.top10_concentration,
        fa.avg_holding_ret_3m,
        fa.avg_holding_frag_score,
        fa.cap_large_pct,
        fa.cap_mid_pct,
        fa.cap_small_pct,
        CASE
            WHEN GREATEST(fa.cap_large_pct, fa.cap_mid_pct, fa.cap_small_pct) = fa.cap_large_pct THEN 'LARGE'
            WHEN GREATEST(fa.cap_large_pct, fa.cap_mid_pct, fa.cap_small_pct) = fa.cap_mid_pct THEN 'MID'
            ELSE 'SMALL'
        END,
        COALESCE(tops.dominant_sectors, '[]'::jsonb),
        fa.num_holdings,
        fa.pct_holdings_leader,
        fa.lookthrough_rs_3m,
        'FRESH',
        0,
        NOW(), NOW()
    FROM fund_agg fa
    LEFT JOIN top_sector_single ts ON ts.mf_id = fa.mf_id
    LEFT JOIN top_sectors tops ON tops.mf_id = fa.mf_id
    LEFT JOIN sector_herf sh ON sh.mf_id = fa.mf_id
    LEFT JOIN top10_agg t10 ON t10.mf_id = fa.mf_id
    ON CONFLICT (tenant_id, mf_id, date) DO UPDATE SET
        num_holdings = EXCLUDED.num_holdings,
        lookthrough_rs_3m = EXCLUDED.lookthrough_rs_3m,
        lookthrough_rs_12m = EXCLUDED.lookthrough_rs_12m,
        pct_holdings_leader = EXCLUDED.pct_holdings_leader,
        pct_holdings_emerging = EXCLUDED.pct_holdings_emerging,
        pct_holdings_broken = EXCLUDED.pct_holdings_broken,
        top_sector = EXCLUDED.top_sector,
        sector_herfindahl = EXCLUDED.sector_herfindahl,
        top10_concentration = EXCLUDED.top10_concentration,
        avg_holding_ret_3m = EXCLUDED.avg_holding_ret_3m,
        avg_holding_frag_score = EXCLUDED.avg_holding_frag_score,
        cap_large_pct = EXCLUDED.cap_large_pct,
        cap_mid_pct = EXCLUDED.cap_mid_pct,
        cap_small_pct = EXCLUDED.cap_small_pct,
        cap_tilt = EXCLUDED.cap_tilt,
        dominant_sectors = EXCLUDED.dominant_sectors,
        n_holdings = EXCLUDED.n_holdings,
        lt_leader_participation = EXCLUDED.lt_leader_participation,
        lt_weighted_rs = EXCLUDED.lt_weighted_rs,
        staleness = EXCLUDED.staleness,
        staleness_days = EXCLUDED.staleness_days,
        updated_at = NOW()
    """

    await db.execute(text("SET LOCAL statement_timeout = '600000'"))
    await db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    await db.commit()

    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_mf_lookthrough
        WHERE tenant_id = :tenant_id AND date = :target_date
          AND mf_id IN (SELECT DISTINCT index_code FROM de_index_constituents)
    """), {"tenant_id": TENANT_ID, "target_date": target_date})
    cnt = cnt_res.scalar_one()
    log.info("compute_index_lookthrough_done", date=target_date.isoformat(), rows=cnt)
    return cnt


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_lookthrough_pipeline(target_date: date | None = None) -> dict[str, Any]:
    """Run both MF/ETF and index look-through compute."""
    results: dict[str, Any] = {}
    async with async_session_factory() as db:
        try:
            mf_cnt = await compute_mf_lookthrough(db, target_date)
            await _log_phase(db, "mf_lookthrough", "SUCCESS", rows_processed=mf_cnt)
            results["mf_lookthrough"] = {"status": "SUCCESS", "rows": mf_cnt}
        except Exception as exc:
            log.error("mf_lookthrough_failed", error=str(exc))
            await db.rollback()
            await _log_phase(db, "mf_lookthrough", "FAILED", error_message=str(exc))
            results["mf_lookthrough"] = {"status": "FAILED", "error": str(exc)}

        try:
            idx_cnt = await compute_index_lookthrough(db, target_date)
            await _log_phase(db, "index_lookthrough", "SUCCESS", rows_processed=idx_cnt)
            results["index_lookthrough"] = {"status": "SUCCESS", "rows": idx_cnt}
        except Exception as exc:
            log.error("index_lookthrough_failed", error=str(exc))
            await db.rollback()
            await _log_phase(db, "index_lookthrough", "FAILED", error_message=str(exc))
            results["index_lookthrough"] = {"status": "FAILED", "error": str(exc)}

    return results
