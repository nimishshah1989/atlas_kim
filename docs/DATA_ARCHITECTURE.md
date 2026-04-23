# ATLAS-KIM Data Architecture

> **Version:** 2026-04-23  
> **Scope:** Complete backend data layer — sources, tables, flows, daily operations  
> **Prerequisite:** Read `AGENT_MEMORY.md` and `BUILD_PLAN_V2.md` for execution context

---

## 1. OVERVIEW

ATLAS-KIM sits **on top of the existing JIP PostgreSQL RDS**. It does not replace JIP. It reads JIP's raw tables, enriches them with computed analytics, and serves a unified API + Next.js frontend.

**Two data layers:**

| Layer | Tables | Ownership | Update Frequency |
|-------|--------|-----------|------------------|
| **JIP Data Core** | `de_*` tables | JIP pipeline (external) | Daily EOD |
| **ATLAS-KIM Compute** | `unified_*` tables | ATLAS compute agents | Daily after JIP |

---

## 2. JIP DATA CORE — SOURCE TABLES

These tables are owned by the JIP (Just-In-Price) data pipeline. ATLAS-KIM reads from them but never writes.

### 2.1 Equities

| Table | Rows | Coverage | What ATLAS Reads |
|-------|------|----------|------------------|
| `de_equity_ohlcv` | 4.0M | 2007-2026, ~2000 stocks | OHLCV for returns, EMAs, RS ranks |
| `de_equity_technical_daily` | 3.8M | 2000+ stocks | RSI-14, MACD, EMAs, volatility, Sharpe, drawdown |
| `de_equity_fundamentals` | ~2000 | Latest quarter | P/E, ROE, debt (future use) |
| `de_instrument` | ~3500 | Master registry | ISIN, symbol, name, sector, industry |

### 2.2 Mutual Funds

| Table | Rows | Coverage | What ATLAS Reads |
|-------|------|----------|------------------|
| `de_mf_nav_daily` | 1.78M | 1,350 MFs, 2006-2026 | NAV for returns, price history |
| `de_mf_technical_daily` | 1.40M | 685 MFs | RSI-14, MACD, EMAs, Sharpe, Sortino, Calmar, max DD, beta, Treynor |
| `de_mf_holdings` | 230K | 838 MFs | Holdings weights (JIP source, not Morningstar) |
| `de_mf_master` | ~1,500 | Current | mstar_id, ISIN, AMC, category, benchmark, expense_ratio |

### 2.3 ETFs

| Table | Rows | Coverage | What ATLAS Reads |
|-------|------|----------|------------------|
| `de_etf_ohlcv` | 437K | 220 tickers, 2016-2026 | Prices for returns, EMAs, RS ranks |
| `de_etf_technical_daily` | 435K | 194 tickers | Full technical stack (same as MFs) |
| `de_etf_master` | 258 | US + Indian ETFs | Sector, country, benchmark metadata |

### 2.4 Indices

| Table | Rows | Coverage | What ATLAS Reads |
|-------|------|----------|------------------|
| `de_index_prices` | 263K | 135 indices, 2014-2026 | Prices for returns, RS ranks |
| `de_index_technical_daily` | 262K | 135 indices | Full technical stack |
| `de_index_constituents` | 2,660 | 34 indices, 507 stocks | Constituent mapping (weights are NULL) |
| `de_index_master` | 135 | All Nifty indices | Index metadata |

### 2.5 Global

| Table | Rows | Coverage | What ATLAS Reads |
|-------|------|----------|------------------|
| `de_global_price_daily` | 261K | 2010-2026 | Prices for global indices, ETFs, commodities, FX, crypto |
| `de_global_instrument_master` | 162 | Current | Sparse metadata for global tickers |
| `de_global_prices` | 261K | Backup global price source | Used for S&P 500, MSCI World, Gold benchmarks |

### 2.6 Sector Mapping

