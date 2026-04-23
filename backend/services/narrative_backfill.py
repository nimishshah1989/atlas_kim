"""Backfill narrative JSONB for all unified_metrics rows."""
from __future__ import annotations

from datetime import date
from typing import Any

import structlog
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import async_session_factory
from backend.db.unified_models import UnifiedInstrument, UnifiedMetric, UnifiedMarketRegime
from backend.services.unified_narrative import generate_narrative

log = structlog.get_logger()
TENANT_ID = "default"


async def backfill_narratives(db: AsyncSession, batch_size: int = 2000) -> int:
    """Populate narrative JSONB for all rows in unified_metrics."""
    log.info("narrative_backfill_start")
    await db.execute(text("SET LOCAL statement_timeout = '600000'"))

    # Get all distinct dates
    date_result = await db.execute(
        select(UnifiedMetric.date).where(
            UnifiedMetric.tenant_id == TENANT_ID
        ).distinct().order_by(UnifiedMetric.date)
    )
    dates = [row[0] for row in date_result.fetchall()]
    log.info("narrative_dates_to_process", count=len(dates))

    total_updated = 0
    for target_date in dates:
        # Get regime for this date
        regime_result = await db.execute(
            select(UnifiedMarketRegime).where(
                UnifiedMarketRegime.tenant_id == TENANT_ID,
                UnifiedMarketRegime.date == target_date,
                UnifiedMarketRegime.region == "IN",
            )
        )
        regime_row = regime_result.scalar_one_or_none()
        regime_dict = {
            "regime": regime_row.regime,
            "direction": regime_row.direction,
            "health_zone": regime_row.health_zone,
            "health_score": regime_row.health_score,
        } if regime_row else None

        # Process in batches
        offset = 0
        date_updated = 0
        while True:
            metric_result = await db.execute(
                select(UnifiedMetric, UnifiedInstrument).join(
                    UnifiedInstrument,
                    (UnifiedMetric.instrument_id == UnifiedInstrument.instrument_id) &
                    (UnifiedMetric.tenant_id == UnifiedInstrument.tenant_id)
                ).where(
                    UnifiedMetric.tenant_id == TENANT_ID,
                    UnifiedMetric.date == target_date,
                ).limit(batch_size).offset(offset)
            )
            rows = metric_result.all()
            if not rows:
                break

            updates = []
            for metric, instrument in rows:
                metric_dict = {
                    col: getattr(metric, col)
                    for col in UnifiedMetric.__table__.columns.keys()
                    if hasattr(metric, col)
                }

                narrative = generate_narrative(
                    metric_dict,
                    regime_dict,
                    instrument_type=instrument.instrument_type,
                )
                updates.append({"id": metric.id, "narrative": narrative})

            if updates:
                await db.execute(
                    update(UnifiedMetric),
                    updates,
                )
                await db.commit()

            date_updated += len(rows)
            total_updated += len(rows)
            offset += batch_size
            log.info("narrative_backfill_batch", date=target_date.isoformat(), batch=len(rows), total_so_far=total_updated)

        log.info("narrative_backfill_date_done", date=target_date.isoformat(), updated=date_updated)

    log.info("narrative_backfill_complete", total_updated=total_updated)
    return total_updated


async def run_narrative_backfill() -> dict[str, Any]:
    """Run narrative backfill."""
    results: dict[str, Any] = {}
    async with async_session_factory() as db:
        try:
            cnt = await backfill_narratives(db)
            results["status"] = "SUCCESS"
            results["rows_updated"] = cnt
        except Exception as exc:
            log.error("narrative_backfill_failed", error=str(exc))
            results["status"] = "FAILED"
            results["error"] = str(exc)
    return results
