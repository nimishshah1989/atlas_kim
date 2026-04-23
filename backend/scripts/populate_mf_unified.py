#!/usr/bin/env python3
"""
Populate unified_instruments + unified_metrics for Regular+Equity+Growth MFs.
- 527 target funds from de_mf_master
- Compute missing technicals from NAV using pandas-ta
- Propagate latest data into unified_metrics via bulk SQL
"""

import asyncio
import pandas as pd
import pandas_ta as ta
import numpy as np
from datetime import date
from sqlalchemy import text
from backend.db.session import async_session_factory


TARGET_WHERE = """
    mm.is_etf = false AND mm.is_index_fund = false
    AND mm.broad_category = 'Equity'
    AND (mm.fund_name ILIKE '%%Reg%%' OR mm.fund_name ILIKE '%%Regular%%')
    AND (mm.fund_name ILIKE '%%Gr%%' OR mm.fund_name ILIKE '%%Growth%%')
    AND EXISTS (SELECT 1 FROM de_mf_nav_daily nav WHERE nav.mstar_id = mm.mstar_id)
"""


async def get_target_funds(db):
    """Return list of dicts with mstar_id, fund_name, isin, amfi_code, category_name, amc_name"""
    result = await db.execute(text(f"""
        SELECT mm.mstar_id, mm.fund_name, mm.isin, mm.amfi_code,
               mm.category_name, mm.amc_name, mm.primary_benchmark
        FROM de_mf_master mm
        WHERE {TARGET_WHERE}
        ORDER BY mm.mstar_id
    """))
    return [dict(row) for row in result.mappings().all()]


async def upsert_unified_instruments(db, funds):
    """Add missing MFs to unified_instruments"""
    added = 0
    for fund in funds:
        r = await db.execute(text("""
            SELECT 1 FROM unified_instruments
            WHERE instrument_id = :id AND instrument_type = 'MF'
        """), {"id": fund["mstar_id"]})
        if r.fetchone():
            continue

        await db.execute(text("""
            INSERT INTO unified_instruments (
                tenant_id, instrument_id, instrument_type, symbol,
                name, sector, exchange, is_active, created_at, updated_at
            ) VALUES (
                'default', :instrument_id, 'MF',
                COALESCE(:amfi_code, :isin, :mstar_id),
                :name, :category, 'NSE', true, NOW(), NOW()
            )
            ON CONFLICT (instrument_id) DO UPDATE SET
                name = EXCLUDED.name,
                sector = EXCLUDED.sector,
                symbol = EXCLUDED.symbol,
                updated_at = NOW()
        """), {
            "instrument_id": fund["mstar_id"],
            "amfi_code": fund["amfi_code"],
            "isin": fund["isin"],
            "mstar_id": fund["mstar_id"],
            "name": fund["fund_name"],
            "category": fund["category_name"],
        })
        added += 1

    await db.commit()
    print(f"Added {added} MFs to unified_instruments")
    return added