| Table | Purpose |
|-------|---------|
| `de_sector_mapping` | Maps JIP sectors → Nifty indices (Automobile→NIFTY AUTO, Banking→NIFTY BANK) |

---

## 3. ATLAS-KIM BUILT TABLES

These tables are created, populated, and maintained by ATLAS-KIM compute pipelines.

### 3.1 Master Registry

#### `unified_instruments`
The single source of truth for all instruments across asset classes.

| Column | Type | Purpose |
|--------|------|---------|
| `instrument_id` | VARCHAR | Primary key (mstar_id for MFs, ticker for ETFs, index_code for indices) |
| `instrument_type` | VARCHAR | EQUITY / MF / ETF / INDEX / INDEX_GLOBAL |
| `symbol` | VARCHAR | Trading symbol |
| `name` | VARCHAR | Display name |
| `sector` | VARCHAR | Sector classification |
| `industry` | VARCHAR | Industry classification |
| `mf_category` | VARCHAR | MF category (Large-Cap, Mid-Cap, etc.) |
| `cap_category` | VARCHAR | LARGE / MID / SMALL |
| `country` | VARCHAR | IN / US / etc. |
| `exchange` | VARCHAR | NSE / BSE / NYSE |
| `is_active` | BOOLEAN | Whether instrument is currently tradeable |
| `aum_cr` | NUMERIC | AUM in INR Crores (for MFs/ETFs) |
| `expense_ratio` | NUMERIC | Expense ratio (for MFs/ETFs) |
| `benchmark_name` | VARCHAR | Primary benchmark name |

**Population:**
- Equities: synced from `de_instrument`
- MFs: 527 target funds (Regular+Equity+Growth) from `de_mf_master` + 981 others
- ETFs: from `de_etf_master`
- Indices: from `de_index_master`
- Global: from `de_global_instrument_master` + curated list

---

### 3.2 Core Metrics

#### `unified_metrics`
The atomic intelligence table. One row per (instrument_id, date). Contains every computed metric.

**Return Columns:**
| Column | Source | Period |
|--------|--------|--------|
| `ret_1d` | Price/NAV pct change | 1 day |
| `ret_1w` | Price/NAV pct change | 1 week (5 sessions) |
| `ret_1m` | Price/NAV pct change | 1 month (21 sessions) |
| `ret_3m` | Price/NAV pct change | 3 months |
| `ret_6m` | Price/NAV pct change | 6 months |
| `ret_12m` | Price/NAV pct change | 12 months |
| `ret_24m` | Price/NAV pct change | 24 months |
| `ret_36m` | Price/NAV pct change | 36 months |

**Technical Columns (propagated from `de_*_technical_daily`):**
| Column | Source Table | Meaning |
|--------|-------------|---------|
| `rsi_14` | de_mf_technical_daily / de_etf_technical_daily / de_index_technical_daily / de_equity_technical_daily | RSI-14 |
| `macd` | Source technicals | MACD line |
| `macd_signal` | Source technicals | MACD signal line |
| `ema_20` | Source technicals | EMA-20 |
| `ema_50` | Source technicals | EMA-50 |
| `ema_200` | Source technicals | EMA-200 |
| `above_ema_20` | Computed | Price > EMA-20? |
| `above_ema_50` | Computed | Price > EMA-50? |
| `golden_cross` | Computed | EMA-50 > EMA-200? |
| `vol_21d` | Source technicals | 21-day volatility |
| `vol_63d` | Source technicals | 63-day volatility |
| `max_dd_252d` | Source technicals | Max drawdown over 252 days |
| `current_dd` | Computed | Current drawdown from 52-week high |

**RS Rank Columns (5 benchmarks × 8 periods = 40 columns):**

Benchmarks: Nifty 50, Nifty 500, S&P 500, MSCI World, Gold
Periods: 1d, 1w, 1m, 3m, 6m, 12m, 24m, 36m

