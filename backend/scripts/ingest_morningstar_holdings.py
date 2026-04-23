#!/usr/bin/env python3
"""
Ingest Morningstar holdings from local JSON + existing de_mf_holdings
into unified_mf_holdings_detail, then compute dominant_sectors.

Usage:
    cd /home/ubuntu/atlas_kim
    source .venv/bin/activate
    python backend/scripts/ingest_morningstar_holdings.py
"""

import asyncio
import json
import os
import sys
from datetime import date
from decimal import Decimal
from typing import Any

import ijson
from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from backend.db.session import async_session_factory

TENANT_ID = "default"
TARGET_MF_FILE = "/tmp/mf_universe.json"
TARGET_ETF_FILE = "/tmp/etf_universe.json"
MSTAR_HOLDINGS_FILE = "/tmp/mstar_all_holdings.json"
BATCH_SIZE = 2000


# ---------------------------------------------------------------------------
# Schema migration
# ---------------------------------------------------------------------------
async def migrate_schema(db):
    print("Migrating schema...")

    # 1. Make child_id nullable
    await db.execute(text("""
        ALTER TABLE unified_mf_holdings_detail
        ALTER COLUMN child_id DROP NOT NULL
    """))

    # 2. Drop old blanket unique constraint (it blocks NULL child_id inserts)
    result = await db.execute(text("""
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'unified_mf_holdings_detail'::regclass
          AND contype = 'u'
          AND conname = 'uq_unified_mf_holdings_detail'
    """))
    if result.fetchone():
        await db.execute(text("""
            ALTER TABLE unified_mf_holdings_detail
            DROP CONSTRAINT uq_unified_mf_holdings_detail
        """))

    # 3. Partial unique indexes for mapped vs unmapped holdings
    await db.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_holdings_detail_mapped
        ON unified_mf_holdings_detail (tenant_id, mf_id, date, child_id)
        WHERE child_id IS NOT NULL
    """))
    await db.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_holdings_detail_unmapped
        ON unified_mf_holdings_detail (tenant_id, mf_id, date, isin)
        WHERE child_id IS NULL
    """))

    # 4. Dominant-sectors table (time-aware, one row per mf/date)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS unified_mf_dominant_sectors (
            tenant_id   VARCHAR(50) NOT NULL DEFAULT 'default',
            mf_id       VARCHAR(50) NOT NULL,
            date        DATE        NOT NULL,
            sectors     JSONB       NOT NULL DEFAULT '[]',
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (tenant_id, mf_id, date)
        )
    """))

    await db.commit()
    print("Schema migration complete.")


# ---------------------------------------------------------------------------
# Target universe
# ---------------------------------------------------------------------------
async def load_target_ids():
    with open(TARGET_MF_FILE) as f:
        mf = json.load(f)
    with open(TARGET_ETF_FILE) as f:
        etf = json.load(f)
    ids = {item["mstar_id"] for item in mf} | {item["mstar_id"] for item in etf}
    print(f"Target universe: {len(ids)} (MF={len(mf)}, ETF={len(etf)})")
    return ids


# ---------------------------------------------------------------------------
# ISIN → unified_instruments mapping
# ---------------------------------------------------------------------------
async def load_isin_mapping(db):
    result = await db.execute(text("""
        SELECT di.isin, di.id::text AS instrument_id
        FROM de_instrument di
        WHERE di.isin IS NOT NULL
    """))
    mapping = {row.isin: row.instrument_id for row in result}
    print(f"Loaded {len(mapping)} ISIN → instrument_id mappings")
    return mapping


# ---------------------------------------------------------------------------
# Batch upsert helpers
# ---------------------------------------------------------------------------
async def upsert_mapped_batch(db, rows):
    if not rows:
        return
    stmt = text("""
        INSERT INTO unified_mf_holdings_detail
            (tenant_id, mf_id, date, child_id, child_name, isin, sector,
             industry, weight_pct, shares_held, market_value, holding_type,
             source_raw, created_at)
        VALUES
            (:tenant_id, :mf_id, :date, :child_id, :child_name, :isin, :sector,
             :industry, :weight_pct, :shares_held, :market_value, :holding_type,
             (:source_raw)::jsonb, NOW())
        ON CONFLICT (tenant_id, mf_id, date, child_id)
            WHERE child_id IS NOT NULL
        DO UPDATE SET
            child_name   = EXCLUDED.child_name,
            isin         = EXCLUDED.isin,
            sector       = EXCLUDED.sector,
            industry     = EXCLUDED.industry,
            weight_pct   = EXCLUDED.weight_pct,
            shares_held  = EXCLUDED.shares_held,
            market_value = EXCLUDED.market_value,
            holding_type = EXCLUDED.holding_type,
            source_raw   = EXCLUDED.source_raw
    """)
    await db.execute(stmt, rows)


async def upsert_unmapped_batch(db, rows):
    if not rows:
        return
    stmt = text("""
        INSERT INTO unified_mf_holdings_detail
            (tenant_id, mf_id, date, child_id, child_name, isin, sector,
             industry, weight_pct, shares_held, market_value, holding_type,
             source_raw, created_at)
        VALUES
            (:tenant_id, :mf_id, :date, :child_id, :child_name, :isin, :sector,
             :industry, :weight_pct, :shares_held, :market_value, :holding_type,
             (:source_raw)::jsonb, NOW())
        ON CONFLICT (tenant_id, mf_id, date, isin)
            WHERE child_id IS NULL
        DO UPDATE SET
            child_name   = EXCLUDED.child_name,
            sector       = EXCLUDED.sector,
            industry     = EXCLUDED.industry,
            weight_pct   = EXCLUDED.weight_pct,
            shares_held  = EXCLUDED.shares_held,
            market_value = EXCLUDED.market_value,
            holding_type = EXCLUDED.holding_type,
            source_raw   = EXCLUDED.source_raw
    """)
    await db.execute(stmt, rows)


async def flush_batch(db, batch):
    mapped = [r for r in batch if r["child_id"] is not None]
    unmapped = [r for r in batch if r["child_id"] is None]
    await upsert_mapped_batch(db, mapped)
    await upsert_unmapped_batch(db, unmapped)


# ---------------------------------------------------------------------------
# Morningstar ingestion (streaming)
# ---------------------------------------------------------------------------
async def ingest_morningstar_holdings(db, target_ids, isin_map):
    print("\n=== Ingesting Morningstar holdings ===")

    # Use latest date from de_mf_holdings as the reference snapshot date
    r = await db.execute(text("SELECT MAX(as_of_date) FROM de_mf_holdings"))
    snapshot_date = r.scalar() or date.today()
    print(f"Using snapshot date: {snapshot_date}")

    inserted = 0
    processed_mfs = set()
    batch = []

    with open(MSTAR_HOLDINGS_FILE, "rb") as f:
        parser = ijson.items(f, "data.item")
        try:
            for item in parser:
                mstar_id = item.get("_id")
                if mstar_id not in target_ids:
                    continue

                holdings = item.get("api", {}).get("FHV2-HoldingDetail", [])
                if not holdings:
                    continue

                processed_mfs.add(mstar_id)

                for h in holdings:
                    isin = h.get("ISIN")
                    child_id = isin_map.get(isin) if isin else None

                    weight = None
                    if h.get("Weighting"):
                        try:
                            weight = float(h["Weighting"])
                        except ValueError:
                            pass

                    shares = None
                    if h.get("NumberOfShare"):
                        try:
                            shares = int(h["NumberOfShare"])
                        except ValueError:
                            pass

                    mv = None
                    if h.get("MarketValue"):
                        try:
                            mv = Decimal(h["MarketValue"])
                        except Exception:
                            pass

                    batch.append({
                        "tenant_id": TENANT_ID,
                        "mf_id": mstar_id,
                        "date": snapshot_date,
                        "child_id": child_id,
                        "child_name": h.get("Name"),
                        "isin": isin,
                        "sector": h.get("Sector"),
                        "industry": h.get("GlobalIndustry"),
                        "weight_pct": weight,
                        "shares_held": shares,
                        "market_value": mv,
                        "holding_type": h.get("HoldingType"),
                        "source_raw": json.dumps(h, default=str),
                    })

                    if len(batch) >= BATCH_SIZE:
                        await flush_batch(db, batch)
                        inserted += len(batch)
                        batch = []

                if len(processed_mfs) % 50 == 0:
                    print(f"  ... processed {len(processed_mfs)} MFs, inserted {inserted}")

        except ijson.common.IncompleteJSONError:
            print("  (reached end of truncated JSON file)")
        except Exception as e:
            print(f"  WARNING: parser stopped with {type(e).__name__}: {e}")

    if batch:
        await flush_batch(db, batch)
        inserted += len(batch)

    await db.commit()
    print(f"Morningstar: {len(processed_mfs)} funds, {inserted} rows")
    return processed_mfs, inserted, snapshot_date


# ---------------------------------------------------------------------------
# de_mf_holdings ingestion (fallback / complement)
# ---------------------------------------------------------------------------
async def ingest_de_mf_holdings(db, target_ids, isin_map, processed_mfs, snapshot_date):
    print("\n=== Ingesting de_mf_holdings (complement) ===")

    # Ingest ALL historical rows for target funds (230K total in source)
    r = await db.execute(text("""
        SELECT mstar_id, as_of_date, holding_name, isin, instrument_id::text,
               weight_pct, shares_held, market_value, sector_code
        FROM de_mf_holdings
        WHERE mstar_id = ANY(:ids)
        ORDER BY mstar_id, as_of_date
    """), {"ids": list(target_ids)})

    rows = r.all()
    print(f"Fetched {len(rows)} rows from de_mf_holdings for target universe")

    inserted = 0
    batch = []

    for row in rows:
        child_id = None
        if row.instrument_id:
            child_id = row.instrument_id
        elif row.isin:
            child_id = isin_map.get(row.isin)

        weight = float(row.weight_pct) if row.weight_pct is not None else None

        batch.append({
            "tenant_id": TENANT_ID,
            "mf_id": row.mstar_id,
            "date": row.as_of_date,
            "child_id": child_id,
            "child_name": row.holding_name,
            "isin": row.isin,
            "sector": row.sector_code,
            "industry": None,
            "weight_pct": weight,
            "shares_held": row.shares_held,
            "market_value": row.market_value,
            "holding_type": None,
            "source_raw": json.dumps({"source": "de_mf_holdings"}),
        })

        if len(batch) >= BATCH_SIZE:
            await flush_batch(db, batch)
            inserted += len(batch)
            batch = []

    if batch:
        await flush_batch(db, batch)
        inserted += len(batch)

    await db.commit()
    print(f"de_mf_holdings: {inserted} rows")
    return inserted


# ---------------------------------------------------------------------------
# De-duplicate: if a mapped row exists, drop the unmapped twin
# ---------------------------------------------------------------------------
async def cleanup_unmapped_duplicates(db):
    print("\n=== Cleaning up unmapped duplicates ===")
    r = await db.execute(text("""
        DELETE FROM unified_mf_holdings_detail unmapped
        WHERE unmapped.child_id IS NULL
          AND EXISTS (
              SELECT 1 FROM unified_mf_holdings_detail mapped
              WHERE mapped.tenant_id = unmapped.tenant_id
                AND mapped.mf_id     = unmapped.mf_id
                AND mapped.date      = unmapped.date
                AND mapped.isin      = unmapped.isin
                AND mapped.child_id IS NOT NULL
          )
    """))
    await db.commit()
    print(f"Removed {r.rowcount} unmapped duplicates")


# ---------------------------------------------------------------------------
# Dominant sectors
# ---------------------------------------------------------------------------
async def compute_dominant_sectors(db):
    print("\n=== Computing dominant sectors ===")

    # Clear and recompute
    await db.execute(text("TRUNCATE unified_mf_dominant_sectors"))

    r = await db.execute(text("""
        INSERT INTO unified_mf_dominant_sectors
            (tenant_id, mf_id, date, sectors, updated_at)
        SELECT
            tenant_id,
            mf_id,
            date,
            jsonb_agg(
                jsonb_build_object(
                    'sector', sector,
                    'weight_pct', ROUND(sector_weight::numeric, 4)
                ) ORDER BY sector_weight DESC
            ) FILTER (WHERE rn <= 3),
            NOW()
        FROM (
            SELECT
                tenant_id,
                mf_id,
                date,
                COALESCE(sector, 'Unknown') AS sector,
                SUM(COALESCE(weight_pct, 0)) AS sector_weight,
                ROW_NUMBER() OVER (
                    PARTITION BY tenant_id, mf_id, date
                    ORDER BY SUM(COALESCE(weight_pct, 0)) DESC
                ) AS rn
            FROM unified_mf_holdings_detail
            GROUP BY tenant_id, mf_id, date, COALESCE(sector, 'Unknown')
        ) ranked
        WHERE rn <= 3
        GROUP BY tenant_id, mf_id, date
    """))

    await db.commit()

    r = await db.execute(text("SELECT COUNT(*) FROM unified_mf_dominant_sectors"))
    print(f"Dominant sectors computed for {r.scalar()} fund/date combinations")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
async def validate(db, target_ids):
    print("\n=== VALIDATION ===")

    r = await db.execute(text("""
        SELECT COUNT(DISTINCT mf_id)
        FROM unified_mf_holdings_detail
        WHERE mf_id = ANY(:ids)
    """), {"ids": list(target_ids)})
    distinct_mfs = r.scalar()

    r = await db.execute(text("""
        SELECT COUNT(*) FROM unified_mf_holdings_detail
        WHERE mf_id = ANY(:ids)
    """), {"ids": list(target_ids)})
    total_rows = r.scalar()

    r = await db.execute(text("""
        SELECT COUNT(*) FROM unified_mf_holdings_detail
        WHERE mf_id = ANY(:ids) AND child_id IS NOT NULL
    """), {"ids": list(target_ids)})
    mapped_rows = r.scalar()

    r = await db.execute(text("""
        SELECT COUNT(DISTINCT mf_id)
        FROM unified_mf_holdings_detail
        WHERE mf_id = ANY(:ids) AND child_id IS NOT NULL
    """), {"ids": list(target_ids)})
    mapped_mfs = r.scalar()

    mapping_rate = (mapped_rows / total_rows * 100) if total_rows else 0

    r = await db.execute(text("""
        SELECT COUNT(DISTINCT mf_id) FROM unified_mf_dominant_sectors
        WHERE mf_id = ANY(:ids)
    """), {"ids": list(target_ids)})
    ds_mfs = r.scalar()

    print(f"Target funds:              {len(target_ids)}")
    print(f"Funds with holdings:       {distinct_mfs}")
    print(f"Funds with mapped holdings:{mapped_mfs}")
    print(f"Total holding rows:        {total_rows}")
    print(f"Mapped rows:               {mapped_rows} ({mapping_rate:.1f}%)")
    print(f"Funds with dominant_sectors:{ds_mfs}")

    return {
        "target": len(target_ids),
        "with_holdings": distinct_mfs,
        "mapped_mfs": mapped_mfs,
        "total_rows": total_rows,
        "mapped_rows": mapped_rows,
        "mapping_rate": mapping_rate,
        "dominant_sectors": ds_mfs,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    async with async_session_factory() as db:
        target_ids = await load_target_ids()
        isin_map = await load_isin_mapping(db)
        await migrate_schema(db)

        processed_mfs, mstar_rows, snapshot_date = await ingest_morningstar_holdings(
            db, target_ids, isin_map
        )
        de_rows = await ingest_de_mf_holdings(
            db, target_ids, isin_map, processed_mfs, snapshot_date
        )

        await cleanup_unmapped_duplicates(db)
        await compute_dominant_sectors(db)
        stats = await validate(db, target_ids)

        print("\n=== DONE ===")
        return stats


if __name__ == "__main__":
    stats = asyncio.run(main())
    # Write summary for CI / logging
    with open("/tmp/ingest_holdings_summary.json", "w") as f:
        json.dump(stats, f, indent=2, default=str)