async def compute_missing_technicals(db, funds):
    """For funds with no technicals, compute from NAV and insert into de_mf_technical_daily"""
    missing = []
    for fund in funds:
        r = await db.execute(text("""
            SELECT 1 FROM de_mf_technical_daily
            WHERE mstar_id = :id LIMIT 1
        """), {"id": fund["mstar_id"]})
        if not r.fetchone():
            missing.append(fund)

    if not missing:
        print("No missing technicals to compute")
        return 0

    print(f"Computing technicals for {len(missing)} missing funds...")
    computed = 0
    for fund in missing:
        r = await db.execute(text("""
            SELECT nav_date, nav_adj, nav
            FROM de_mf_nav_daily
            WHERE mstar_id = :id
            ORDER BY nav_date
        """), {"id": fund["mstar_id"]})
        rows = r.fetchall()
        if len(rows) < 200:
            print(f"  SKIP {fund['mstar_id']} ({fund['fund_name']}) — only {len(rows)} NAV rows")
            continue

        df = pd.DataFrame(rows, columns=["nav_date", "nav_adj", "nav"])
        df = df.sort_values("nav_date").set_index("nav_date")
        close = df["nav_adj"].fillna(df["nav"]).astype(float).dropna()

        ema_20 = ta.ema(close, length=20)
        ema_50 = ta.ema(close, length=50)
        ema_200 = ta.ema(close, length=200)
        rsi_14 = ta.rsi(close, length=14)
        macd = ta.macd(close, fast=12, slow=26, signal=9)
        sma_20 = ta.sma(close, length=20)
        sma_50 = ta.sma(close, length=50)
        sma_200 = ta.sma(close, length=200)

        returns = close.pct_change()
        vol_20d = returns.rolling(20).std() * np.sqrt(252)
        rolling_max = close.rolling(window=252, min_periods=1).max()
        drawdown = (close - rolling_max) / rolling_max
        max_dd_252d = drawdown.rolling(window=252, min_periods=1).min()
        rolling_ret = close.pct_change(252)
        sharpe_1y = (rolling_ret - 0.06/252) / (returns.rolling(252).std() * np.sqrt(252))

        tech_df = pd.DataFrame({
            "nav_date": close.index,
            "mstar_id": fund["mstar_id"],
            "close_adj": close.values,
            "sma_20": sma_20.values,
            "sma_50": sma_50.values,
            "sma_200": sma_200.values,
            "ema_20": ema_20.values,
            "ema_50": ema_50.values,
            "ema_200": ema_200.values,
            "rsi_14": rsi_14.values,
            "macd_line": macd["MACD_12_26_9"].values if macd is not None else None,
            "macd_signal": macd["MACDs_12_26_9"].values if macd is not None else None,
            "macd_histogram": macd["MACDh_12_26_9"].values if macd is not None else None,
            "volatility_20d": vol_20d.values,
            "max_drawdown_1y": max_dd_252d.values,
            "sharpe_1y": sharpe_1y.values,
        }).reset_index(drop=True)

        tech_df = tech_df.iloc[200:].dropna(subset=["ema_20", "rsi_14"])
        if len(tech_df) == 0:
            print(f"  SKIP {fund['mstar_id']} — no valid rows after dropping NaN")
            continue

        cols = ["nav_date", "mstar_id", "close_adj", "sma_20", "sma_50", "sma_200",
                "ema_20", "ema_50", "ema_200", "rsi_14", "macd_line", "macd_signal",
                "macd_histogram", "volatility_20d", "max_drawdown_1y", "sharpe_1y"]
        placeholders = ",".join([f":{c}" for c in cols])
        stmt = text(f"""
            INSERT INTO de_mf_technical_daily ({','.join(cols)}, created_at, updated_at)
            VALUES ({placeholders}, NOW(), NOW())
            ON CONFLICT (mstar_id, nav_date) DO UPDATE SET
                close_adj = EXCLUDED.close_adj,
                sma_20 = EXCLUDED.sma_20, sma_50 = EXCLUDED.sma_50, sma_200 = EXCLUDED.sma_200,
                ema_20 = EXCLUDED.ema_20, ema_50 = EXCLUDED.ema_50, ema_200 = EXCLUDED.ema_200,
                rsi_14 = EXCLUDED.rsi_14,
                macd_line = EXCLUDED.macd_line, macd_signal = EXCLUDED.macd_signal, macd_histogram = EXCLUDED.macd_histogram,
                volatility_20d = EXCLUDED.volatility_20d, max_drawdown_1y = EXCLUDED.max_drawdown_1y, sharpe_1y = EXCLUDED.sharpe_1y,
                updated_at = NOW()
        """)
        records = tech_df[cols].to_dict('records')
        await db.execute(stmt, records)

        computed += 1
        if computed % 5 == 0:
            await db.commit()
            print(f"  ... computed {computed}/{len(missing)}")

    await db.commit()
    print(f"Computed technicals for {computed}/{len(missing)} missing funds")
    return computed


