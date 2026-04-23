#!/usr/bin/env python3
"""Add missing RS rank columns to unified_metrics for 5 benchmarks × 8 periods."""

import asyncio
from sqlalchemy import text
from backend.db.session import async_session_factory

COLUMNS = [
    # Nifty 500
    ("rs_nifty500_1d_rank", "double precision"),
    ("rs_nifty500_1w_rank", "double precision"),
    ("rs_nifty500_1m_rank", "double precision"),
    ("rs_nifty500_6m_rank", "double precision"),
    ("rs_nifty500_24m_rank", "double precision"),
    ("rs_nifty500_36m_rank", "double precision"),
    # S&P 500
    ("rs_sp500_1d_rank", "double precision"),
    ("rs_sp500_1w_rank", "double precision"),
    ("rs_sp500_1m_rank", "double precision"),
    ("rs_sp500_6m_rank", "double precision"),
    ("rs_sp500_24m_rank", "double precision"),
    ("rs_sp500_36m_rank", "double precision"),
    # MSCI World
    ("rs_msci_1d_rank", "double precision"),
    ("rs_msci_1w_rank", "double precision"),
    ("rs_msci_1m_rank", "double precision"),
    ("rs_msci_6m_rank", "double precision"),
    ("rs_msci_24m_rank", "double precision"),
    ("rs_msci_36m_rank", "double precision"),
    # Gold
    ("rs_gold_1d_rank", "double precision"),
    ("rs_gold_1w_rank", "double precision"),
    ("rs_gold_1m_rank", "double precision"),
    ("rs_gold_6m_rank", "double precision"),
    ("rs_gold_24m_rank", "double precision"),
    ("rs_gold_36m_rank", "double precision"),
]


async def main():
    async with async_session_factory() as db:
        await db.execute(text("SET statement_timeout = '600000'"))
        for col_name, col_type in COLUMNS:
            try:
                await db.execute(text(f"ALTER TABLE unified_metrics ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                await db.commit()
                print(f"  Added column {col_name}")
            except Exception as exc:
                await db.rollback()
                print(f"  Error adding {col_name}: {exc}")
        print("Done adding missing RS rank columns.")


if __name__ == "__main__":
    asyncio.run(main())
