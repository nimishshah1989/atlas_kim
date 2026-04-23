# ATLAS-KIM Backend Build Plan V2

**Date:** 2026-04-23  
**Scope:** MF + ETF + Index + Global — Complete Backend  
**Validation:** Thorough (not just row counts)  
**Frontend:** ONLY after backend validation passes

---

## CONFIRMED DATA LANDSCAPE

### Source Tables (What Exists)
| Table | Rows | Coverage | Quality |
|-------|------|----------|---------|
| `de_mf_nav_daily` | 1.78M | 1,350 MFs, 2006-2026 | ✅ Excellent |
| `de_mf_technical_daily` | 1.40M | 685 MFs, full stack | ✅ Excellent |
| `de_etf_ohlcv` | 437K | 220 ETFs, 2016-2026 | ✅ Excellent |
| `de_etf_technical_daily` | 435K | 194 ETFs, full stack | ✅ Excellent |
| `de_index_prices` | 263K | 135 indices, 2014-2026 | ✅ Excellent |
| `de_index_technical_daily` | 262K | 135 indices, full stack | ✅ Excellent |
| `de_mf_holdings` | 230K | 838 MFs | ✅ 221K non-zero weights |
| `de_index_constituents` | 2,660 | 34 indices, 507 stocks | ⚠️ No weights |
| Morningstar API | 4,125 funds | Equity + ETFs | ✅ Validated, works |

### Broken in `unified_metrics`
| Field | Populated | Problem |
|-------|-----------|---------|
| RSI-14 | 0 rows | Technicals not propagated from source tables |
| EMA-20 | 176 rows | Only some equities, MFs/ETFs/Indices skipped |
| MACD | 0 rows | Not propagated |
| Narrative | 0 rows | Narrative engine not hooked up |
| MF metrics | 1 out of 985 | RS engine skipped MFs entirely |
| ETF metrics | 1,303 rows | Has RS but no technicals |
| Index metrics | 55 rows | Very thin |

**Root cause:** The pipeline computes RS ranks from prices but does NOT pull RSI/MACD/EMAs from the existing `de_*_technical_daily` tables. It also skips MFs for RS computation.

---

## BUILD PHASES

### PHASE 1: Morningstar Data Foundation

**1A. Fetch Fund Master (4,125 funds)**
- API: `https://api.morningstar.com/v2/service/mf/x6d9w6xxu0hmhrr4/universeid/q3zv6b817mp4fz0f?accesscode=ftijxp6pf11ezmizn19otbz18ghq2iu4`
- Parse XML → extract fields
- **Available fields:** MStarID, ISIN, AMFICode, FundName, FundStandardName, BroadCategoryGroup, AggregatedCategoryName, NetExpenseRatio, FundManagerTenureAverage, FundNetAssets, FundSizeComprehensiveMonthEnd, FundSizeComprehensiveMonthEndDate, InceptionDate
- **All 4,125 are BroadCategoryGroup=Equity** (includes both MFs and ETFs)
- Store raw in `morningstar_master_raw` table

**1B. Filter Final Universe**
- **MF Universe:** Regular + Equity + Growth plans only
  - Filter: `AggregatedCategoryName` contains "Equity" or "Index Funds" → exclude debt, hybrid, liquid
  - Filter: FundName contains "Reg" or "Regular" → exclude "Dir" / "Direct"
  - Filter: FundName contains "Gr" or "Growth" → exclude "IDCW" / "Dividend"
  - Target: ~400-500 MFs
- **ETF Universe:** All ETFs from Morningstar + existing `de_etf_master`
  - ETFs are identified by `HoldingType` in holdings API or by exchange listing
  - Target: ~60-80 Indian ETFs

**1C. Fetch Holdings for Universe**
- API: `https://api.morningstar.com/v2/service/mf/fq9mxhk7xeb20f3b/mstarid/{MStarID}?accesscode=ftijxp6pf11ezmizn19otbz18ghq2iu4&format=json`
- Per-fund call, returns JSON
- **Holding fields:** MorningstarID, HoldingType (E=Equity, etc.), Name, ISIN, Weighting, NumberOfShare, MarketValue, Sector, GlobalSector, Ticker, FirstBoughtDate
- Rate limit: 0.5s between requests
- Store in `unified_mf_holdings_detail` (extend schema for ETFs)

