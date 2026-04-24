# ATLAS-KIM Agent Memory — Unified RS Intelligence Engine

**Last updated:** 2026-04-24 03:15 UTC  
**Session status:** FRONTEND BUILD PHASE 2 — POLISH & ENRICHMENT  
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

### Database State (2026-04-24)

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

### Latest Commit
- **Commit:** `1e8e844` — "feat(frontend): comprehensive UI polish across all unified pages"
- **Pushed to:** `github.com:nimishshah1989/atlas_kim` master branch
- **Deployed:** Live on `https://atlas.jslwealth.in/unified` (port 3001, rebuilt 2026-04-24 02:44)

### Pages Built (9 total)
1. **Dashboard (`/unified`)** — Built with regime gauge, breadth bars, bubble chart, sector health table, top movers, top funds preview
2. **Leaders (`/unified/leaders`)** — Leader stocks listing
3. **Weakening (`/unified/weakening`)** — Weakening stocks listing
4. **Global (`/unified/global`)** — Global indices, US ETFs, commodities/FX
5. **Sectors (`/unified/sectors`)** — Sector bubble chart, sector health table, recommendations
6. **Sector Detail (`/unified/sectors/[name]`)** — 3 sub-tabs: Stocks / Mutual Funds / ETFs
7. **Funds (`/unified/funds`)** — Fund rankings with sortable table
8. **Fund X-Ray (`/unified/funds/[id]`)** — Radar chart, holdings table, sector donut, cap tilt bar
9. **Instrument Detail (`/unified/instrument/[id]`)** — RS scorecard, evidence card, narrative

### MISSING ROUTES (identified 2026-04-24)
- `/unified/emerging` — Dashboard links to it but NO page exists
- `/unified/fragile` — Dashboard links to it but NO page exists

### Components Built
- `FactorHeatmapCell` — Color-coded 0-100 percentile cells
- `RadarChart` — 6-factor radar for fund x-ray
- `HoldingsTable` — Top 20 holdings with child metrics
- `SectorDonut` — Sector allocation pie/donut
- `CapTiltBar` — Large/Mid/Small horizontal bar
- `Sparkline` — 30-90 day mini price chart
- `SubTabNav` — Stocks/MFs/ETFs tab switcher
- `BenchmarkSelector` — NEW
- `IndexPulse` — NEW
- `PeriodSelector` — NEW
- `SortableTable` — NEW
- `TopETFs` — NEW
- `TopPicks` — NEW

### Design System
- Actions: green=accumulate, red=exit, orange=reduce, gray=hold
- States: LEADER(green), EMERGING(emerald), WEAKENING(orange), LAGGING(red), BASE_BUILDING(blue), BROKEN(red+strikethrough)
- Health: FEAR(<25 red), WEAK(25-40 orange), NEUTRAL(40-55 gray), HEALTHY(55-70 green), BULLISH(>70 dark green)
- Fonts: Serif for headlines (Newsreader/Georgia), sans for data
- **CRITICAL:** ALL_CAPS regime labels (CAUTION_DEFENSIVE, BULLISH_FULL_RISK) are BANNED. Use "Caution — Defensive", "Bullish (Full Risk)" etc.

---

## KNOWN BUGS & ISSUES (as of 2026-04-24)

### Critical (Fix in Phase 1)
| # | Issue | Location | Root Cause |
|---|-------|----------|------------|
| 1 | `/unified/emerging` returns 404 | Missing route | No `frontend/src/app/unified/emerging/page.tsx` |
| 2 | `/unified/fragile` returns 404 | Missing route | No `frontend/src/app/unified/fragile/page.tsx` |
| 3 | 5056% stocks above EMA-50 | `sectors/page.tsx:94` | `pct_above_ema_50` already 0-100, multiplied by 100 again |
| 4 | Empty numbers on instrument page | `instrument/[id]/page.tsx` | `MetricSnapshot` Pydantic schema only has 2 RS rank fields; DB has 40 |
| 5 | `% above 200 EMA` missing from banner | `page.tsx` | Backend `above_ema_200` column missing from DB model |
| 6 | ALL_CAPS regime labels shown | `sectors/page.tsx`, `page.tsx` | Backend stores `CAUTION_DEFENSIVE`; frontend renders raw |
| 7 | EMA-200 shows EMA-50 value | `instrument/[id]/page.tsx`, `EvidenceCard.tsx` | Code uses `above_ema_50` for EMA-200 label |

