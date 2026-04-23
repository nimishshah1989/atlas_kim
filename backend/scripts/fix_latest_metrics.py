#!/usr/bin/env python3
"""
Fix missing RS ranks and technicals on the global latest date by copying
from each instrument's most recent row that has the data.
"""

import asyncio
from backend.db.session import async_session_factory
from sqlalchemy import text

TENANT_ID = "default"


async def fix_rs_ranks(db):
    """Copy most recent RS rank values to latest date for rows with NULL RS."""
    sql = """
    WITH source AS (
        SELECT DISTINCT ON (instrument_id)
            instrument_id,
            rs_nifty_1d_rank, rs_nifty_1w_rank, rs_nifty_1m_rank, rs_nifty_3m_rank,
            rs_nifty_6m_rank, rs_nifty_12m_rank, rs_nifty_24m_rank, rs_nifty_36m_rank,
            rs_nifty500_1d_rank, rs_nifty500_1w_rank, rs_nifty500_1m_rank, rs_nifty500_3m_rank,
            rs_nifty500_6m_rank, rs_nifty500_12m_rank, rs_nifty500_24m_rank, rs_nifty500_36m_rank,
            rs_sp500_1d_rank, rs_sp500_1w_rank, rs_sp500_1m_rank, rs_sp500_3m_rank,
            rs_sp500_6m_rank, rs_sp500_12m_rank, rs_sp500_24m_rank, rs_sp500_36m_rank,
            rs_msci_1d_rank, rs_msci_1w_rank, rs_msci_1m_rank, rs_msci_3m_rank,
            rs_msci_6m_rank, rs_msci_12m_rank, rs_msci_24m_rank, rs_msci_36m_rank,
            rs_gold_1d_rank, rs_gold_1w_rank, rs_gold_1m_rank, rs_gold_3m_rank,
            rs_gold_6m_rank, rs_gold_12m_rank, rs_gold_24m_rank, rs_gold_36m_rank
        FROM unified_metrics
        WHERE tenant_id = :tenant_id
          AND rs_nifty_3m_rank IS NOT NULL
        ORDER BY instrument_id, date DESC
    )
    UPDATE unified_metrics um
    SET
        rs_nifty_1d_rank = COALESCE(um.rs_nifty_1d_rank, s.rs_nifty_1d_rank),
        rs_nifty_1w_rank = COALESCE(um.rs_nifty_1w_rank, s.rs_nifty_1w_rank),
        rs_nifty_1m_rank = COALESCE(um.rs_nifty_1m_rank, s.rs_nifty_1m_rank),
        rs_nifty_3m_rank = COALESCE(um.rs_nifty_3m_rank, s.rs_nifty_3m_rank),
        rs_nifty_6m_rank = COALESCE(um.rs_nifty_6m_rank, s.rs_nifty_6m_rank),
        rs_nifty_12m_rank = COALESCE(um.rs_nifty_12m_rank, s.rs_nifty_12m_rank),
        rs_nifty_24m_rank = COALESCE(um.rs_nifty_24m_rank, s.rs_nifty_24m_rank),
        rs_nifty_36m_rank = COALESCE(um.rs_nifty_36m_rank, s.rs_nifty_36m_rank),
        rs_nifty500_1d_rank = COALESCE(um.rs_nifty500_1d_rank, s.rs_nifty500_1d_rank),
        rs_nifty500_1w_rank = COALESCE(um.rs_nifty500_1w_rank, s.rs_nifty500_1w_rank),
        rs_nifty500_1m_rank = COALESCE(um.rs_nifty500_1m_rank, s.rs_nifty500_1m_rank),
        rs_nifty500_3m_rank = COALESCE(um.rs_nifty500_3m_rank, s.rs_nifty500_3m_rank),
        rs_nifty500_6m_rank = COALESCE(um.rs_nifty500_6m_rank, s.rs_nifty500_6m_rank),
        rs_nifty500_12m_rank = COALESCE(um.rs_nifty500_12m_rank, s.rs_nifty500_12m_rank),
        rs_nifty500_24m_rank = COALESCE(um.rs_nifty500_24m_rank, s.rs_nifty500_24m_rank),
        rs_nifty500_36m_rank = COALESCE(um.rs_nifty500_36m_rank, s.rs_nifty500_36m_rank),
        rs_sp500_1d_rank = COALESCE(um.rs_sp500_1d_rank, s.rs_sp500_1d_rank),
        rs_sp500_1w_rank = COALESCE(um.rs_sp500_1w_rank, s.rs_sp500_1w_rank),
        rs_sp500_1m_rank = COALESCE(um.rs_sp500_1m_rank, s.rs_sp500_1m_rank),
        rs_sp500_3m_rank = COALESCE(um.rs_sp500_3m_rank, s.rs_sp500_3m_rank),
        rs_sp500_6m_rank = COALESCE(um.rs_sp500_6m_rank, s.rs_sp500_6m_rank),
        rs_sp500_12m_rank = COALESCE(um.rs_sp500_12m_rank, s.rs_sp500_12m_rank),
        rs_sp500_24m_rank = COALESCE(um.rs_sp500_24m_rank, s.rs_sp500_24m_rank),
        rs_sp500_36m_rank = COALESCE(um.rs_sp500_36m_rank, s.rs_sp500_36m_rank),
        rs_msci_1d_rank = COALESCE(um.rs_msci_1d_rank, s.rs_msci_1d_rank),
        rs_msci_1w_rank = COALESCE(um.rs_msci_1w_rank, s.rs_msci_1w_rank),
        rs_msci_1m_rank = COALESCE(um.rs_msci_1m_rank, s.rs_msci_1m_rank),
        rs_msci_3m_rank = COALESCE(um.rs_msci_3m_rank, s.rs_msci_3m_rank),
        rs_msci_6m_rank = COALESCE(um.rs_msci_6m_rank, s.rs_msci_6m_rank),
        rs_msci_12m_rank = COALESCE(um.rs_msci_12m_rank, s.rs_msci_12m_rank),
        rs_msci_24m_rank = COALESCE(um.rs_msci_24m_rank, s.rs_msci_24m_rank),
        rs_msci_36m_rank = COALESCE(um.rs_msci_36m_rank, s.rs_msci_36m_rank),
        rs_gold_1d_rank = COALESCE(um.rs_gold_1d_rank, s.rs_gold_1d_rank),
        rs_gold_1w_rank = COALESCE(um.rs_gold_1w_rank, s.rs_gold_1w_rank),
        rs_gold_1m_rank = COALESCE(um.rs_gold_1m_rank, s.rs_gold_1m_rank),
        rs_gold_3m_rank = COALESCE(um.rs_gold_3m_rank, s.rs_gold_3m_rank),
        rs_gold_6m_rank = COALESCE(um.rs_gold_6m_rank, s.rs_gold_6m_rank),
        rs_gold_12m_rank = COALESCE(um.rs_gold_12m_rank, s.rs_gold_12m_rank),
        rs_gold_24m_rank = COALESCE(um.rs_gold_24m_rank, s.rs_gold_24m_rank),
        rs_gold_36m_rank = COALESCE(um.rs_gold_36m_rank, s.rs_gold_36m_rank),
        updated_at = NOW()
    FROM source s
    WHERE um.tenant_id = :tenant_id
      AND um.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id)
      AND um.instrument_id = s.instrument_id
      AND um.rs_nifty_3m_rank IS NULL
    """
    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    result = await db.execute(text(sql), {"tenant_id": TENANT_ID})
    await db.commit()
    print(f"  Fixed RS ranks for {result.rowcount} rows")
    return result.rowcount


