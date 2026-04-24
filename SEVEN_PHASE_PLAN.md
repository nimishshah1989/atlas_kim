# ATLAS 7-Phase Enrichment Plan

**Created:** 2026-04-24  
**Goal:** Fix all known bugs and enrich every page to world-class standard

---

## Phase 1: Critical Bug Fixes & Data Integrity
**Owner:** Agents 1A + 1B (parallel)  
**Success Criteria:** All 7 critical bugs fixed, build passes, screenshots verify fixes

### 1A — Backend Data Fixes
- [ ] Expand `MetricSnapshot` Pydantic schema (`backend/models/unified_schemas.py`) to include all 40 RS rank fields (5 benchmarks × 8 periods)
- [ ] Add `above_ema_200` to `UnifiedMetrics` SQLAlchemy model (`backend/db/unified_models.py`)
- [ ] Create alembic migration adding `above_ema_200` column to `unified_metrics`
- [ ] Update `unified_compute.py` to compute `above_ema_200` (price > ema_200 boolean)
- [ ] Update `unified_narrative.py` to output humanized regime labels ("Caution — Defensive" not "CAUTION_DEFENSIVE")
- [ ] Re-run compute for latest date to populate `above_ema_200`

### 1B — Frontend Route & Display Fixes
- [ ] Create `/unified/emerging/page.tsx` — copy structure from `/unified/leaders` but filter for EMERGING state
- [ ] Create `/unified/fragile/page.tsx` — copy structure from `/unified/weakening` but filter for high fragility + lagging/broken
- [ ] Fix `sectors/page.tsx` line 94: remove `* 100` from `pctFmt`
- [ ] Fix `instrument/[id]/page.tsx` and `EvidenceCard.tsx`: use `above_ema_200` instead of `above_ema_50` for EMA-200 row
- [ ] Humanize ALL_CAPS regime labels in `page.tsx` CompactRegimeGauge and `sectors/page.tsx` regime banner
- [ ] Add `emerging` and `fragile` to layout navigation (`layout.tsx` NAV_ITEMS)

---

## Phase 2: Inline Explanations, Tooltips & Terminology
**Owner:** Agent 2  
**Success Criteria:** Every table header has tooltip, every card has subtext, regime guide works

- [ ] Build reusable `InfoTooltip` component ("i" icon, hover popover with title + description)
- [ ] Add tooltip to ALL table headers: RS Rank, Fragility, State, Action, Action Confidence, Above EMA-50, RSI-14, etc.
- [ ] Build `RegimeGuide` modal component (triggered from nav or footer)
- [ ] Add contextual interpretation badges next to raw numbers (e.g., RS 44.5 → "Bottom half" badge)
- [ ] Add subtext to Dashboard state cards: "Top 5 stocks by 3M RS vs Nifty 50 — strongest momentum"
- [ ] Add subtext to Weakening card: "Stocks losing relative strength vs benchmark — consider reducing"
- [ ] Add subtext to Fragile card: "High downside risk — elevated drawdown or breaking support"
- [ ] Add subtext to Emerging card: "Stocks improving RS trajectory — early accumulation candidates"
- [ ] Add "How is this calculated?" link on every major section

---

## Phase 3: Bubble Chart, Tables & Formatting Polish
**Owner:** Agent 3  
**Success Criteria:** Bubbles are large and labeled, hover is rich, tables are polished

- [ ] BubbleChart: increase size scaling from max 300 to max 500, min from 30 to 60
- [ ] BubbleChart: add persistent text labels on bubbles (sector name, abbreviated if needed)
- [ ] BubbleChart: enrich hover tooltip to show: Sector, RS Rank, 3M Return, % Above EMA-50, Avg Fragility, Consensus Action, Member Count
- [ ] Add sparkline column to SectorHealthTable (30-day mini trend using `Sparkline` component)
- [ ] Fix ALL table number alignment: numbers right-aligned, text left-aligned, badges centered
- [ ] Add sector tag/badge to every instrument card in top movers (Leaders/Weakening/Fragile)
- [ ] Add four-cluster column to sector table: mini 4-block colored bar showing % Leader/Emerging/Weakening/Fragile within sector
- [ ] Add quality filters to Top Funds: min age 3Y toggle, min AUM P50 toggle
- [ ] Add sub-tabs to Top Movers card: Stocks | ETFs | Funds
- [ ] Fix benchmark switching bug: debug why S&P 500/MSCI show median RS rank ≈ 0

