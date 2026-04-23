# ATLAS-KIM Backend Audit & MF Build Plan

**Date:** 2026-04-23  
**Auditor:** Kimi Code Agent  
**Scope:** Complete backend audit + MF module build plan

---

## PART 1: CURRENT BACKEND STATE

### 1.1 Unified Schema (What Exists)

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `unified_instruments` | 3,500 | ✅ Populated | EQUITY(2281), ETF(220), MF(985), INDEX(11), INDEX_GLOBAL(3) |
| `unified_metrics` | 2,443/day | ⚠️ Partial | Only 1 MF has metrics! RSI-14=0 rows. EMA-20=176 rows. Narrative=0. |
| `unified_market_regime` | ~5 | ✅ Populated | Daily regime computed |
| `unified_sector_breadth` | Unknown | ⚠️ Check | Schema exists |
| `unified_mf_lookthrough` | 6 | 🔴 EMPTY | Schema exists, no data |
| `unified_mf_rankings` | 0 | 🔴 EMPTY | Schema exists, no data |
| `unified_mf_holdings_detail` | 633 | 🔴 Nearly Empty | Schema exists, minimal data |
| `unified_pipeline_log` | Unknown | ⚠️ Check | Schema exists |

### 1.2 Source Data (What We Have to Work With)

#### Equities
| Source | Rows | Date Range | Quality |
|--------|------|------------|---------|
| `de_equity_ohlcv` | 4,027,828 | 2007-01-01 to 2026-04-23 | ✅ Excellent |
| `unified_equity_prices_adj` | 4,027,828 | 2007-01-01 to 2026-04-23 | ✅ Adjusted prices ready |
| `de_equity_technical_daily` | Unknown | 2026-04-22 | ✅ Clean |

#### Mutual Funds
| Source | Rows | Date Range | Quality |
|--------|------|------------|---------|
| `de_mf_nav_daily` | 1,783,164 | 2006-04-01 to 2026-04-20 | ✅ Excellent |
| `de_mf_technical_daily` | 1,404,704 | Up to 2026-04-13 | ✅ **Extremely rich** — RSI-7/9/14/21, MACD, EMAs, SMAs, Bollinger, volatility, Sharpe 1y/3y/5y, Sortino 1y/3y/5y, Calmar 1y/3y/5y, Max DD 1y/3y/5y, beta Nifty, information ratio, Treynor, downside risk |
| `de_mf_holdings` | 230,254 | Up to 2026-02-28 | ✅ 221,652 non-zero weights, 838 MFs covered |
| `de_mf_master` | ~1,500 | Current | ✅ Has mstar_id, ISIN, AMC, category, benchmark, expense_ratio |

#### Indices
| Source | Rows | Date Range | Quality |
|--------|------|------------|---------|
| `de_index_master` | 135 | Current | ✅ All Nifty indices |
| `de_index_prices` | 263,902 | 2014-06-02 to 2026-04-23 | ✅ Excellent |
| `de_index_constituents` | 2,660 | Current | ✅ 34 indices have constituents (NIFTY 50, NIFTY BANK, NIFTY IT, etc.) |

#### Global / ETFs
| Source | Rows | Date Range | Quality |
|--------|------|------------|---------|
| `de_global_price_daily` | 261,396 | 2010-01-03 to 2026-04-23 | ✅ Excellent — indices, ETFs, commodities, FX, crypto |
| `de_etf_master` | 258 | Current | ✅ US + Indian ETFs with sector, country, benchmark |
| `de_global_instrument_master` | 162 | Current | ⚠️ Sparse metadata (many nulls) |

### 1.3 Critical Gaps Discovered

#### Gap A: MF Metrics in `unified_metrics`
- **Only 1 MF** out of 985 has metrics computed
- **RSI-14**: 0 rows populated across ALL instrument types
- **EMA-20**: Only 176 rows populated
- **Narrative**: 0 rows populated
- **Implication:** The RS engine has NOT been run on MFs. We need to compute returns, RS ranks, states, actions for all 985 MFs.

#### Gap B: MF Holdings Mapping
- `de_mf_holdings` uses `mstar_id` format `F000000...` and `F00001...`
- `unified_instruments` MF IDs match `de_mf_master.mstar_id` perfectly (985/985)
- `de_mf_holdings` has both formats — **mapping is possible**
- `de_mf_holdings.instrument_id` (UUID) maps to `de_instrument.id` for stocks
- **Weight_pct**: 221,652 non-zero out of 230,254 — usable

#### Gap C: Missing Indices in `unified_instruments`
- 124 out of 135 `de_index_master` indices are **NOT** in `unified_instruments`
- Only 11 INDEX type + 3 INDEX_GLOBAL = 14 total
- **Need to add 121 missing indices**