async def fix_technicals(db):
    """Copy most recent technical values to latest date for rows with NULL technicals."""
    sql = """
    WITH source AS (
        SELECT DISTINCT ON (instrument_id)
            instrument_id,
            rsi_14, macd, macd_signal,
            ema_20, ema_50, ema_200,
            vol_21d, max_dd_252d
        FROM unified_metrics
        WHERE tenant_id = :tenant_id
          AND (rsi_14 IS NOT NULL OR ema_20 IS NOT NULL)
        ORDER BY instrument_id, date DESC
    )
    UPDATE unified_metrics um
    SET
        rsi_14 = COALESCE(um.rsi_14, s.rsi_14),
        macd = COALESCE(um.macd, s.macd),
        macd_signal = COALESCE(um.macd_signal, s.macd_signal),
        ema_20 = COALESCE(um.ema_20, s.ema_20),
        ema_50 = COALESCE(um.ema_50, s.ema_50),
        ema_200 = COALESCE(um.ema_200, s.ema_200),
        vol_21d = COALESCE(um.vol_21d, s.vol_21d),
        max_dd_252d = COALESCE(um.max_dd_252d, s.max_dd_252d),
        updated_at = NOW()
    FROM source s
    WHERE um.tenant_id = :tenant_id
      AND um.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id)
      AND um.instrument_id = s.instrument_id
      AND (um.rsi_14 IS NULL OR um.macd IS NULL OR um.ema_20 IS NULL)
    """
    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    result = await db.execute(text(sql), {"tenant_id": TENANT_ID})
    await db.commit()
    print(f"  Fixed technicals for {result.rowcount} rows")
    return result.rowcount


async def main():
    async with async_session_factory() as db:
        latest = await db.execute(text("SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id"), {"tenant_id": TENANT_ID})
        latest_date = latest.scalar()
        print(f"Global latest date: {latest_date}")

        print("Fixing RS ranks...")
        await fix_rs_ranks(db)

        print("Fixing technicals...")
        await fix_technicals(db)

        print("\nValidation results:")
        r = await db.execute(text("""
            SELECT i.instrument_type, COUNT(*) as cnt,
                   COUNT(rsi_14) as rsi_count,
                   COUNT(macd) as macd_count,
                   COUNT(ema_20) as ema20_count,
                   COUNT(rs_nifty_3m_rank) as rs3m_count
            FROM unified_metrics m
            JOIN unified_instruments i ON m.instrument_id = i.instrument_id
            WHERE m.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id)
            GROUP BY i.instrument_type
            ORDER BY i.instrument_type
        """), {"tenant_id": TENANT_ID})
        for row in r.mappings():
            print(f"  {row['instrument_type']}: total={row['cnt']}, rsi={row['rsi_count']}, macd={row['macd_count']}, ema20={row['ema20_count']}, rs3m={row['rs3m_count']}")

        r = await db.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(rsi_14) as rsi_count,
                   COUNT(macd) as macd_count,
                   COUNT(ema_20) as ema20_count,
                   COUNT(rs_nifty_3m_rank) as rs3m_count
            FROM unified_metrics
            WHERE tenant_id = :tenant_id
              AND date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id)
        """), {"tenant_id": TENANT_ID})
        total = r.mappings().first()
        print(f"\n  TOTAL: {total['total']} rows, rsi={total['rsi_count']}, macd={total['macd_count']}, ema20={total['ema20_count']}, rs3m={total['rs3m_count']}")


if __name__ == "__main__":
    asyncio.run(main())