Example columns: `rs_nifty_3m_rank`, `rs_nifty500_12m_rank`, `rs_sp500_1m_rank`, `rs_msci_24m_rank`, `rs_gold_6m_rank`

Each rank is 0-100 percentile. 100 = strongest relative strength vs benchmark.

**State & Action Columns:**
| Column | Values | Logic |
|--------|--------|-------|
| `state` | LEADER / EMERGING / WEAKENING / LAGGING / BASE_BUILDING / BROKEN | Based on RS rank trend + EMA position |
| `state_stability` | 0-1 | Confidence in state classification |
| `frag_score` | 0-1 | Fragility score (higher = more fragile) |
| `frag_level` | LOW / MEDIUM / HIGH / CRITICAL | Threshold-based fragility |
| `action` | STRONG_ACCUMULATE / ACCUMULATE / HOLD / REDUCE / EXIT / AVOID | Deterministic rule engine |
| `action_confidence` | 0-100 | Confidence in action recommendation |

**Narrative:**
| Column | Type | Content |
|--------|------|---------|
| `narrative` | JSONB | `{verdict, reasons[], risks[], technical_snapshot, recommended_action}` |

---

### 3.3 Market Regime

#### `unified_market_regime`
One row per (date, region). Captures market posture.

| Column | Type | Meaning |
|--------|------|---------|
| `date` | DATE | Snapshot date |
| `region` | VARCHAR | IN / GLOBAL |
| `regime` | VARCHAR | BULLISH / BEARISH / NEUTRAL / CAUTION / etc. |
| `direction` | VARCHAR | IMPROVING / DETERIORATING / STABLE |
| `health_score` | DOUBLE | 0-100 aggregate health |
| `health_zone` | VARCHAR | FEAR / WEAK / NEUTRAL / HEALTHY / BULLISH |

---

### 3.4 Sector Breadth

#### `unified_sector_breadth`
Per-sector health metrics.

| Column | Type | Meaning |
|--------|------|---------|
| `date` | DATE | Snapshot date |
| `sector` | VARCHAR | Sector name |
| `n_stocks` | INTEGER | Number of stocks in sector |
| `pct_above_20ema` | DOUBLE | % stocks above 20-day EMA |
| `pct_above_50dma` | DOUBLE | % stocks above 50-day SMA |
| `avg_rs_3m` | DOUBLE | Average RS rank |
| `leaders` | INTEGER | Count of LEADER-state stocks |
| `weakening` | INTEGER | Count of WEAKENING-state stocks |

---

### 3.5 MF Holdings Detail

#### `unified_mf_holdings_detail`
Individual holdings per fund. Sourced from Morningstar API + JIP `de_mf_holdings`.

| Column | Type | Meaning |
|--------|------|---------|
| `mf_id` | VARCHAR | Fund instrument_id |
| `child_id` | VARCHAR | Holding instrument_id (NULL if unmapped) |
| `date` | DATE | Holdings date |
| `isin` | VARCHAR | ISIN of holding |
| `name` | VARCHAR | Holding name |
| `weight_pct` | DOUBLE | Portfolio weight (%) |
| `sector` | VARCHAR | Holding sector |
| `holding_type` | VARCHAR | E=Equity, B=Bond, C=Cash |

**Sources:**
- Morningstar Holdings API: `https://api.morningstar.com/v2/service/mf/fq9mxhk7xeb20f3b/universeid/q3zv6b817mp4fz0f`
- JIP `de_mf_holdings`: fallback for funds not in Morningstar

**Mapping rate:** 97.0% (206,006 / 212,444 holdings mapped to `unified_instruments` by ISIN)

---

### 3.6 MF Look-Through

#### `unified_mf_lookthrough`
Weighted aggregate metrics computed from holdings.