#### Gap D: No MF Look-Through Data
- `unified_mf_lookthrough`: 6 rows (test data?)
- `unified_mf_rankings`: 0 rows
- `unified_mf_holdings_detail`: 633 rows (test data?)
- **Need to build full pipeline**

#### Gap E: Morningstar API Data
- `docs/mf-master-plan.md` documents API credentials but **no script exists yet**
- `backend/scripts/` directory does not exist
- Need to build `fetch_morningstar_holdings.py`

#### Gap F: Sector Mapping
- `de_sector_mapping` exists — maps JIP sectors to Nifty indices
- But `unified_instruments.sector` is null for many ETFs and all indices
- Need to populate sector mapping for ETFs and indices

---

## PART 2: MF BACKEND BUILD PLAN

### Philosophy
- **No composite score** — 6 independent factor percentiles
- **Stock is the atom** — All MF intelligence derives from holdings + NAV
- **SQL-first** — Heavy math in PostgreSQL, Python for orchestration
- **Idempotent** — Safe to rerun for same date

### Phase 1: Foundation (Data Mapping & Validation)

**1A. MF Identity Mapping**
- Populate `unified_instruments.source_instrument_id` = `de_mf_master.mstar_id` for all 985 MFs
- Build crosswalk: `de_mf_holdings.mstar_id` → `unified_instruments.instrument_id`
- Verify: Can we join holdings to stocks via `de_mf_holdings.instrument_id` → `de_instrument.id` → `unified_instruments.instrument_id`?

**1B. Index Ingestion**
- Add 124 missing Nifty indices to `unified_instruments` (type=INDEX)
- Add global indices (^SPX, ^NDQ, ^DAX, etc.) to `unified_instruments` (type=INDEX_GLOBAL)
- Populate `sector` for ETFs using `de_etf_master.sector`

**1C. Sector Mapping for Instruments**
- Use `de_sector_mapping` to populate `unified_instruments.sector` for ETFs and indices
- For MFs: Compute `dominant_sectors` (top 2-3 by weight) from holdings

### Phase 2: MF NAV-Based Metrics Compute

**2A. Returns from NAV**
```sql
-- Compute 1D, 1W, 1M, 3M, 6M, 12M, 24M, 36M returns from de_mf_nav_daily
-- Using LAG() window functions per mstar_id
```

**2B. EMAs & Trend from NAV**
```sql
-- Compute EMA-20, EMA-50, EMA-200 from NAV
-- Above/below flags
-- Golden cross detection
```

**2C. RS Rank Compute for MFs**
```sql
-- For each benchmark × period:
-- 1. Get benchmark returns (Nifty 50, Nifty 500, MSCI, S&P 500, Gold)
-- 2. Compute excess return = MF return - benchmark return
-- 3. PERCENT_RANK() within date → rs_rank
-- Store in unified_metrics: rs_nifty_3m_rank, rs_nifty500_3m_rank, etc.
```

**2D. State & Action Classification for MFs**
```sql
-- Same logic as equities:
-- LEADER: rs_3m > 70 AND above_ema_50 AND persistence > 0.6
-- EMERGING: rs_3m > 50 AND momentum > 2
-- etc.
```

**2E. Risk Metrics from NAV**
```sql
-- Volatility (21D, 63D)
-- Max drawdown (252D)
-- Current drawdown
-- Fragility score
```

**2F. Populate `unified_metrics` for ALL MFs**
- Currently: 1 MF has metrics
- Target: All 985 MFs with complete metrics
- Also backfill: Populate RSI-14, EMA-20 for equities/ETFs/indices

### Phase 3: MF Look-Through Compute

**3A. Holdings Enrichment**
- Source: `de_mf_holdings` (existing) + Morningstar API (new)
- Join each holding to `unified_instruments` by ISIN/symbol
- Get child metrics from `unified_metrics`

**3B. Fund-Level Aggregates**
Store in `unified_mf_lookthrough`:
| Field | Calculation |
|-------|-------------|
| `lookthrough_rs_3m` | SUM(weight_pct × child.rs_nifty_3m_rank) |
| `lookthrough_rs_12m` | SUM(weight_pct × child.rs_nifty_12m_rank) |
| `pct_holdings_leader` | SUM(weight_pct) WHERE child.state = 'LEADER' |
| `pct_holdings_emerging` | SUM(weight_pct) WHERE child.state = 'EMERGING' |
| `pct_holdings_broken` | SUM(weight_pct) WHERE child.state = 'BROKEN' |
| `top_sector` | Top sector by SUM(weight_pct) |
| `sector_herfindahl` | SUM(sector_weight²) |
| `num_holdings` | COUNT(DISTINCT child_id) |
| `top10_concentration` | SUM(weight_pct) of top 10 holdings |
| `avg_holding_ret_3m` | SUM(weight_pct × child.ret_3m) |
| `avg_holding_frag_score` | SUM(weight_pct × child.frag_score) |
| `cap_large_pct` | SUM(weight_pct) WHERE child.cap_category = 'LARGE' |
| `cap_mid_pct` | SUM(weight_pct) WHERE child.cap_category = 'MID' |
| `cap_small_pct` | SUM(weight_pct) WHERE child.cap_category = 'SMALL' |
| `cap_tilt` | Dominant cap category |
| `dominant_sectors` | JSON array of top 2-3 sectors by weight |