**1D. Map Holdings to Unified Instruments**
- Join by ISIN → `de_instrument.isin` → `unified_instruments`
- For unmapped holdings: store ISIN, name, sector but child_id=null
- Compute `dominant_sectors` (top 2-3 by weight) per fund/ETF

---

### PHASE 2: Fix Unified Metrics Pipeline

**2A. Propagate Technicals from Source Tables**
For each instrument type, on each date:
```sql
-- For MFs: pull from de_mf_technical_daily
-- For ETFs: pull from de_etf_technical_daily  
-- For Indices: pull from de_index_technical_daily
-- For Equities: pull from de_equity_technical_daily

UPDATE unified_metrics SET
  rsi_14 = source.rsi_14,
  macd = source.macd_line,
  macd_signal = source.macd_signal,
  ema_20 = source.ema_20,
  ema_50 = source.ema_50,
  ema_200 = source.ema_200,
  vol_21d = source.volatility_20d,
  max_dd_252d = source.max_drawdown_1y
FROM source_table
WHERE unified_metrics.instrument_id = ...
```

**2B. Compute Returns for ALL Instruments**
- Equities: from `de_equity_ohlcv` / `unified_equity_prices_adj`
- MFs: from `de_mf_nav_daily`
- ETFs: from `de_etf_ohlcv`
- Indices: from `de_index_prices`
- Global: from `de_global_price_daily`
- Periods: 1D, 1W, 1M, 3M, 6M, 12M, 24M, 36M

**2C. Compute RS Ranks for ALL Instruments**
- 5 benchmarks × 8 periods for EVERY instrument type
- Currently only Nifty 50 has all periods for equities
- Need to extend to MFs, ETFs, Indices, Global

**2D. Classify States & Actions for ALL**
- Apply same state machine to MFs, ETFs, Indices
- `LEADER` / `EMERGING` / `WEAKENING` / `LAGGING` / `BASE_BUILDING` / `BROKEN`

**2E. Compute Risk Metrics**
- Volatility, Max DD, Fragility for all types

**Target:** Every instrument in `unified_instruments` has a complete `unified_metrics` row.

---

### PHASE 3: Look-Through Compute (MF + ETF + Index)

**3A. MF Look-Through**
- Source: Morningstar holdings (Phase 1C)
- Weighted aggregates per fund:
  - `lookthrough_rs_3m`, `lookthrough_rs_12m`
  - `pct_holdings_leader`, `pct_holdings_emerging`, `pct_holdings_broken`
  - `top_sector`, `sector_herfindahl`, `num_holdings`, `top10_concentration`
  - `avg_holding_ret_3m`, `avg_holding_frag_score`
  - `cap_large_pct`, `cap_mid_pct`, `cap_small_pct`, `cap_tilt`
  - `dominant_sectors` (JSON array)
- Store: `unified_mf_lookthrough`

**3B. ETF Look-Through**
- Source: Morningstar holdings (Phase 1C)
- Same weighted aggregates as MFs
- Store: `unified_mf_lookthrough` (ETF rows, instrument_type='ETF')

**3C. Index Look-Through**
- Source: `de_index_constituents` (34 indices with constituents)
- **Weights:** All NULL. Use equal weight (1/N) as approximation.
- Compute same aggregates: weighted RS, leader %, sector concentration, cap tilt
- Store: `unified_mf_lookthrough` (Index rows, instrument_type='INDEX')

**3D. Sector Mapping for ALL**
- Populate `dominant_sectors` for MFs, ETFs, Indices
- This enables the **3 sub-tabs** on sector detail page

---

### PHASE 4: Six-Factor Objective Mapping (MF Only)

**No composite score. Independent percentiles within category.**

| Factor | Data Sources | Metrics |
|--------|-------------|---------|
| 1. Momentum | `unified_metrics` (NAV-based) + `de_mf_technical_daily` | NAV RS 3m/12m rank, above EMA-50/200 |
| 2. Risk-Adjusted Quality | `de_mf_technical_daily` | Sharpe 1y, Sortino 1y, Calmar 1y |
| 3. Resilience | `de_mf_technical_daily` | Max drawdown 1y (inverted), volatility |
| 4. Holdings Quality | `unified_mf_lookthrough` | lookthrough_rs_3m, leader %, concentration |
| 5. Cost Efficiency | Morningstar master | Expense ratio percentile (lower=better), AUM |
| 6. Consistency | `de_mf_technical_daily` | Rolling 12M positive return %, std dev |

