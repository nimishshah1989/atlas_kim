"""Backfill mf_category and run MF ranking pipeline for latest date."""
import asyncio
from datetime import date

from backend.db.session import async_session_factory
from backend.services.mf_ranking_engine import run_ranking_pipeline
from sqlalchemy import text


async def main():
    async with async_session_factory() as db:
        # Step 1: Backfill missing mf_category from de_mf_master
        print("Backfilling missing mf_category values from de_mf_master...")
        result = await db.execute(text("""
            UPDATE unified_instruments i
            SET mf_category = mm.category_name
            FROM de_mf_master mm
            WHERE i.instrument_id = mm.mstar_id
              AND i.mf_category IS NULL
              AND mm.category_name IS NOT NULL
        """))
        await db.commit()
        print(f"Updated {result.rowcount} instruments with mf_category from de_mf_master")
        
        # Step 2: Also backfill from de_etf_master for ETFs if needed
        result2 = await db.execute(text("""
            UPDATE unified_instruments i
            SET mf_category = em.category
            FROM de_etf_master em
            WHERE i.instrument_id = em.ticker
              AND i.mf_category IS NULL
              AND em.category IS NOT NULL
        """))
        await db.commit()
        print(f"Updated {result2.rowcount} ETFs with mf_category from de_etf_master")
    
    # Step 3: Run ranking pipeline
    target_date = date(2026, 4, 23)
    print(f"\nRunning ranking pipeline for {target_date}...")
    results = await run_ranking_pipeline(target_date)
    print("Pipeline result:", results)
    
    # Step 4: Verify
    async with async_session_factory() as db:
        r = await db.execute(text("""
            SELECT COUNT(*) FROM unified_mf_rankings
            WHERE tenant_id = 'default' AND date = :d
        """), {"d": target_date})
        total = r.scalar_one()
        print(f"\nTotal ranking rows for {target_date}: {total}")
        
        r2 = await db.execute(text("""
            SELECT COUNT(*) 
            FROM unified_mf_rankings r
            JOIN de_mf_master mm ON mm.mstar_id = r.mf_id
            WHERE r.tenant_id = 'default' AND r.date = :d
              AND mm.is_etf = false 
              AND mm.is_index_fund = false 
              AND mm.broad_category = 'Equity'
              AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
              AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
        """), {"d": target_date})
        target_count = r2.scalar_one()
        print(f"Regular+Growth+Equity ranking rows: {target_count}")


if __name__ == "__main__":
    asyncio.run(main())