**3C. Populate `unified_mf_holdings_detail`**
- One row per (mf_id, date, child_id)
- Fields: weight_pct, child_name, child_rs_3m, child_state, child_action, sector

### Phase 4: Six-Factor Objective Mapping Engine

**No composite score. Each factor is independently calculated and percentile-ranked within category.**

| Factor | Data Source | Metrics |
|--------|------------|---------|
| **1. Momentum** | `unified_metrics` + `de_mf_technical_daily` | NAV RS 3m rank, NAV RS 12m rank, above EMA-50/200, trend slope |
| **2. Risk-Adjusted Quality** | `de_mf_technical_daily` | Sharpe 1y, Sortino 1y, Calmar 1y, information ratio |
| **3. Resilience** | `de_mf_technical_daily` | Max drawdown 1y (inverted), recovery time, downside capture |
| **4. Holdings Quality** | `unified_mf_lookthrough` | lookthrough_rs_3m, pct_holdings_leader, sector_herfindahl, top10_concentration |
| **5. Cost Efficiency** | `de_mf_master` | Expense ratio percentile (lower=better), AUM > 500cr, tracking error |
| **6. Consistency** | `de_mf_technical_daily` | % rolling 12M periods beating category, std dev of monthly returns |

**Storage:** `unified_mf_rankings`
- One row per (mf_id, date, category)
- Fields: `factor_momentum_pct`, `factor_quality_pct`, `factor_resilience_pct`, `factor_holdings_pct`, `factor_cost_pct`, `factor_consistency_pct`
- Plus: `lookthrough_rs_3m`, `cap_tilt`, `aum_cr`, `expense_ratio`, `action`

### Phase 5: Narrative Generation for MFs

Extend `unified_narrative.py` to generate MF-specific narratives:
- **Verdict**: Based on look-through RS + NAV trend + category rank
- **Confirming Factors**: Which of the 6 factors are strong?
- **Risk Factors**: High concentration? High expense? Poor trend?
- **Holdings Snapshot**: "Top 3 sectors: IT (32%), Banking (18%), Pharma (12%). 45% of holdings are LEADERs."
- **Recommended Action**: ACCUMULATE / HOLD / REDUCE

### Phase 6: API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/unified/funds/rankings` | All funds with 6 factor percentiles + lookthrough. Query params: category, cap_tilt, min_aum |
| `GET /api/unified/funds/{id}/xray` | Full fund snapshot + holdings table + sector breakdown + factor radar data |
| `GET /api/unified/funds/{id}/holdings` | Top 20 holdings with child metrics |
| `GET /api/unified/funds/categories` | Distinct categories with aggregate stats |
| `POST /api/unified/funds/screen` | Filter by factor percentiles, category, cap tilt, lookthrough_rs |
| `GET /api/unified/snapshot/{id}` | **MODIFY**: If MF, include lookthrough_rs, holdings_summary, factor_percentiles |
| `GET /api/unified/aggregate` | **MODIFY**: Support cohort_type=mf_category, cohort_type=cap_tilt |

### Phase 7: Pipeline Integration

Add to `unified_compute.py`:
```python
# Phase 7: MF Look-Through
compute_mf_lookthrough_for_date(db, target_date)

# Phase 8: MF Rankings  
compute_mf_rankings_for_date(db, target_date)

# Phase 9: MF Narratives
generate_mf_narratives(db, target_date)
```

Schedule: Same 3:45 PM IST APScheduler job.

---

## PART 3: MORNINGSTAR API

### API Details (from `docs/mf-master-plan.md`)

**Holdings API:**
```
GET https://api.morningstar.com/v2/service/mf/{serviceId}/mstarid/{MorningstarID}?accesscode={accesscode}&format=json
```
- Service ID: `fq9mxhk7xeb20f3b`
- Access Code: `ftijxp6pf11ezmizn19otbz18ghq2iu4`
- IdType: `mstarid`

**Static Data API:**
```
GET https://api.morningstar.com/v2/service/mf/x6d9w6xxu0hmhrr4/universeid/{universeId}?accesscode={accesscode}
```
- Universe ID: `q3zv6b817mp4fz0f`
- Returns: AUM, expense ratio, benchmark, fund manager, launch date, category

**⚠️ Need to verify:** Are these the exact APIs you provided? Should I test them now?

---

