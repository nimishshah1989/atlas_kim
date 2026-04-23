#!/usr/bin/env python3
"""
Run the key fixup phases from unified_compute.py directly:
1. backfill_technicals_for_date for the global latest date
2. forward_fill_metrics to copy latest rows to global latest date
3. ensure_latest_metrics_for_all as safety net
"""

import asyncio
from datetime import date
import sys
sys.path.insert(0, '/home/ubuntu/atlas_kim')

from backend.services.unified_compute import (
    backfill_technicals_for_date,
    forward_fill_metrics,
    ensure_latest_metrics_for_all,
    TENANT_ID,
)
from backend.db.session import async_session_factory
from sqlalchemy import text


async def get_global_latest_date(db):
    r = await db.execute(text("SELECT MAX(date) FROM unified_metrics WHERE tenant_id = :tenant_id"), {"tenant_id": TENANT_ID})
    return r.scalar()


async def main():
    async with async_session_factory() as db:
        latest_date = await get_global_latest_date(db)
        print(f"Global latest date: {latest_date}")

        # 1. Backfill technicals for latest date
        print("Backfilling technicals...")
        tech_cnt = await backfill_technicals_for_date(db, latest_date)
        print(f"  Rows with technicals on {latest_date}: {tech_cnt}")

        # 2. Forward-fill metrics for instruments missing on latest date
        print("Forward-filling metrics...")
        ff_cnt = await forward_fill_metrics(db)
        print(f"  Total instruments on latest date after forward-fill: {ff_cnt}")

        # 3. Validation counts
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