async def propagate_to_unified_metrics(db, funds):
    """Propagate latest technicals + NAV returns into unified_metrics for all target funds via bulk SQL."""
    print(f"Propagating {len(funds)} funds into unified_metrics via bulk SQL...")

    # Build a temp table with target fund IDs for efficient joining
    await db.execute(text("CREATE TEMP TABLE IF NOT EXISTS _tmp_target_mfs (mstar_id text PRIMARY KEY)"))
    await db.commit()
    await db.execute(text("TRUNCATE _tmp_target_mfs"))
    await db.commit()

    # Bulk insert target fund IDs
    batch_size = 500
    for i in range(0, len(funds), batch_size):
        batch = funds[i:i+batch_size]
        values = ",".join([f"('{f['mstar_id']}')" for f in batch])
        await db.execute(text(f"INSERT INTO _tmp_target_mfs (mstar_id) VALUES {values} ON CONFLICT DO NOTHING"))
    await db.commit()

    sql = """
    WITH latest_tech AS (
        SELECT DISTINCT ON (mstar_id)
            mstar_id,
            nav_date AS tech_date,
            ema_20, ema_50, ema_200,
            rsi_14, macd_line, macd_signal,
            volatility_20d, max_drawdown_1y
        FROM de_mf_technical_daily
        WHERE mstar_id IN (SELECT mstar_id FROM _tmp_target_mfs)
        ORDER BY mstar_id, nav_date DESC
    ),
    latest_nav AS (
        SELECT DISTINCT ON (mstar_id)
            mstar_id,
            nav_date,
            nav, nav_adj,
            return_1d, return_1w, return_1m, return_3m,
            return_6m, return_1y, return_3y, return_5y,
            nav_52wk_high, nav_52wk_low
        FROM de_mf_nav_daily
        WHERE mstar_id IN (SELECT mstar_id FROM _tmp_target_mfs)
        ORDER BY mstar_id, nav_date DESC
    ),
    merged AS (
        SELECT
            t.mstar_id,
            COALESCE(t.tech_date, n.nav_date) AS target_date,
            n.return_1d, n.return_1w, n.return_1m, n.return_3m,
            n.return_6m, n.return_1y, n.return_3y, n.return_5y,
            t.ema_20, t.ema_50, t.ema_200,
            (n.nav > t.ema_20)::boolean AS above_ema_20,
            (n.nav > t.ema_50)::boolean AS above_ema_50,
            (t.ema_50 > t.ema_200)::boolean AS golden_cross,
            t.volatility_20d AS rvol_20d,
            t.volatility_20d AS vol_21d,
            t.max_drawdown_1y AS max_dd_252d,
            t.max_drawdown_1y AS current_dd,
            t.rsi_14,
            t.macd_line AS macd,
            t.macd_signal,
            CASE WHEN n.nav_52wk_high > 0 THEN (n.nav - n.nav_52wk_high) / n.nav_52wk_high ELSE NULL END AS pct_from_52w_high,
            'NEUTRAL'::text AS state,
            'WATCH'::text AS action
        FROM latest_tech t
        JOIN latest_nav n ON n.mstar_id = t.mstar_id
    )
    INSERT INTO unified_metrics (
        tenant_id, instrument_id, date,
        ret_1d, ret_1w, ret_1m, ret_3m, ret_6m, ret_12m, ret_24m, ret_36m,
        ema_20, ema_50, ema_200,
        above_ema_20, above_ema_50, golden_cross,
        rvol_20d, vol_21d,
        max_dd_252d, current_dd,
        rsi_14, macd, macd_signal,
        pct_from_52w_high,
        state, action,
        created_at, updated_at
    )
    SELECT
        'default', mstar_id, target_date,
        return_1d, return_1w, return_1m, return_3m, return_6m, return_1y, return_3y, return_5y,
        ema_20, ema_50, ema_200,
        above_ema_20, above_ema_50, golden_cross,
        rvol_20d, vol_21d,
        max_dd_252d, current_dd,
        rsi_14, macd, macd_signal,
        pct_from_52w_high,
        state, action,
        NOW(), NOW()
    FROM merged
    ON CONFLICT (tenant_id, instrument_id, date) DO UPDATE SET
        ret_1d = EXCLUDED.ret_1d,
        ret_1w = EXCLUDED.ret_1w,
        ret_1m = EXCLUDED.ret_1m,
        ret_3m = EXCLUDED.ret_3m,
        ret_6m = EXCLUDED.ret_6m,
        ret_12m = EXCLUDED.ret_12m,
        ret_24m = EXCLUDED.ret_24m,
        ret_36m = EXCLUDED.ret_36m,
        ema_20 = EXCLUDED.ema_20,
        ema_50 = EXCLUDED.ema_50,
        ema_200 = EXCLUDED.ema_200,
        above_ema_20 = EXCLUDED.above_ema_20,
        above_ema_50 = EXCLUDED.above_ema_50,
        golden_cross = EXCLUDED.golden_cross,
        rvol_20d = EXCLUDED.rvol_20d,
        vol_21d = EXCLUDED.vol_21d,
        max_dd_252d = EXCLUDED.max_dd_252d,
        current_dd = EXCLUDED.current_dd,
        rsi_14 = EXCLUDED.rsi_14,
        macd = EXCLUDED.macd,
        macd_signal = EXCLUDED.macd_signal,
        pct_from_52w_high = EXCLUDED.pct_from_52w_high,
        state = EXCLUDED.state,
        action = EXCLUDED.action,
        updated_at = NOW()
    """
    await db.execute(text("SET LOCAL statement_timeout = '300000'"))
    result = await db.execute(text(sql))
    await db.commit()

    # Count inserted rows
    cnt_res = await db.execute(text("""
        SELECT COUNT(*) FROM unified_metrics m
        JOIN _tmp_target_mfs t ON t.mstar_id = m.instrument_id
    """))
    cnt = cnt_res.scalar_one()
    print(f"Inserted/updated {cnt} rows in unified_metrics for target MFs")
    return cnt


async def main():
    async with async_session_factory() as db:
        funds = await get_target_funds(db)
        print(f"Target funds: {len(funds)}")

        # 1. Add to unified_instruments
        await upsert_unified_instruments(db, funds)

        # 2. Compute missing technicals
        await compute_missing_technicals(db, funds)

        # 3. Propagate to unified_metrics via bulk SQL
        await propagate_to_unified_metrics(db, funds)

        print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