### High (Fix in Phases 2-3)
| # | Issue | Location |
|---|-------|----------|
| 8 | No inline explanations/tooltips anywhere | All pages |
| 9 | Bubble size too small, no labels | `BubbleChart.tsx` |
| 10 | Hover tooltip shows only raw RS number | `BubbleChart.tsx` |
| 11 | Table numbers not center/right-aligned properly | All tables |
| 12 | No sparklines in sector table or top cards | Dashboard |
| 13 | No sector tags on leader/weakening/fragile cards | Dashboard |
| 14 | Leaders/Weakening/Fragile cards have no subtext explanation | Dashboard |
| 15 | Top funds lacks quality filters (age >3Y, AUM cutoff) | Dashboard |
| 16 | Dashboard links to emerging/fragile but nav doesn't show them | `layout.tsx` |

### Medium (Fix in Phases 4-5)
| # | Issue | Location |
|---|-------|----------|
| 17 | No historical breadth charts anywhere | Dashboard |
| 18 | No advance-decline line | Dashboard |
| 19 | No temporal sector rotation view | Dashboard, Sectors |
| 20 | Benchmark switch shows weird behavior (S&P 500/MSCI median = 0) | Dashboard bubble chart |
| 21 | Sector health table RS ranks not 1-N within sectors | Dashboard |
| 22 | No state mix column in sector table | Dashboard |

### Enrichment (Phases 6-7)
| # | Issue | Location |
|---|-------|----------|
| 23 | Instrument page has zero charts — no price, no RS history, no drawdown | `instrument/[id]/page.tsx` |
| 24 | Narrative is a dense blob of text | `instrument/[id]/page.tsx`, `unified_narrative.py` |
| 25 | No sector heatmap/treemap | Dashboard |
| 26 | No state distribution visual | Dashboard |
| 27 | No cross-asset correlation | Global page |
| 28 | No world map for global regimes | Global page |

---

## MARKET PULSE ANALYSIS (Reference Screenshots)

User shared `interactive_screens.zip` from Market Pulse (Jhaveri Intelligence Platform). Key design patterns to emulate:

### What MP Does Well
1. **Breadth card grid** — 12 cards showing metric, %, raw count (196/531), micro-bar, sentiment badge
2. **Historical time-series** — Every breadth metric has a 3Y line chart below it
3. **Explanatory sentences** — Below each chart: "196 of 531 stocks (37%) pass... — Neutral territory. with improving breadth, up 105 stocks"
4. **Signal badges** — "Base", "Strong OW", "OW" as colored pills, never raw text
5. **Tooltip icons** — Every column header has an "i" icon for inline help
6. **Expandable table rows** — Click "+" to drill into constituents
7. **Regime banner** — "CORRECTION" prominently displayed with leading sectors scroll
8. **Clean color discipline** — Amber=caution, Green=healthy, Red=fear consistently

### What ATLAS Should Do Better Than MP
- **Temporal RRG trails** — Most tools don't animate RRG well; we have the data
- **Fund look-through RS** — Show underlying holdings' RS (unique to our data)
- **Cross-asset global view** — India + Global + Commodities + FX unified
- **Deterministic narrative with visual evidence** — Link every sentence to chart highlights

---

## USER'S EXPLICIT REQUIREMENTS

1. **No composite MF score** — 6 independent factor percentiles only
2. **Sector Detail — 3 Sub-Tabs:** Stocks / Mutual Funds / ETFs
3. **Global Pulse:** Completely separate from India view
4. **Stock is the atom:** All metrics computed for ALL instrument types
5. **Frontend quality:** Rigorous testing, API health checks, screenshots, navigation, E2E clicking
6. **No ALL_CAPS labels anywhere** — Proper case with natural language
7. **Inline explanations required** — Every term must be explainable in-context, not in a separate appendix
8. **Temporal visualizations** — Must show historical transitions, not just point-in-time
9. **Creative visuals** — Bubble charts with trails, sector heatmaps, small multiples, bullet graphs
10. **Fund quality filters** — Age >3 years, AUM above P50 of universe
11. **Sector tags everywhere** — On leader/weakening/fragile cards, in tables
12. **Four-cluster state column** — In sector table show Leader/Emerging/Weakening/Fragile counts

---

## 7-PHASE ENRICHMENT PLAN

### Phase 1: Critical Bug Fixes & Data Integrity
- Create `/unified/emerging` and `/unified/fragile` routes
- Fix 5056% bug (remove *100)
- Expand `MetricSnapshot` Pydantic schema to include all 40 RS rank fields
- Add `above_ema_200` to DB model + compute
- Fix EMA-200 frontend bug (use correct field)
- Humanize ALL_CAPS regime labels in frontend and backend narrative

