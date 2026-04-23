# ATLAS Unified — Complete Dashboard + MF Module Plan

## Philosophy: Objective Mapping, Not Ranking

The user explicitly rejected composite scores and weights. Instead, we use **multi-dimensional objective mapping**:

- Each fund is positioned independently on 6 factor axes
- No hidden weights, no black-box ranking
- Users filter, slice, and compare transparently
- Presentation: radar charts, quadrant maps, percentile heatmaps

---

## Phase 0: Infrastructure & Data Foundation

### 0A. MF NAV Historical Data Backfill

**Source:** `captn3m0/historical-mf-data` (GitHub SQLite archive)
- Pre-built archive of all AMFI daily NAVs
- ~500MB compressed, ~10M records for 4,000 funds x 10 years
- Download -> decompress -> convert to PostgreSQL

**Daily Update Source:** AMFI `NAVAll.txt` (canonical)
- Published every evening ~11 PM IST
- `wget https://www.amfiindia.com/spages/NAVAll.txt`
- Parse and upsert

**Why this combo:** Archive gives instant history. AMFI txt gives free, reliable daily updates with zero API dependency.

**Table:** `mf_nav_history` (or reuse `de_mf_nav_daily` with backfill)
```sql
scheme_code VARCHAR(20)
scheme_name VARCHAR(200)
isin VARCHAR(12)
nav_date DATE
nav DECIMAL(12,4)
```

### 0B. Morningstar Holdings Pipeline

**API Details (discovered by agent):**
- Endpoint: `GET https://api.morningstar.com/v2/service/mf/{serviceId}/mstarid/{MorningstarID}?accesscode={accesscode}&format=json`
- Auth: `accesscode` query param only (no basic auth needed)
- IdType is `mstarid` (not `morningstarid`)
- Service ID: `fq9mxhk7xeb20f3b`
- Access Code: `ftijxp6pf11ezmizn19otbz18ghq2iu4`
- Universe ID for batch: `q3zv6b817mp4fz0f`

**New Static Data API:**
- `https://api.morningstar.com/v2/service/mf/x6d9w6xxu0hmhrr4/universeid/{universeId}?accesscode={accesscode}`
- Returns: AUM, expense ratio, benchmark, fund manager, launch date, category

**Schema Changes for `unified_mf_holdings_detail`:**
```sql
-- Drop restrictive FK (bonds/cash can't map to unified_instruments)
ALTER TABLE unified_mf_holdings_detail
  DROP CONSTRAINT unified_mf_holdings_detail_child_id_fkey;

-- Add columns for raw API data
ALTER TABLE unified_mf_holdings_detail
  ADD COLUMN IF NOT EXISTS isin varchar(20),
  ADD COLUMN IF NOT EXISTS sector varchar(100),
  ADD COLUMN IF NOT EXISTS industry varchar(100),
  ADD COLUMN IF NOT EXISTS market_value numeric(18,4),
  ADD COLUMN IF NOT EXISTS shares_held bigint,
  ADD COLUMN IF NOT EXISTS holding_type varchar(10),
  ADD COLUMN IF NOT EXISTS source_raw jsonb;
```

**Fetch Script:** `backend/scripts/fetch_morningstar_holdings.py`
- Reads all `instrument_type = 'MF'` from `unified_instruments`
- Fetches holdings via `mstarid` endpoint
- Maps to `unified_instruments` by ISIN/symbol where possible
- Upserts with `ON CONFLICT (tenant_id, mf_id, date, child_id)`
- Rate limit: 0.5s between requests

### 0C. MF Technical Indicators Compute

**Problem:** `de_mf_technical_daily` lacks RSI, MACD, ATR, volatility.
**Fix:** Build `backend/scripts/compute_mf_technicals.py`
- Reads `de_mf_nav_daily` (or `mf_nav_history`)
- Computes RSI-14, MACD, EMAs, ATR, volatility using `pandas-ta` or `ta-lib`
- Upserts into `de_mf_technical_daily`
- Run weekly or after each NAV batch

### 0D. Extend RS Rank Compute to All Benchmarks x All Periods

**Current:** Only Nifty 50 has all 8 periods. Other benchmarks only have 3m and 12m.
**Fix:** Modify `backend/services/unified_compute.py`
- Add 30 new columns to `unified_metrics`: `rs_nifty500_1d_rank` through `rs_gold_36m_rank`
- Extend benchmark CTEs to compute all 8 periods for all 5 benchmarks
- Alembic migration for new columns

