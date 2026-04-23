# ATLAS-KIM Agent Memory — Unified RS Intelligence Engine

**Last updated:** 2026-04-23 19:15 UTC  
**Session status:** BACKEND COMPLETE — FRONTEND BUILD IN PROGRESS  
**CRITICAL: This file must be read at the start of every new session to restore context.**

---

## WHAT THIS PROJECT IS

`atlas-kim` (/home/ubuntu/atlas_kim) is the **Unified RS Intelligence Engine** — a standalone FastAPI + Next.js application built per the 35-page PDF spec "ATLAS RS Intelligence Engine new.pdf". It computes relative-strength analytics across equities, MFs, ETFs, and global indices on top of the existing JIP PostgreSQL RDS.

**Non-negotiable principles from spec:**
1. One database, one backend, one frontend
2. The stock is the atom — all intelligence rolls up from instrument-level
3. Every view answers "ACCUMULATE, EXIT, or HOLD?"
4. Natural language explanations, not codes
5. Five benchmarks × eight timeframes
6. Market breadth governs deployment

---

## WHAT HAS BEEN BUILT (BACKEND — COMPLETE)

### Database State (2026-04-23)

| Table | Rows | Coverage | Status |
|-------|------|----------|--------|
| `unified_instruments` | 4,257 | EQUITY:2281, MF:1508, ETF:220, INDEX:135, INDEX_GLOBAL:113 | ✅ Complete |
| `unified_metrics` | 4,257 on latest date (2026-04-23) | All instrument types | ✅ 100% coverage |
| `unified_mf_holdings_detail` | 212,444 | 858 funds | ✅ Ingested |
| `unified_mf_lookthrough` | 329 on latest date | 285 MFs + 34 indices + 10 ETFs | ✅ Computed |
| `unified_mf_rankings` | 1,110 on latest date | MFs + ETFs | ✅ 6-factor percentiles |
| `unified_market_regime` | 5 (GLOBAL) + India | Daily regime | ✅ Complete |
| `unified_sector_breadth` | 70 cohorts | Daily breadth | ✅ Complete |

### Metrics Coverage (Latest Date: 2026-04-23)

| Metric | Coverage | Status |
|--------|----------|--------|
| RSI-14 | 4,257/4,257 (100%) | ✅ |
| MACD | 4,257/4,257 (100%) | ✅ |
| EMA-20/50/200 | 4,257/4,257 (100%) | ✅ |
| Returns (1D-36M) | 4,257/4,257 (100%) | ✅ |
| RS Ranks (5 benchmarks × 8 periods) | >97% | ✅ 40 columns |
| State & Action | 4,257/4,257 (100%) | ✅ |
| Narrative JSONB | 4,257/4,257 (100%) | ✅ |

### API Endpoints (ALL LIVE)

**Core:** `/snapshot/{id}`, `/aggregate`, `/screen`, `/regime`  
**Funds:** `/funds/rankings`, `/funds/{id}/xray`, `/funds/{id}/holdings`, `/funds/categories`, `/funds/screen`  
**Global:** `/global/regime`, `/global/aggregate`

### Key Files Created/Modified

- `backend/services/unified_compute.py` — Extended for ALL instrument types
- `backend/services/mf_lookthrough_compute.py` — NEW
- `backend/services/mf_ranking_engine.py` — NEW
- `backend/services/global_compute.py` — NEW
- `backend/services/unified_narrative.py` — Extended for MF/ETF/Index/Global
- `backend/routes/unified.py` — 7 new endpoints + 3 modified
- `alembic/versions/002_add_missing_lt_regime_columns.py` — NEW

### Documentation

- `docs/DATA_ARCHITECTURE.md` — Complete data layer documentation (sources, tables, flows, daily ops)
- `docs/FRONTEND_ARCHITECTURE.md` — Complete frontend design proposal (10 pages wireframed, components, mobile strategy)

---

## FRONTEND BUILD STATUS

### Pages to Build (in priority order)

1. **Dashboard (`/unified`)** — Polish: add Top Funds preview, sector health bars, benchmark/period selectors
2. **Funds Rankings (`/unified/funds`)** — 6-factor heatmap table with color-coded cells
3. **Fund X-Ray (`/unified/funds/[id]`)** — Radar chart, holdings table, sector donut, cap tilt bar, narrative
4. **Sector Detail (`/unified/sectors/[name]`)** — 3 sub-tabs: Stocks / Mutual Funds / ETFs
5. **Global Pulse (`/unified/global`)** — World indices, US ETFs, commodities/FX
6. **Instrument Detail (`/unified/instrument/[id]`)** — Extend for MF/ETF/Index types

### Components to Build

- `FactorHeatmapCell` — Color-coded 0-100 percentile cells
- `RadarChart` — 6-factor radar for fund x-ray
- `HoldingsTable` — Top 20 holdings with child metrics
- `SectorDonut` — Sector allocation pie/donut
- `CapTiltBar` — Large/Mid/Small horizontal bar
- `Sparkline` — 30-90 day mini price chart
- `SubTabNav` — Stocks/MFs/ETFs tab switcher

### Design System

- Actions: green=accumulate, red=exit, orange=reduce, gray=hold
- States: LEADER(green), EMERGING(emerald), WEAKENING(orange), LAGGING(red), BASE_BUILDING(blue), BROKEN(red+strikethrough)
- Health: FEAR(<25 red), WEAK(25-40 orange), NEUTRAL(40-55 gray), HEALTHY(55-70 green), BULLISH(>70 dark green)
- Fonts: Serif for headlines (Newsreader/Georgia), sans for data

---

## USER'S EXPLICIT REQUIREMENTS

1. **No composite MF score** — 6 independent factor percentiles only
2. **Sector Detail — 3 Sub-Tabs:** Stocks / Mutual Funds / ETFs
3. **Global Pulse:** Completely separate from India view
4. **Stock is the atom:** All metrics computed for ALL instrument types
5. **Frontend quality:** Rigorous testing, API health checks, screenshots, navigation, E2E clicking

---

## KEY FILES

| File | Purpose |
|------|---------|
| `/home/ubuntu/atlas_kim/docs/DATA_ARCHITECTURE.md` | Complete data architecture docs |
| `/home/ubuntu/atlas_kim/docs/FRONTEND_ARCHITECTURE.md` | Frontend design proposal |
| `/home/ubuntu/atlas_kim/BUILD_PLAN_V2.md` | Full build plan with 9 phases |
| `/home/ubuntu/atlas_kim/BACKEND_AUDIT_AND_PLAN.md` | Backend audit document |

---

## RUNNING PROCESSES

| Service | Port | Command |
|---------|------|---------|
| Backend API | 8000 | `uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| Frontend | 3001 | `npm exec next start -p 3001` |

---

## NOTES FOR FUTURE SESSIONS

- **Always read this file first** before doing anything else
- **Backend is COMPLETE** — do not modify compute pipelines unless bugfixing
- **Frontend is IN PROGRESS** — follow `docs/FRONTEND_ARCHITECTURE.md`
- **Git sync is critical** — commit after every major milestone
- **Test rigorously** — API health checks, screenshots, navigation, E2E clicking
- **Do NOT delete** `/tmp/mstar_holdings_universe.json` until fully ingested
- **User's MF filter:** Regular + Equity + Growth only (no Direct, no IDCW)
