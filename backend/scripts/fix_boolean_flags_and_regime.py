"""
Fix missing above_ema_50/20/golden_cross booleans and recompute downstream metrics.

Root cause: source technical tables (de_equity_technical_daily etc.) only have
EMA data for ~7% of instruments on 2026-04-23. The ema_50 values in unified_metrics
were forward-filled from older dates, but the boolean flags were never recomputed.

This script:
1. Recomputes above_ema_20, above_ema_50, golden_cross by joining with price tables
2. Recomputes state, action, action_confidence, frag_score, frag_level
3. Recomputes unified_sector_breadth
4. Recomputes unified_market_regime for region='IN'
"""

import os
import asyncio
from datetime import date
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

DB_URL = "postgresql://jip_admin:JipDataEngine2026Secure@jip-data-engine.ctay2iewomaj.ap-south-1.rds.amazonaws.com:5432/data_engine"
TENANT_ID = "default"


def get_sync_db():
    engine = create_engine(DB_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


def fix_boolean_flags(db, target_date: date) -> int:
    """Recompute above_ema_20/50 and golden_cross using current prices + forward-filled EMAs."""
    sql = """
    WITH prices AS (
        SELECT instrument_id::text AS instrument_id, date, close AS px
        FROM de_equity_ohlcv WHERE date = :target_date
        UNION ALL
        SELECT ticker, date, close FROM de_etf_ohlcv WHERE date = :target_date
        UNION ALL
        SELECT index_code, date, close FROM de_index_prices WHERE date = :target_date
        UNION ALL
        SELECT ticker, date, close FROM de_global_price_daily WHERE date = :target_date
        UNION ALL
        SELECT mstar_id, nav_date, nav FROM de_mf_nav_daily WHERE nav_date = :target_date
    )
    UPDATE unified_metrics um
    SET
        above_ema_20 = (p.px > um.ema_20)::boolean,
        above_ema_50 = (p.px > um.ema_50)::boolean,
        golden_cross = (um.ema_50 > um.ema_200)::boolean,
        updated_at = NOW()
    FROM prices p
    WHERE um.tenant_id = :tenant_id
      AND um.date = :target_date
      AND um.instrument_id = p.instrument_id
      AND um.ema_50 IS NOT NULL
    """
    result = db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    db.commit()
    return result.rowcount


def fix_states_and_actions(db, target_date: date) -> int:
    """Recompute state, action, action_confidence, frag_score, frag_level."""
    sql = """
    UPDATE unified_metrics um
    SET
        state = CASE
            WHEN um.rs_nifty_3m_rank >= 80 AND um.rs_nifty_12m_rank >= 70 AND um.above_ema_50 = true THEN 'LEADER'
            WHEN um.rs_nifty_3m_rank >= 60 AND um.rs_nifty_12m_rank >= 50 AND um.above_ema_50 = true THEN 'EMERGING'
            WHEN um.rs_nifty_3m_rank < 40 AND um.rs_nifty_12m_rank < 40 AND um.above_ema_50 = false THEN 'LAGGING'
            WHEN um.rs_nifty_3m_rank < 30 AND um.above_ema_50 = false THEN 'BROKEN'
            WHEN um.rs_nifty_3m_rank >= 60 AND (um.rs_nifty_12m_rank < 50 OR um.above_ema_50 = false) THEN 'WEAKENING'
            WHEN um.rs_nifty_3m_rank >= 40 AND um.rs_nifty_3m_rank < 80 AND um.above_ema_50 = true THEN 'HOLDING'
            ELSE 'BASE'
        END::text,
        action = CASE
            WHEN um.rs_nifty_3m_rank >= 80 AND um.above_ema_50 = true AND um.golden_cross = true THEN 'STRONG_ACCUMULATE'
            WHEN um.rs_nifty_3m_rank >= 60 AND um.above_ema_50 = true THEN 'ACCUMULATE'
            WHEN um.rs_nifty_3m_rank < 30 AND um.above_ema_50 = false THEN 'EXIT'
            WHEN um.rs_nifty_3m_rank < 40 AND um.above_ema_50 = false THEN 'REDUCE'
            ELSE 'HOLD'
        END::text,
        action_confidence = LEAST(1.0, GREATEST(0.0,
            (COALESCE(um.rs_nifty_3m_rank, 50) / 100.0) * 0.3 +
            (COALESCE(um.rs_nifty_12m_rank, 50) / 100.0) * 0.3 +
            (CASE WHEN um.above_ema_50 THEN 1.0 ELSE 0.0 END) * 0.2 +
            (CASE WHEN um.golden_cross THEN 1.0 ELSE 0.0 END) * 0.2
        ))::double precision,
        frag_score = LEAST(1.0, GREATEST(0.0,
            (1.0 - COALESCE(um.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
            (CASE WHEN um.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
            COALESCE(ABS(um.ret_3m), 0.0) * 0.01 * 0.3
        ))::double precision,
        frag_level = CASE
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(um.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN um.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(um.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.7 THEN 'CRITICAL'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(um.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN um.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(um.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.4 THEN 'HIGH'
            WHEN LEAST(1.0, GREATEST(0.0,
                (1.0 - COALESCE(um.rs_nifty_3m_rank, 50) / 100.0) * 0.4 +
                (CASE WHEN um.above_ema_50 THEN 0.0 ELSE 1.0 END) * 0.3 +
                COALESCE(ABS(um.ret_3m), 0.0) * 0.01 * 0.3
            )) >= 0.2 THEN 'MEDIUM'
            ELSE 'LOW'
        END::text,
        updated_at = NOW()
    WHERE um.tenant_id = :tenant_id
      AND um.date = :target_date
    """
    result = db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    db.commit()
    return result.rowcount


def recompute_sector_breadth(db, target_date: date) -> int:
    """Recompute unified_sector_breadth using corrected above_ema_50 flags."""
    sql = """
    WITH sector_agg AS (
        SELECT
            i.sector,
            COUNT(*)::int AS member_count,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_nifty_3m_rank ASC NULLS LAST)::double precision AS median_rs_3m,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.rs_nifty_12m_rank ASC NULLS LAST)::double precision AS median_rs_12m,
            (AVG(CASE WHEN m.above_ema_50 = true THEN 1.0 ELSE 0.0 END) * 100.0)::double precision AS pct_above_ema_50,
            (AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0)::double precision AS participation,
            AVG(m.frag_score)::double precision AS frag_score,
            MODE() WITHIN GROUP (ORDER BY m.action) AS action,
            AVG(m.action_confidence)::double precision AS action_confidence
        FROM unified_metrics m
        JOIN unified_instruments i ON i.instrument_id = m.instrument_id AND i.tenant_id = m.tenant_id
        WHERE m.tenant_id = :tenant_id
          AND m.date = :target_date
          AND i.instrument_type IN ('EQUITY', 'ETF')
          AND i.sector IS NOT NULL
        GROUP BY i.sector
    )
    INSERT INTO unified_sector_breadth (
        date, tenant_id, sector,
        member_count, median_rs_3m, median_rs_12m,
        pct_above_ema_50, participation, frag_score, action, action_confidence
    )
    SELECT
        :target_date, :tenant_id, sector,
        member_count, median_rs_3m, median_rs_12m,
        pct_above_ema_50, participation, frag_score, action, action_confidence
    FROM sector_agg
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
    result = db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    db.commit()
    return result.rowcount


def recompute_market_regime(db, target_date: date) -> int:
    """Recompute IN market regime using corrected above_ema_50 flags."""
    sql = """
    WITH daily AS (
        SELECT
            COUNT(*) AS total,
            AVG(CASE WHEN m.above_ema_20 = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_above_ema_20,
            AVG(CASE WHEN m.above_ema_50 = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_above_ema_50,
            AVG(CASE WHEN m.golden_cross = true THEN 1.0 ELSE 0.0 END) * 100.0 AS pct_golden_cross,
            AVG(CASE WHEN m.state = 'LEADER' THEN 1.0 ELSE 0.0 END) * 100.0 AS participation,
            STDDEV_SAMP(COALESCE(m.rs_nifty_3m_rank, 50)) AS rs_dispersion,
            AVG(CASE WHEN m.action IN ('STRONG_ACCUMULATE','ACCUMULATE') THEN 1.0 ELSE 0.0 END) * 100.0 AS accumulate_pct
        FROM unified_metrics m
        JOIN unified_instruments i ON i.instrument_id = m.instrument_id AND i.tenant_id = m.tenant_id
        WHERE m.tenant_id = :tenant_id
          AND m.date = :target_date
          AND i.country = 'IN'
          AND i.instrument_type IN ('EQUITY', 'ETF', 'MF', 'INDEX')
    )
    INSERT INTO unified_market_regime (
        date, tenant_id, region,
        pct_above_ema_20, pct_above_ema_50, pct_above_ema_200, pct_golden_cross,
        participation, rs_dispersion, health_score, health_zone, regime, direction
    )
    SELECT
        :target_date,
        :tenant_id,
        'IN',
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
    FROM daily d
    ON CONFLICT (date, tenant_id, region) DO UPDATE SET
        pct_above_ema_20 = EXCLUDED.pct_above_ema_20,
        pct_above_ema_50 = EXCLUDED.pct_above_ema_50,
        pct_golden_cross = EXCLUDED.pct_golden_cross,
        participation    = EXCLUDED.participation,
        rs_dispersion    = EXCLUDED.rs_dispersion,
        health_score     = EXCLUDED.health_score,
        health_zone      = EXCLUDED.health_zone,
        regime           = EXCLUDED.regime,
        direction        = EXCLUDED.direction
    """
    result = db.execute(text(sql), {"tenant_id": TENANT_ID, "target_date": target_date})
    db.commit()
    return result.rowcount


def main():
    target_date = date(2026, 4, 23)
    db = get_sync_db()
    try:
        print(f"Target date: {target_date}")

        print("\n[1/4] Recomputing boolean flags (above_ema_20/50, golden_cross)...")
        n = fix_boolean_flags(db, target_date)
        print(f"      Updated {n} rows")

        print("\n[2/4] Recomputing states, actions, frag scores...")
        n = fix_states_and_actions(db, target_date)
        print(f"      Updated {n} rows")

        print("\n[3/4] Recomputing sector breadth...")
        n = recompute_sector_breadth(db, target_date)
        print(f"      Updated {n} sectors")

        print("\n[4/4] Recomputing IN market regime...")
        n = recompute_market_regime(db, target_date)
        print(f"      Updated {n} regime rows")

        print("\n✅ Done")
    finally:
        db.close()


if __name__ == "__main__":
    main()
