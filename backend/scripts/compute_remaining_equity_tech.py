#!/usr/bin/env python3
"""Compute missing equity technicals for remaining NULL equities."""

import sys
import psycopg2
import pandas as pd
import pandas_ta as ta
import numpy as np


def main(limit: int = 20, offset: int = 0):
    conn = psycopg2.connect(
        host="jip-data-engine.ctay2iewomaj.ap-south-1.rds.amazonaws.com",
        port=5432,
        dbname="data_engine",
        user="jip_admin",
        password="JipDataEngine2026Secure",
    )
    conn.set_session(autocommit=False)
    cur = conn.cursor()
    cur.execute("SET statement_timeout = '120000'")

    cur.execute("""
        SELECT i.instrument_id
        FROM unified_metrics m
        JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        WHERE m.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = 'default')
          AND m.rsi_14 IS NULL
          AND i.instrument_type = 'EQUITY'
        ORDER BY i.instrument_id
        LIMIT %s OFFSET %s
    """, (limit, offset))
    missing_ids = [row[0] for row in cur.fetchall()]
    cur.close()
    print(f"Processing {len(missing_ids)} equities (offset={offset}, limit={limit})")

    inserted = 0
    skipped = 0
    for inst_id in missing_ids:
        cur = conn.cursor()
        cur.execute("""
            SELECT date, close_adj, close
            FROM de_equity_ohlcv
            WHERE instrument_id = %s::uuid
            ORDER BY date
        """, (inst_id,))
        rows = cur.fetchall()
        cur.close()

        if len(rows) < 20:
            skipped += 1
            continue

        df = pd.DataFrame(rows, columns=["date", "close_adj", "close"])
        df = df.sort_values("date").set_index("date")
        close = df["close_adj"].fillna(df["close"]).astype(float).dropna()

        if len(close) < 20:
            skipped += 1
            continue

        ema_20 = ta.ema(close, length=20) if len(close) >= 20 else None
        ema_50 = ta.ema(close, length=50) if len(close) >= 50 else None
        ema_200 = ta.ema(close, length=200) if len(close) >= 200 else None
        rsi_14 = ta.rsi(close, length=14) if len(close) >= 14 else None
        macd = ta.macd(close, fast=12, slow=26, signal=9) if len(close) >= 26 else None
        returns = close.pct_change()
        vol_20d = returns.rolling(20).std() * np.sqrt(252) if len(close) >= 20 else None
        rolling_max = close.rolling(window=min(252, len(close)), min_periods=1).max()
        drawdown = (close - rolling_max) / rolling_max
        max_dd_252d = drawdown.rolling(window=min(252, len(close)), min_periods=1).min()

        latest_date = close.index[-1]
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO de_equity_technical_daily (
                instrument_id, date, close_adj,
                ema_20, ema_50, ema_200,
                rsi_14, macd_line, macd_signal,
                volatility_20d, max_drawdown_1y,
                created_at, updated_at
            ) VALUES (
                %s::uuid, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                NOW(), NOW()
            )
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
        """, (
            inst_id, latest_date, float(close.iloc[-1]),
            float(ema_20.iloc[-1]) if ema_20 is not None and pd.notna(ema_20.iloc[-1]) else None,
            float(ema_50.iloc[-1]) if ema_50 is not None and pd.notna(ema_50.iloc[-1]) else None,
            float(ema_200.iloc[-1]) if ema_200 is not None and pd.notna(ema_200.iloc[-1]) else None,
            float(rsi_14.iloc[-1]) if rsi_14 is not None and pd.notna(rsi_14.iloc[-1]) else None,
            float(macd["MACD_12_26_9"].iloc[-1]) if macd is not None and pd.notna(macd["MACD_12_26_9"].iloc[-1]) else None,
            float(macd["MACDs_12_26_9"].iloc[-1]) if macd is not None and pd.notna(macd["MACDs_12_26_9"].iloc[-1]) else None,
            float(vol_20d.iloc[-1]) if vol_20d is not None and pd.notna(vol_20d.iloc[-1]) else None,
            float(max_dd_252d.iloc[-1]) if pd.notna(max_dd_252d.iloc[-1]) else None,
        ))
        cur.close()
        inserted += 1

    conn.commit()
    print(f"Done. Inserted {inserted}, skipped {skipped}")
    conn.close()


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    main(limit=limit, offset=offset)
