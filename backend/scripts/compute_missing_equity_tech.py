#!/usr/bin/env python3
"""Compute missing equity technicals for instruments with NULL recent data."""

import asyncio
import uuid
import pandas as pd
import pandas_ta as ta
import numpy as np
from sqlalchemy import text
from backend.db.session import async_session_factory


async def main():
    async with async_session_factory() as db:
        await db.execute(text("SET LOCAL statement_timeout = '300000'"))

        # Get equities with NULL tech on latest date
        r = await db.execute(text("""
            SELECT i.instrument_id
            FROM unified_metrics m
            JOIN unified_instruments i ON i.instrument_id = m.instrument_id
            WHERE m.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = 'default')
              AND m.rsi_14 IS NULL
              AND i.instrument_type = 'EQUITY'
        """))
        missing_ids = [row[0] for row in r.fetchall()]
        print(f"Missing technicals for {len(missing_ids)} equities")

        if not missing_ids:
            print("Nothing to do.")
            return

        # Fetch ALL prices in one query
        uuids = [uuid.UUID(x) for x in missing_ids]
        r = await db.execute(text("""
            SELECT instrument_id::text AS instrument_id, date, close_adj, close
            FROM de_equity_ohlcv
            WHERE instrument_id = ANY(:ids)
            ORDER BY instrument_id, date
        """), {"ids": uuids})

        df = pd.DataFrame(r.fetchall(), columns=["instrument_id", "date", "close_adj", "close"])
        print(f"Fetched {len(df)} price rows for {df['instrument_id'].nunique()} instruments")

        # Group and compute
        records = []
        skipped = 0
        for inst_id, group in df.groupby("instrument_id"):
            group = group.sort_values("date")
            close = group["close_adj"].fillna(group["close"]).astype(float).dropna()

            if len(close) < 200:
                skipped += 1
                continue

            ema_20 = ta.ema(close, length=20)
            ema_50 = ta.ema(close, length=50)
            ema_200 = ta.ema(close, length=200)
            rsi_14 = ta.rsi(close, length=14)
            macd = ta.macd(close, fast=12, slow=26, signal=9)
            returns = close.pct_change()
            vol_20d = returns.rolling(20).std() * np.sqrt(252)
            rolling_max = close.rolling(window=252, min_periods=1).max()
            drawdown = (close - rolling_max) / rolling_max
            max_dd_252d = drawdown.rolling(window=252, min_periods=1).min()

            latest_date = close.index[-1]
            records.append({
                "instrument_id": uuid.UUID(inst_id),
                "date": latest_date,
                "close_adj": float(close.iloc[-1]),
                "ema_20": float(ema_20.iloc[-1]) if ema_20 is not None and pd.notna(ema_20.iloc[-1]) else None,
                "ema_50": float(ema_50.iloc[-1]) if ema_50 is not None and pd.notna(ema_50.iloc[-1]) else None,
                "ema_200": float(ema_200.iloc[-1]) if ema_200 is not None and pd.notna(ema_200.iloc[-1]) else None,
                "rsi_14": float(rsi_14.iloc[-1]) if rsi_14 is not None and pd.notna(rsi_14.iloc[-1]) else None,
                "macd_line": float(macd["MACD_12_26_9"].iloc[-1]) if macd is not None and pd.notna(macd["MACD_12_26_9"].iloc[-1]) else None,
                "macd_signal": float(macd["MACDs_12_26_9"].iloc[-1]) if macd is not None and pd.notna(macd["MACDs_12_26_9"].iloc[-1]) else None,
                "volatility_20d": float(vol_20d.iloc[-1]) if pd.notna(vol_20d.iloc[-1]) else None,
                "max_drawdown_1y": float(max_dd_252d.iloc[-1]) if pd.notna(max_dd_252d.iloc[-1]) else None,
            })

        print(f"Computed technicals for {len(records)} equities, skipped {skipped}")

        if records:
            # Bulk insert
            cols = ["instrument_id", "date", "close_adj", "ema_20", "ema_50", "ema_200",
                    "rsi_14", "macd_line", "macd_signal", "volatility_20d", "max_drawdown_1y"]
            placeholders = ",".join([f":{c}" for c in cols])
            stmt = text(f"""
                INSERT INTO de_equity_technical_daily ({','.join(cols)}, created_at, updated_at)
                VALUES ({placeholders}, NOW(), NOW())
                ON CONFLICT (instrument_id, date) DO UPDATE SET
                    ema_20 = EXCLUDED.ema_20,
                    ema_50 = EXCLUDED.ema_50,
                    ema_200 = EXCLUDED.ema_200,
                    rsi_14 = EXCLUDED.rsi_14,
                    macd_line = EXCLUDED.macd_line,
                    macd_signal = EXCLUDED.macd_signal,
                    volatility_20d = EXCLUDED.volatility_20d,
                    max_drawdown_1y = EXCLUDED.max_drawdown_1y,
                    updated_at = NOW()
            """)
            await db.execute(stmt, records)
            await db.commit()
            print(f"Inserted/updated {len(records)} rows in de_equity_technical_daily")


if __name__ == "__main__":
    asyncio.run(main())
