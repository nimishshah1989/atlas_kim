#!/usr/bin/env python3
"""Run ensure_latest_metrics_for_all and validate."""

import asyncio
import sys
sys.path.insert(0, '/home/ubuntu/atlas_kim')

from backend.services.unified_compute import ensure_latest_metrics_for_all, TENANT_ID
from backend.db.session import async_session_factory
from sqlalchemy import text


async def main():
    async with async_session_factory() as db:
        print("Running ensure_latest_metrics_for_all...")
        coverage = await ensure_latest_metrics_for_all(db)
        print(f"  Coverage: {coverage}")

        print("\nValidation:")
        r = await db.execute(text("""
            SELECT i.instrument_type, COUNT(*) as total,
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

        r = await db.execute(text("""
            SELECT COUNT(*) FROM unified_instruments ui
            WHERE NOT EXISTS (
                SELECT 1 FROM unified_metrics m 
                WHERE m.instrument_id = ui.instrument_id AND m.tenant_id = ui.tenant_id
            )
        """))
        missing_any = r.scalar()
        print(f"\n  Instruments with ZERO metrics rows: {missing_any}")


if __name__ == "__main__":
    asyncio.run(main())