### Phase 2: Inline Explanations, Tooltips & Terminology
- Build `InfoTooltip` component with "i" icon
- Add tooltip to every table header (RS Rank, Fragility, State, Action, etc.)
- Add contextual badges: "Bottom half" / "Top quartile" next to raw numbers
- Build `RegimeGuide` modal explaining all regimes and states
- Add subtext to Leaders/Weakening/Fragile cards explaining what they mean
- Add methodology links: "How is this calculated?"

### Phase 3: Bubble Chart, Tables & Formatting Polish
- Increase bubble size 2x, add persistent labels
- Enrich hover tooltip: RS Rank, 3M Return, % Above EMA-50, Avg Fragility, Consensus Action, Volume
- Add sparkline column to sector health table
- Fix number alignment (right-align numbers, center-align text)
- Add sector tags to top mover cards
- Add four-cluster state column to sector table
- Add quality filters to top funds (age >3Y, AUM > P50)
- Add sub-tabs to top movers (Stocks / ETFs / Funds)

### Phase 4: Dashboard Static Visuals
- Replace right-side breadth card with 2x2 mini cards (A/D ratio, 52W highs/lows, EMA-200 %, RS Dispersion)
- Add sector treemap/heatmap (boxes sized by market cap, colored by RS)
- Add state distribution stacked bar/donut
- Add top sector scroll strip (like MP: "Leading: METAL (+41%), PSU BANK (+35%)...")
- Add "Market Movie" small-multiples section

### Phase 5: Temporal Charts — Market & Sector
- Market breadth history line charts (1Y/2Y/3Y lookback)
- Advance-Decline cumulative line chart
- Regime history step/area chart with color zones
- Sector RRG with historical trails (6M dots at monthly intervals)
- Sector breadth history small multiples
- Fix benchmark switching (S&P 500/MSCI median RS rank showing 0)

### Phase 6: Instrument Page Charts & Visuals
- Price + EMA ribbon chart (1Y view) with regime-shaded background
- RS ratio history line chart vs benchmark
- Rolling returns grouped bar chart (stock vs sector vs benchmark)
- Drawdown history filled area chart
- Volume profile bar chart
- For MFs/ETFs: holdings treemap, factor exposure radar chart
- Restructure narrative into 3-4 Insight Cards with icons

### Phase 7: Advanced Visuals & Global
- Animated RRG with trails
- Cross-asset correlation matrix heatmap
- World map choropleth for global regimes
- Flow/Sankey diagram for sector rotation
- Currency/commodity returns matrix

---

## KEY FILES

| File | Purpose |
|------|---------|
| `/home/ubuntu/atlas_kim/docs/DATA_ARCHITECTURE.md` | Complete data architecture docs |
| `/home/ubuntu/atlas_kim/docs/FRONTEND_ARCHITECTURE.md` | Frontend design proposal |
| `/home/ubuntu/atlas_kim/BUILD_PLAN_V2.md` | Full build plan with 9 phases |
| `/home/ubuntu/atlas_kim/BACKEND_AUDIT_AND_PLAN.md` | Backend audit document |
| `/home/ubuntu/atlas_kim/frontend/REDESIGN_PLAN.md` | Frontend redesign notes |

---

## RUNNING PROCESSES

| Service | Port | Command |
|---------|------|---------|
| Backend API | 8000 | `uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| Frontend | 3001 | `npm exec next start -p 3001` |
| Nginx | 443 | Reverse proxy: `/unified` → 3001, default → 3000 |

---

## NOTES FOR FUTURE SESSIONS

- **Always read this file first** before doing anything else
- **Backend is COMPLETE** — do not modify compute pipelines unless bugfixing
- **Frontend is IN PHASE 2 ENRICHMENT** — follow the 7-phase plan above
- **Git sync is critical** — commit after every major milestone
- **Test rigorously** — API health checks, screenshots, navigation, E2E clicking
- **Update this file every 30 mins or after every major discussion**
- **Do NOT delete** `/tmp/mstar_holdings_universe.json` until fully ingested
- **User's MF filter:** Regular + Equity + Growth only (no Direct, no IDCW)
- **User is frustrated by repeated explanations** — read memory thoroughly, don't ask what was already decided
- **Market Pulse is the design reference** — `interactive_screens.zip` analyzed, key patterns documented above
- **ALL_CAPS labels are banned** — always use proper case natural language
- **Inline explanations are mandatory** — no separate appendix-only glossary