**Storage:** `unified_mf_rankings`
- One row per (mf_id, date, category)
- 6 factor percentile columns
- Plus: lookthrough_rs, cap_tilt, aum_cr, expense_ratio, action

---

### PHASE 5: Narrative Engine (ALL Instrument Types)

**5A. Extend `unified_narrative.py`**
- **Equities:** Existing template (RS vs Nifty, trend, global context)
- **MFs:** Fund-specific prose (lookthrough summary, factor strengths, top sectors, cost note)
- **ETFs:** ETF-specific prose (tracking quality, sector concentration, expense ratio note)
- **Indices:** Index-specific prose (market posture, constituent health, breadth summary)
- **Global:** Global-specific prose (regime, currency, commodity context)

**5B. Populate `narrative` JSONB in `unified_metrics`**
- Target: Every row gets a narrative

---

### PHASE 6: Global Pulse Integration

**6A. Add Global Instruments**
- Source: `de_global_instrument_master` + `de_global_price_daily` tickers
- Add to `unified_instruments` (type=INDEX_GLOBAL or ETF)
- Top 11-12 world indices: ^SPX, ^NDQ, ^DAX, ^DJI, ^NKX, ^UKX, ^AXJO, ^CAC, ^SHBS, ^TNX, ^TYX
- Key global ETFs: SPY, QQQ, EEM, EFA, GLD, SLV, VTI, VOO, XLF, XLK, XLE

**6B. Compute Global Metrics**
- Returns from `de_global_price_daily`
- RS ranks vs MSCI World, S&P 500
- States & actions
- Store in `unified_metrics`

**6C. Global Regime/Breadth**
- Compute global health score from top indices
- Store in `unified_market_regime` with `region='GLOBAL'` or new table

---

### PHASE 7: API Layer