---

## Phase 1: MF Lookthrough Compute Pipeline

### 1A. Holdings Enrichment

For each MF, after holdings are fetched:
```sql
-- Join holdings to child instrument metrics
SELECT h.mf_id, h.child_id, h.weight_pct,
       m.rs_nifty_3m_rank, m.state, m.action, m.ret_3m
FROM unified_mf_holdings_detail h
JOIN unified_metrics m ON m.instrument_id = h.child_id AND m.date = h.date
```

### 1B. Fund-Level Aggregate Metrics

Compute and store in `unified_mf_lookthrough`:
| Field | Calculation |
|-------|-------------|
| `lookthrough_rs_3m` | SUM(h.weight_pct x child.rs_nifty_3m_rank) |
| `lookthrough_rs_12m` | SUM(h.weight_pct x child.rs_nifty_12m_rank) |
| `pct_holdings_leader` | SUM(weight_pct) WHERE child.state = 'LEADER' |
| `pct_holdings_emerging` | SUM(weight_pct) WHERE child.state = 'EMERGING' |
| `pct_holdings_broken` | SUM(weight_pct) WHERE child.state = 'BROKEN' |
| `top_sector` | MODE() of child.sector by weight |
| `sector_herfindahl` | E(sector_weight_) |
| `num_holdings` | COUNT(DISTINCT child_id) |
| `top10_concentration` | SUM(weight_pct) of top 10 holdings |
| `avg_holding_ret_3m` | SUM(weight_pct x child.ret_3m) |
| `avg_holding_frag_score` | SUM(weight_pct x child.frag_score) |

### 1C. Cap Tilt Calculation

From holdings-level market cap data:
| Field | Calculation |
|-------|-------------|
| `cap_large_pct` | SUM(weight_pct) WHERE child.cap_category = 'LARGE' |
| `cap_mid_pct` | SUM(weight_pct) WHERE child.cap_category = 'MID' |
| `cap_small_pct` | SUM(weight_pct) WHERE child.cap_category = 'SMALL' |
| `cap_tilt` | Dominant cap category |

---

## Phase 2: Six-Factor Objective Mapping Engine

**No composite score. Each factor is independently calculated and presented.**

### Factor 1: Momentum
- `rs_nifty_3m_rank` percentile within category
- `rs_nifty_12m_rank` percentile within category
- `rs_category_3m_rank` (vs peers)
- NAV trend: above EMA 50/200?

### Factor 2: Risk-Adjusted Quality
- `sharpe_1y` percentile
- `sortino_1y` percentile
- `calmar_ratio` percentile
- Rolling 12M positive return %

### Factor 3: Resilience
- Max drawdown percentile (inverted)
- Recovery time (weeks to new ATH)
- Downside capture ratio
- Performance in months where Nifty fell >5%

### Factor 4: Holdings Quality (Lookthrough)
- `lookthrough_rs_3m` (weighted avg RS of underlying stocks)
- `pct_holdings_leader` + `pct_holdings_emerging`
- `sector_herfindahl` (diversification)
- `top10_concentration`

### Factor 5: Cost Efficiency
- Expense ratio percentile within category (lower = better)
- AUM > 500cr?
- Tracking error vs benchmark

### Factor 6: Consistency
- % of rolling 12M periods beating category average
- Standard deviation of monthly returns
- Longest streak of beating benchmark

### Storage
Table: `unified_mf_rankings`
```sql
mf_id, date,
factor_momentum_pct, factor_quality_pct, factor_resilience_pct,
factor_holdings_pct, factor_cost_pct, factor_consistency_pct,
category, cap_tilt, aum_cr, expense_ratio,
lookthrough_rs_3m, lookthrough_rs_12m,
pct_holdings_leader, pct_holdings_emerging,
sector_herfindahl, top10_concentration,
created_at, updated_at
```

---

## Phase 3: Backend API Extensions

### New Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/unified/funds/rankings` | All funds with 6 factor percentiles + lookthrough metrics |
| `GET /api/unified/funds/{id}/xray` | Full fund snapshot + holdings table + sector breakdown + factor radar |
| `GET /api/unified/funds/{id}/holdings` | Top 20 holdings with child metrics |
| `GET /api/unified/funds/categories` | Distinct categories for filter dropdown |
| `POST /api/unified/funds/screen` | Filter by factor percentiles, category, cap tilt |