## PART 4: INDEX & ETF BACKEND (Also Required)

### Indices
- Add 124 missing Nifty indices to `unified_instruments`
- Compute `unified_metrics` for all indices (using `de_index_prices`)
- Compute RS ranks for indices vs benchmarks
- For indices WITH constituents: compute look-through metrics (weighted constituents)

### ETFs
- `unified_metrics` for ETFs: Already 1,303 rows computed, but may need RSI/EMA fixes
- For Indian ETFs with stock holdings: compute look-through
- For global ETFs: use `de_global_price_daily`
- Populate `sector` and `country` from `de_etf_master`

### Sector Detail Page — 3 Sub-Tabs
**Backend requirement:**
- Screener must support `instrument_type` + `sector` combined filter
- For MFs: Filter where sector is in `dominant_sectors` JSONB array
- For ETFs: Filter where `sector = [name]`
- For Stocks: Filter where `sector = [name]` (already works)
- Each sub-tab returns bubble chart data + table data

---

## PART 5: GLOBAL PULSE PAGE

### Data Available
- `de_global_price_daily`: 261K rows, 2010-2026
- Tickers: ^SPX, ^NDQ, ^DAX, ^DJI, ^NKX, ^UKX, ^AXJO, ^CAC, ^SHBS, ^TNX, ^TYX
- ETFs: SPY, QQQ, EEM, EFA, GLD, SLV, XLF, XLK, XLE, etc.
- Commodities: GC=F, BZ=F, CL=F, USO, UNG
- FX: DX-Y.NYB, AUDUSD=X, EURUSD=X

### What's Missing
- Global indices NOT in `unified_instruments` (need to add ^SPX, ^NDQ, ^DAX, etc.)
- `unified_metrics` for global instruments: Only 3 INDEX_GLOBAL have metrics
- Need to compute RS ranks for global indices vs MSCI World, S&P 500

### Backend Work
1. Add global indices to `unified_instruments` (type=INDEX_GLOBAL)
2. Compute `unified_metrics` for all global indices + global ETFs
3. Extend `/aggregate` to support `cohort_type=country` and `cohort_type=global_sector`
4. New endpoint or modify existing for global regime/breadth

---

## PART 6: IMMEDIATE BLOCKERS

1. **Morningstar API validation** — Need to test if the documented APIs work with your credentials
2. **MF mstar_id mapping** — `de_mf_holdings` has both `F000000...` and `F00001...` formats. Need to verify crosswalk.
3. **RSI/EMA gaps in unified_metrics** — Why are RSI-14=0 and EMA-20=176? Is the equity technical pipeline incomplete?
4. **Narrative gaps** — 0 narratives populated. Is the narrative engine not hooked up?
5. **Only 1 MF has metrics** — The RS engine skipped MFs entirely. Need to investigate why.

---

## PART 7: RECOMMENDED EXECUTION ORDER

| Step | Task | Est Time | Dependencies |
|------|------|----------|--------------|
| 1 | Validate Morningstar API + test fetch | 30 min | Your confirmation |
| 2 | Fix `unified_metrics` for MFs (compute returns, RS, states from NAV) | 4 hrs | None |
| 3 | Fix RSI/EMA/narrative gaps for ALL instrument types | 2 hrs | None |
| 4 | Add 124 missing indices + global indices to `unified_instruments` | 1 hr | None |
| 5 | Build Morningstar fetch script + populate `unified_mf_holdings_detail` | 3 hrs | Step 1 |
| 6 | Build look-through compute pipeline | 4 hrs | Steps 2, 5 |
| 7 | Build 6-factor ranking engine | 4 hrs | Steps 2, 6 |
| 8 | Build MF narrative engine | 2 hrs | Steps 6, 7 |
| 9 | Build MF API endpoints (rankings, xray, holdings, screen) | 3 hrs | Steps 6, 7, 8 |
| 10 | Extend `/snapshot/{id}` and `/aggregate` for MFs | 1 hr | Step 9 |
| 11 | Add global indices/ETFs to `unified_metrics` | 2 hrs | Step 4 |
| 12 | Pipeline integration + backfill | 2 hrs | All above |
| 13 | Tests + validation | 2 hrs | All above |

**Total: ~30 hours of agent work**

---

## QUESTIONS FOR YOU

1. **Morningstar API** — Are the credentials in `docs/mf-master-plan.md` correct? Should I test them now?
2. **MF sector mapping** — For the 3 sub-tabs on sector detail, should MFs appear if the sector is in their top 2 dominant sectors, or top 3?
3. **Global data** — Do you want me to add ALL global indices/ETFs (~50+ tickers) or only a curated list (~15-20)?
4. **Index constituents** — Should indices with constituents (34 indices) also get look-through metrics like MFs?
5. **Should I start now?** — Which phase do you want me to begin with?