**New Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/unified/funds/rankings` | MF 6-factor heatmap data |
| `GET /api/unified/funds/{id}/xray` | Full fund evidence + holdings + factors |
| `GET /api/unified/funds/{id}/holdings` | Top 20 holdings with child metrics |
| `GET /api/unified/funds/categories` | Distinct categories with aggregates |
| `POST /api/unified/funds/screen` | Filter by factors, category, cap tilt |
| `GET /api/unified/global/regime` | Global market regime |
| `GET /api/unified/global/aggregate` | Country/region bubble chart data |

**Modified Endpoints:**
| Endpoint | Change |
|----------|--------|
| `GET /api/unified/snapshot/{id}` | Include lookthrough + holdings_summary + factor_percentiles for MFs/ETFs/Indices |
| `GET /api/unified/aggregate` | Support cohort_type=mf_category, cap_tilt, country, global_sector |
| `GET /api/unified/screen` | Support instrument_type filter + sector sub-tab filtering |

---

### PHASE 8: Pipeline Integration

**8A. Extend `unified_compute.py`**
```python
# Phase 1: Sync instruments (add global, add missing indices)
# Phase 2: Compute returns for ALL types
# Phase 3: Compute RS ranks for ALL types  
# Phase 4: Classify states & actions for ALL types
# Phase 5: Propagate technicals from source tables
# Phase 6: Compute market regime (India + Global)
# Phase 7: Compute sector breadth
# Phase 8: Compute MF look-through
# Phase 9: Compute ETF look-through
# Phase 10: Compute Index look-through
# Phase 11: Compute MF 6-factor rankings
# Phase 12: Generate narratives for ALL types
```

**8B. Schedule**
- APScheduler: 3:45 PM IST (after existing EOD jobs)
- Validation gates after each phase
- Abort + alert if any gate fails

---

### PHASE 9: Thorough Backend Validation

**Not just row counts. Real validation.**

**9A. Data Quality Checks**
- ✅ Every instrument in `unified_instruments` has ≥1 `unified_metrics` row
- ✅ `unified_metrics` has NO NULL for `rs_nifty_3m_rank` (primary RS)
- ✅ `unified_metrics` has RSI-14, MACD, EMA-20 populated for ≥95% of rows
- ✅ `unified_metrics` has narrative populated for ≥95% of rows
- ✅ `unified_mf_lookthrough` has rows for ALL MFs + ETFs with holdings
- ✅ `unified_mf_rankings` has rows for ALL MFs in final universe
- ✅ Holdings mapping rate ≥90% (ISIN maps to unified_instruments)

**9B. Cross-Validation**
- Pick 5 random MFs: manually verify lookthrough_rs_3m = SUM(weight × child.rs_3m)
- Pick 5 random ETFs: same verification
- Pick 5 random indices: verify constituent count matches known value (e.g., NIFTY 50 = 50)
- Verify 6-factor percentiles sum to reasonable values (not all 50)
- Verify RS ranks are 0-100 (no negatives, no >100)

**9C. API Validation**
- Call `/api/unified/snapshot/{mf_id}` → verify all fields present
- Call `/api/unified/funds/rankings` → verify 6 factors returned
- Call `/api/unified/aggregate?cohort_type=sector` → verify bubble data
- Call `/api/unified/global/regime` → verify global regime returned
- Verify response times < 500ms for cached queries

**9D. Edge Cases**
- Fund with 0 holdings → graceful empty state
- Fund with unmapped holdings → still compute lookthrough for mapped portion
- Index with no constituents → skip lookthrough
- Global instrument with thin history → RS = NULL (not 0)

**9E. Performance**
- Pipeline completes in < 30 minutes for single date
- Aggregate queries return in < 200ms
- Screener returns in < 500ms for limit=50

---

## AGENT DEPLOYMENT STRATEGY

Given the complexity, I recommend **parallel agent execution**:

### Agent A: Morningstar Ingestion
- **Task:** Fetch fund master + holdings for all 4,125 funds
- **Time:** ~4 hours (4,125 holdings calls at 0.5s = ~35 min + parsing + storage)
- **Output:** `morningstar_master_raw` table + populated `unified_mf_holdings_detail`
- **Dependencies:** None

### Agent B: Metrics Pipeline Fix
- **Task:** Fix `unified_metrics` for ALL instrument types
- **Time:** ~4 hours
- **Sub-tasks:**
  - Propagate technicals from source tables
  - Compute returns for MFs, ETFs, Indices, Global
  - Compute RS ranks for all types
  - Classify states & actions
  - Compute risk metrics
- **Dependencies:** None (uses existing source tables)

### Agent C: Look-Through + Factor Engine
- **Task:** Compute look-through for MF/ETF/Index + 6-factor rankings
- **Time:** ~4 hours
- **Dependencies:** Agent A (holdings data) + Agent B (metrics data)

### Agent D: Global + API + Narratives
- **Task:** Global pulse integration + API endpoints + narrative engine
- **Time:** ~4 hours
- **Dependencies:** Agent B (metrics for global) + Agent C (look-through data)

### Root Agent (Me): Orchestration + Validation
- **Task:** Monitor parallel agents, integrate outputs, run validation, fix issues
- **Time:** ~4 hours
- **Dependencies:** All agents

**Total wall-clock time: ~8-10 hours** (parallel execution)

---

## EXECUTION ORDER (What I'll Do Now)

Since I'm a single agent, I'll execute sequentially but optimize:

1. **Start with Agent B work first** (metrics fix) — it has no dependencies and takes longest
2. **While metrics compute runs, start Agent A** (Morningstar fetch) in background
3. **When both complete, run Agent C** (look-through + factors)
4. **Then Agent D** (global + APIs + narratives)
5. **Finally, validation** (thorough checks)

---

## QUESTIONS

1. **Morningstar filter confirmation:** Regular + Equity + Growth for MFs. Is "Index Funds" category included in MF universe? (I assume yes — index funds are equity exposure)
2. **Index weights:** You said don't worry about index weights. Confirm: use equal weight (1/N) for index look-through?
3. **Global scope:** All 50+ global tickers, or curated list of ~20? (I recommend curated: top indices + key ETFs)
4. **Shall I start now?** I'll begin with Phase 2 (metrics fix) + Phase 1A (Morningstar fund master fetch) in parallel.