| Column | Type | Calculation |
|--------|------|-------------|
| `mf_id` | VARCHAR | Fund instrument_id |
| `date` | DATE | Compute date |
| `lookthrough_rs_3m` | DOUBLE | SUM(weight × child.rs_nifty_3m_rank) |
| `lookthrough_rs_12m` | DOUBLE | SUM(weight × child.rs_nifty_12m_rank) |
| `pct_holdings_leader` | DOUBLE | SUM(weight) WHERE child.state = 'LEADER' |
| `pct_holdings_emerging` | DOUBLE | SUM(weight) WHERE child.state = 'EMERGING' |
| `pct_holdings_broken` | DOUBLE | SUM(weight) WHERE child.state = 'BROKEN' |
| `top_sector` | VARCHAR | Dominant sector by weight |
| `sector_herfindahl` | DOUBLE | SUM(sector_weight²) — concentration index |
| `num_holdings` | INTEGER | COUNT(DISTINCT child_id) |
| `top10_concentration` | DOUBLE | SUM(weight) of top 10 holdings |
| `avg_holding_ret_3m` | DOUBLE | SUM(weight × child.ret_3m) |
| `avg_holding_frag_score` | DOUBLE | SUM(weight × child.frag_score) |
| `cap_large_pct` | DOUBLE | % large-cap exposure |
| `cap_mid_pct` | DOUBLE | % mid-cap exposure |
| `cap_small_pct` | DOUBLE | % small-cap exposure |
| `cap_tilt` | VARCHAR | Dominant cap category |
| `dominant_sectors` | JSONB | Top 2-3 sectors: `[{sector, weight_pct}, ...]` |
| `staleness` | VARCHAR | FRESH / STALE |
| `staleness_days` | INTEGER | Days since holdings data |

**Coverage:** 329 instruments on latest date (285 target MFs + 34 indices + 10 ETFs)

---

### 3.7 MF Rankings

#### `unified_mf_rankings`
Six-factor objective mapping. **No composite score.** Independent percentiles within category.

| Column | Type | Factor | Data Source |
|--------|------|--------|-------------|
| `factor_momentum_pct` | DOUBLE | Momentum | NAV RS 3m/12m + EMA trend |
| `factor_quality_pct` | DOUBLE | Risk-Adjusted Quality | Sharpe, Sortino, Calmar |
| `factor_resilience_pct` | DOUBLE | Resilience | Inverted max DD + low volatility |
| `factor_holdings_pct` | DOUBLE | Holdings Quality | lookthrough_rs + leader% + concentration |
| `factor_cost_pct` | DOUBLE | Cost Efficiency | Inverted expense ratio + AUM |
| `factor_consistency_pct` | DOUBLE | Consistency | Positive return consistency + low std dev |
| `lookthrough_rs_3m` | DOUBLE | — | From unified_mf_lookthrough |
| `cap_tilt` | VARCHAR | — | LARGE / MID / SMALL |
| `aum_cr` | DOUBLE | — | AUM in Crores |
| `expense_ratio` | DOUBLE | — | Expense ratio |
| `action` | VARCHAR | — | STRONG_ACCUMULATE / ACCUMULATE / HOLD / REDUCE / EXIT |
| `rank_in_category` | INTEGER | — | Rank by momentum + holdings within category |
| `total_in_category` | INTEGER | — | Total funds in category |

**Coverage:** 1,110 instruments on latest date

---

### 3.8 Pipeline Logging

#### `unified_pipeline_log`
Tracks compute pipeline runs.

| Column | Type |
|--------|------|
| `run_date` | DATE |
| `phase` | VARCHAR |
| `status` | SUCCESS / FAILED |
| `rows_processed` | INTEGER |
| `error_message` | TEXT |

---

## 4. DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JIP DATA CORE                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │de_equity_*  │ │de_mf_*      │ │de_etf_*     │ │de_index_*           │  │
│  │de_global_*  │ │de_mf_holdings│ │de_etf_master│ │de_index_constituents│  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘  │
└─────────┼───────────────┼───────────────┼───────────────────┼─────────────┘
          │               │               │                   │
          ▼               ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ATLAS-KIM COMPUTE PIPELINE                           │