---

## Phase 4: Dashboard Static Visuals
**Owner:** Agent 4  
**Success Criteria:** Dashboard has rich cards, treemap, state distribution, sector strip

- [ ] Replace right-side Market Breadth card with 2×2 mini card grid:
  - Advance/Decline Ratio (with 20D trend arrow ↑↓)
  - New 52W Highs vs Lows (with sparkline)
  - % Above EMA-200 (with sentiment badge: Bullish/Neutral/Bearish)
  - RS Dispersion (with interpretation text)
- [ ] Add Sector Treemap/Heatmap section: boxes sized by market cap, colored by RS rank, clickable
- [ ] Add State Distribution visual: stacked horizontal bar showing % of all 4,257 instruments in each state
- [ ] Add Top Sector Scroll Strip: "Leading: METAL (+41%), PSU BANK (+35%), ..." horizontal scroll
- [ ] Add "Market at a Glance" summary sentence combining regime + breadth + top sector

---

## Phase 5: Temporal Charts — Market & Sector
**Owner:** Agent 5  
**Success Criteria:** Historical charts render, RRG trails visible, benchmark switching works

- [ ] Build `BreadthHistoryChart` component: line chart showing % above EMA-20/50/200 over 1Y/2Y/3Y
- [ ] Build `AdvanceDeclineChart` component: cumulative A-D line for Nifty 500
- [ ] Build `RegimeHistoryChart` component: filled area chart of health score with regime zone colors
- [ ] Build `SectorRRGTrail` component: scatter plot with trailing dots (monthly) for each sector
- [ ] Build `SectorBreadthHistory` small multiples: grid of mini line charts per sector
- [ ] Add lookback period tabs (1M, 3M, 6M, 1Y, 2Y, 3Y) to breadth section
- [ ] Fix benchmark switching: ensure `rs_sp500_3m_rank` and `rs_msci_3m_rank` have valid data in DB

---

## Phase 6: Instrument Page Charts & Visuals
**Owner:** Agent 6  
**Success Criteria:** Instrument page has 4+ charts, narrative is card-based, MF/ETF views are rich

- [ ] Build `PriceEMARibbon` component: price line + EMA-20/50/200 as filled bands, regime-shaded background
- [ ] Build `RSRatioChart` component: RS vs benchmark over 1Y/3Y/5Y with 1.0 reference line
- [ ] Build `RollingReturnsChart` component: grouped bars of 1M/3M/6M/1Y/2Y/3Y returns (stock vs sector vs benchmark)
- [ ] Build `DrawdownChart` component: filled area showing drawdown depth over 3Y
- [ ] Build `VolumeProfile` component: volume bars with 20D MA line
- [ ] Restructure narrative: replace text blob with 3-4 `InsightCard` components (Trend, RS, Momentum, Fragility)
- [ ] For MFs/ETFs: add `HoldingsTreemap` (sector allocation) and `FactorRadar` (6-factor exposure)
- [ ] Remove duplicate narrative sections (drop-downs showing same text)

---

## Phase 7: Advanced Visuals & Global
**Owner:** Agent 7  
**Success Criteria:** Advanced visuals render, global page is enriched

- [ ] Build `CorrelationMatrix` component: heatmap of correlations between asset classes
- [ ] Build `WorldRegimeMap` component: choropleth map colored by regime
- [ ] Build `RotationFlow` component: Sankey/flow showing stocks transitioning between states
- [ ] Add `CurrencyCommodityMatrix` to global page: returns heatmap for FX and commodities
- [ ] Add small-multiples RRG grid to dashboard
- [ ] Polish all pages for mobile responsiveness
- [ ] Final end-to-end test: click every link, verify every chart, screenshot every page

---

## Quality Gates (Every Phase)

1. **TypeScript:** `npm run build` passes with zero errors
2. **Backend:** `pytest` passes (run existing tests)
3. **Visual QA:** Screenshot each changed page, verify against criteria
4. **API Health:** `curl` test every modified endpoint
5. **Navigation:** Click every link, verify no 404s
6. **Commit:** `git add -A && git commit` with descriptive message
