#!/usr/bin/env python3
"""Compute missing equity technicals synchronously using psycopg2."""

import uuid
import pandas as pd
import pandas_ta as ta
import numpy as np
import psycopg2


def main():
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

    # Get equities with NULL tech on latest date
    cur.execute("""
        SELECT i.instrument_id
        FROM unified_metrics m
        JOIN unified_instruments i ON i.instrument_id = m.instrument_id
        WHERE m.date = (SELECT MAX(date) FROM unified_metrics WHERE tenant_id = 'default')
          AND m.rsi_14 IS NULL
          AND i.instrument_type = 'EQUITY'
    """)
    missing_ids = [row[0] for row in cur.fetchall()]
    print(f"Missing technicals for {len(missing_ids)} equities")

    inserted = 0
    skipped = 0
    for inst_id in missing_ids:
        uid = uuid.UUID(inst_id)
        cur.execute("""
            SELECT date, close_adj, close
            FROM de_equity_ohlcv
            WHERE instrument_id = %s::uuid
            ORDER BY date
        """, (str(uid),))
        rows = cur.fetchall()
        if len(rows) < 200:
            skipped += 1
            continue

        df = pd.DataFrame(rows, columns=["date", "close_adj", "close"])
        df = df.sort_values("date").set_index("date")
        close = df["close_adj"].fillna(df["close"]).astype(float).dropna()

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
        latest_row = {
            "instrument_id": uid,
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
        }

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
            str(latest_row["instrument_id"]), latest_row["date"], latest_row["close_adj"],
            latest_row["ema_20"], latest_row["ema_50"], latest_row["ema_200"],
            latest_row["rsi_14"], latest_row["macd_line"], latest_row["macd_signal"],
            latest_row["volatility_20d"], latest_row["max_drawdown_1y"],
        ))

        inserted += 1
        if inserted % 50 == 0:
            conn.commit()
            print(f"  ... inserted {inserted}/{len(missing_ids)}, skipped {skipped}")

    conn.commit()
    print(f"Done. Inserted {inserted}, skipped {skipped}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