│                                                                              │
│  Phase 1: SYNC INSTRUMENTS                                                   │
│    └─► unified_instruments (EQUITY/MF/ETF/INDEX/INDEX_GLOBAL)               │
│                                                                              │
│  Phase 2: PROPAGATE TECHNICALS                                               │
│    └─► Pull RSI/MACD/EMAs from de_*_technical_daily ──► unified_metrics     │
│                                                                              │
│  Phase 3: COMPUTE RETURNS                                                    │
│    └─► 1D/1W/1M/3M/6M/12M/24M/36M from prices ──► unified_metrics          │
│                                                                              │
│  Phase 4: COMPUTE RS RANKS                                                   │
│    └─► 5 benchmarks × 8 periods ──► 40 RS rank columns ──► unified_metrics  │
│                                                                              │
│  Phase 5: CLASSIFY STATES & ACTIONS                                          │
│    └─► LEADER/EMERGING/WEAKENING/LAGGING/BASE_BUILDING/BROKEN               │
│    └─► STRONG_ACCUMULATE/ACCUMULATE/HOLD/REDUCE/EXIT/AVOID                  │
│                                                                              │
│  Phase 6: COMPUTE MARKET REGIME                                              │
│    └─► unified_market_regime (IN + GLOBAL)                                  │
│                                                                              │
│  Phase 7: COMPUTE SECTOR BREADTH                                             │
│    └─► unified_sector_breadth                                               │
│                                                                              │
│  Phase 8: COMPUTE LOOK-THROUGH                                               │
│    └─► Morningstar holdings + de_mf_holdings ──► unified_mf_holdings_detail │
│    └─► Weighted aggregates ──► unified_mf_lookthrough                       │
│                                                                              │
│  Phase 9: COMPUTE 6-FACTOR RANKINGS                                          │
│    └─► Independent percentiles ──► unified_mf_rankings                      │
│                                                                              │
│  Phase 10: GENERATE NARRATIVES                                               │
│    └─► Template-based prose ──► unified_metrics.narrative (JSONB)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI BACKEND                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │/snapshot    │ │/aggregate   │ │/screen      │ │/regime              │  │
│  │/funds/*     │ │/global/*    │ │             │ │                     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NEXT.JS FRONTEND                                  │
│  Dashboard │ Sectors │ Funds │ Leaders │ Weakening │ Global │ Instrument   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. DAILY UPDATE PIPELINE

### 5.1 Schedule

| Time (IST) | Job | Owner |
|------------|-----|-------|
| ~3:00 PM | JIP EOD pipeline completes | JIP (external) |
| ~3:30 PM | Verify JIP data freshness | ATLAS monitor |
| ~3:45 PM | Run `unified_compute.py` | ATLAS scheduler |
| ~4:00 PM | Run `mf_lookthrough_compute.py` | ATLAS scheduler |
| ~4:15 PM | Run `mf_ranking_engine.py` | ATLAS scheduler |
| ~4:30 PM | Run `narrative_backfill.py` | ATLAS scheduler |
| ~4:45 PM | Validation gates | ATLAS monitor |

### 5.2 Validation Gates (abort if fail)

1. `unified_metrics` row count ≥ previous day
2. `unified_metrics` RSI-14 coverage ≥ 95%
3. `unified_metrics` RS-3M coverage = 100%
4. `unified_market_regime` has row for today
5. `unified_mf_rankings` has ≥ 500 rows
6. `unified_metrics` narrative coverage ≥ 95%

### 5.3 Morningstar Holdings Update

The Morningstar holdings universe JSON (~147MB) is **not fetched daily** in the current pipeline. It is fetched on-demand or via a separate cron:

```bash
# Manual / scheduled holdings refresh
curl -o /tmp/mstar_holdings_universe.json \
  "https://api.morningstar.com/v2/service/mf/fq9mxhk7xeb20f3b/universeid/q3zv6b817mp4fz0f?accesscode=ftijxp6pf11ezmizn19otbz18ghq2iu4&format=json"

# Then run ingest script
PYTHONPATH=/home/ubuntu/atlas_kim python backend/scripts/ingest_morningstar_holdings.py
```

**Recommended:** Run weekly (Saturday) since MF holdings change slowly.

### 5.4 AMFI NAV Daily Update

For funds not covered by JIP's `de_mf_nav_daily`:
```bash
wget https://www.amfiindia.com/spages/NAVAll.txt
# Parse and upsert to de_mf_nav_daily
```

JIP already covers this for most funds.

---

## 6. API ENDPOINTS → TABLES MAPPING

| Endpoint | Primary Tables | Description |
|----------|---------------|-------------|
| `GET /snapshot/{id}` | `unified_metrics` + `unified_instruments` + `unified_mf_lookthrough` + `unified_mf_rankings` | Full evidence card for any instrument |
| `GET /aggregate` | `unified_metrics` + `unified_instruments` + `unified_sector_breadth` | Bubble chart + table for cohorts |
| `POST /screen` | `unified_metrics` + `unified_instruments` | Filterable screener |
| `GET /regime` | `unified_market_regime` | Current market regime |
| `GET /funds/rankings` | `unified_mf_rankings` + `unified_instruments` | 6-factor heatmap |
| `GET /funds/{id}/xray` | `unified_metrics` + `unified_mf_lookthrough` + `unified_mf_rankings` + `unified_instruments` | Full fund analysis |
| `GET /funds/{id}/holdings` | `unified_mf_holdings_detail` + `unified_metrics` | Top 20 holdings with child metrics |
| `GET /funds/categories` | `unified_mf_rankings` | Category aggregates |
| `POST /funds/screen` | `unified_mf_rankings` + `unified_instruments` | MF-specific screener |
| `GET /global/regime` | `unified_market_regime` | Global market regime |
| `GET /global/aggregate` | `unified_metrics` + `unified_instruments` | Global bubble chart |

---

## 7. KEY DESIGN DECISIONS

1. **One database, one backend, one frontend** — No microservices. All data lives in the same PostgreSQL RDS.
2. **Stock is the atom** — All intelligence rolls up from instrument-level metrics.
3. **No composite MF score** — 6 independent factor percentiles, presented as radar/heatmap.
4. **No LLMs in compute** — All compute is deterministic SQL/Python. Narratives are template-based.
5. **Equal weight for indices** — `de_index_constituents` has NULL weights; 1/N approximation is used.
6. **Stale holdings are forward-filled** — Look-through data from the most recent holdings date is copied forward with `staleness='STALE'` and `staleness_days` tracked.

---

## 8. FILES REFERENCE

| File | Purpose |
|------|---------|
| `backend/services/unified_compute.py` | Main compute pipeline (returns, RS ranks, states, regime, sector breadth) |
| `backend/services/mf_lookthrough_compute.py` | MF/ETF/Index look-through compute |
| `backend/services/mf_ranking_engine.py` | 6-factor ranking engine |
| `backend/services/global_compute.py` | Global metrics + regime compute |
| `backend/services/unified_narrative.py` | Template-based narrative generator |
| `backend/services/narrative_backfill.py` | Batch narrative population |
| `backend/routes/unified.py` | FastAPI routes |
| `backend/scripts/populate_mf_unified.py` | MF instrument sync script |
| `backend/scripts/ingest_morningstar_holdings.py` | Morningstar holdings ingestion |
| `alembic/versions/001_add_unified_tables.py` | Initial schema migration |
| `alembic/versions/002_add_missing_lt_regime_columns.py` | Look-through + regime column additions |

---

*Document version: 2026-04-23*  
*Next review: When new instrument types or benchmarks are added*