### Modified Endpoints
| Endpoint | Change |
|----------|--------|
| `GET /api/unified/snapshot/{id}` | If MF, include `lookthrough_rs`, `holdings_summary`, `factor_percentiles` |
| `GET /api/unified/aggregate` | Support `cohort_type=category` and `cohort_type=cap_tilt` |

---

## Phase 4: Frontend - MF Module

### 4A. Funds Rankings Page (`/unified/funds`)

**Current:** Simple table with name, category, RS 3M, 3M ret, action.

**New Design:**
- **Filter Bar:** Category dropdown, Cap tilt dropdown, Min AUM slider
- **Factor Heatmap Table:** Each row = one fund. Columns = 6 factors (color-coded: green = top quartile, red = bottom quartile). No composite score shown.
- **Sortable by any factor**
- **Click row -> Fund X-Ray**

### 4B. Fund X-Ray Page (`/unified/funds/{id}`)

**Current:** Generic snapshot (same as stock page).

**New Design:**
- **Header:** Fund name, AMC, category, AUM, expense ratio, benchmark
- **Factor Radar Chart:** 6 axes, fund shape vs category median shape (overlay)
- **Evidence Card:** NAV metrics + lookthrough RS + action badge
- **Holdings Table:** Top 20 holdings with weight %, child RS rank, child state, sector
- **Sector Donut Chart:** Sector allocation %
- **Cap Tilt Bar:** Large / Mid / Small %
- **Narrative Panel:** Fund-specific narrative (lookthrough-based)
- **Time Series:** NAV chart with EMA overlays (if historical NAV available)

### 4C. Dashboard MF Preview

Add a "Top Funds" card to dashboard:
- Show 4-6 funds with highest `lookthrough_rs_3m`
- Quick link to Funds Rankings

### 4D. Category Explorer (New Page)

`/unified/funds/categories`
- Bubble chart: X = avg momentum, Y = avg resilience, size = AUM, color = category
- Table: one row per category with aggregate stats

---

## Phase 5: Frontend - Core Dashboard Fixes (Already Done by Agents B+C)

- Fixed `localhost:8000` on 4 pages
- Added benchmark + period selectors
- Made bubbles clickable
- Added leaders preview to dashboard
- Added pagination to list pages
- Added fund category filter
- Added error states
- Fixed RSScorecard mappings
- Added root redirect

**Remaining:**
- Build and deploy (done below)
- QA with screenshots

---

## Phase 6: QA & Deployment

1. Rebuild frontend
2. Restart systemd services
3. Run compute pipeline for latest date
4. Browser-based QA: screenshot every page, verify clicks, verify data
5. Fix any issues found

---

## Data Flow Architecture

```
Morningstar API --> fetch_morningstar_holdings.py --> unified_mf_holdings_detail
                                                          |
AMFI NAV txt --> mf_nav_history --> compute_mf_technicals.py --> de_mf_technical_daily
                                                          |
unified_metrics (stocks) --|--> mf_lookthrough_compute.py --> unified_mf_lookthrough
                           |                                     |
                           |--> unified_compute.py --> unified_metrics (funds)
                                                          |
                                            mf_ranking_engine.py --> unified_mf_rankings
                                                          |
                                                     Backend API
                                                          |
                                                     Next.js Frontend
```

---

## Execution Order (Recommended)

| Step | Task | Time | Owner |
|------|------|------|-------|
| 1 | Download captn3m0 NAV archive -> PostgreSQL | 1 hr | Backend agent |
| 2 | Build Morningstar fetch script + run for all MFs | 3 hrs | Backend agent |
| 3 | Compute MF technicals (RSI/MACD on NAV) | 2 hrs | Backend agent |
| 4 | Build lookthrough compute pipeline | 4 hrs | Backend agent |
| 5 | Extend RS ranks to all benchmarks x all periods | 4 hrs | Backend agent |
| 6 | Build 6-factor mapping engine | 4 hrs | Backend agent |
| 7 | Build new API endpoints (funds/rankings, xray, holdings) | 3 hrs | Backend agent |
| 8 | Rebuild Funds page (rankings table + factor heatmap) | 4 hrs | Frontend agent |
| 9 | Rebuild Fund X-Ray page (radar + holdings + sector chart) | 5 hrs | Frontend agent |
| 10 | Add MF preview to dashboard | 2 hrs | Frontend agent |
| 11 | QA + screenshots + fixes | 3 hrs | QA agent |
| 12 | Deploy + restart services | 30 min | DevOps |

**Total: ~36 hours of agent work (can parallelize heavily)**
