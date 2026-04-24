# ATLAS-KIM Frontend Redesign Plan
## From Bug-Fix Mode → Professional Fund Manager Dashboard

---

## 1. WHERE WE ARE TODAY (Honest Assessment)

### What's Working
| Component | Status |
|-----------|--------|
| Backend pipeline (9 phases) | ✅ Complete — 4,257 instruments, all metrics computed |
| API endpoints | ✅ All live — regime, aggregate, screen, funds, xray, global |
| SSL + nginx proxy | ✅ `https://atlas.jslwealth.in` serving correctly |
| Fund X-Ray page | ✅ Loads, shows radar chart + metrics + narrative |
| Funds rankings heatmap | ✅ 1,110 instruments with 6-factor scores |
| Global pulse page | ✅ 113 global instruments + regime |

### What's Broken (Structural)
| Issue | Impact | Root Cause |
|-------|--------|------------|
| **Sector list polluted** | 93 "sectors" including MF categories (Flexi Cap, ELSS, Index Funds) | Aggregate query groups by `i.sector` across ALL instrument types. MF categories leak into sector view. |
| **Fund universe wrong** | Global X China, Invesco, random IDs appearing | Rankings API returns ALL 1,110 instruments (ETFs, indices, globals) — not just 527 target MFs |
| **Leaders page mixed** | Non-India funds in leaders list | Screen API doesn't filter by `country='IN'` |
| **above_ema_50 NULL** | Fixed via script, but needs to be in pipeline | Source technical tables incomplete on latest date |
| **No IN regime for latest date** | Fixed via script, but needs pipeline fix | Regime compute only runs for GLOBAL |

### What's Missing (UX / Data Density)
| Issue | Impact |
|-------|--------|
| No quadrant view (2×2 matrix) | User cannot see Leading/Weakening/Lagging/Improving at a glance |
| No market breadth gauges | % above EMA-20/50/200 not visible on dashboard |
| No period toggle (1W/1M/3M/6M/12M) | Dashboard locked to 3M only |
| No sorting on tables | Stocks/funds/ETFs shown in random order |
| Missing columns everywhere | Golden cross, fragility, volume, volatility not shown |
| No color coding on sector cards | Plain numbers — no visual hierarchy |
| No country flags on global page | Looks like a raw data dump |
| Bubble chart too small | Bubbles are tiny dots, not meaningful size |
| No RS scorecard (7 timeframes × 4 benchmarks) | Spec requires this as THE core component |
| Narratives too sparse | Missing position size guidance, existing position advice |
| No evidence card density | Should show 20+ metrics in structured grid |
| No look-through on ETF page | ETFs should show holdings just like MFs |
| No benchmark toggle on sector page | Cannot switch Nifty → Nifty 500 → MSCI → Gold |

---

## 2. RESEARCH INSIGHTS (What Best Platforms Do)

### MarketSmith / MarketSurge ($1,499/yr)
- **Composite Rating** (1-99) combining EPS + RS + SMR + A/D
- **RS Rating** (1-99) — percentile vs all stocks
- **Pattern recognition** — cup-with-handle, flat base auto-detected
- **Dense data panels** — every chart surrounded by fundamental + technical boxes
- **Color-coded everything** — green = strong, red = weak, no ambiguity

### Relative Rotation Graph (RRG) — Julius de Kempenaer
- **X-axis**: RS Ratio (strength vs benchmark)
- **Y-axis**: RS Momentum (rate of change of RS)
- **4 quadrants**: Leading → Weakening → Lagging → Improving (clockwise)
- **Trailing dots** show path/direction of rotation
- Used by Bloomberg, StockCharts, professional asset allocators

### AlphaLab (India-focused)
- **Sector Rotation Heatmap** — 49 sectors × 4 timeframes (1W/1M/3M/6M), color-coded
- **RRG with trails** — shows sector momentum shift over time
- **Quadrant view** — instant visual classification

### TrendSpider Sector Rotation
- **Sector ETFs plotted on 4-quadrant phase space**
- **Trails** showing where each sector has been
- **Auto-detects rotation** before it becomes obvious in price

---

## 3. VISION: THE ATLAS DASHBOARD

> "Every view must answer: What should I do? Not 'what is the score?' but 'ACCUMULATE, EXIT, or HOLD?'"
> — Section 0, ATLAS Spec

### Design Principles
1. **Density, not simplicity** — Fund managers want INFORMATION, not whitespace
2. **Color = Meaning** — Every number has a color: green (good), red (bad), amber (watch)
3. **Action first** — Badge + verdict at the TOP of every card/page
4. **Quadrant thinking** — 2×2 matrices everywhere (RS × Momentum, Breadth × Trend, etc.)
5. **Narrative, not numbers** — "Top quintile performer" not "RS=82.3"

---

## 4. PHASED IMPLEMENTATION PLAN

### PHASE 1: Structural Fixes (Backend) — 2-3 hours
**Goal**: Stop showing wrong data before building pretty UI on top of it.

| # | Task | Files |
|---|------|-------|
| 1.1 | Fix aggregate query to filter `instrument_type IN ('EQUITY', 'ETF')` when `cohort_type='sector'` | `backend/services/unified_query.py` |
| 1.2 | Fix funds rankings to only return `instrument_type='MF'` with `plan_type='Regular'` AND `option='Growth'` | `backend/services/unified_query.py`, `mf_ranking_engine.py` |
| 1.3 | Fix screen/leaders API default to `country='IN'` | `backend/routes/unified.py` |
| 1.4 | Fix regime compute to generate `region='IN'` row daily | `backend/services/unified_compute.py` |
| 1.5 | Add `above_ema_50` recomputation to pipeline after forward-fill | `backend/services/unified_compute.py` |

### PHASE 2: Dashboard Overhaul — 4-5 hours
**Goal**: Transform the landing page from a sparse summary into a command center.

| # | Task | Description |
|---|------|-------------|
| 2.1 | **Market Health Banner** | Regime badge + health score gauge + direction arrow + natural language summary (1 sentence) |
| 2.2 | **State Count Cards** | 4 cards: Leaders (count, click → leaders), Emerging, Weakening (click → weakening), Fragile. Color-coded. |
| 2.3 | **Breadth Gauges** | Horizontal bars: % Above EMA-20, % Above EMA-50, % Above EMA-200, Participation Rate. With history sparkline. |
| 2.4 | **Sector RRG (Quadrant Chart)** | Scatter plot: X=RS Rank, Y=RS Momentum (1M change). 4 quadrants labeled. Bubble size = market cap / member count. Click → sector detail. |
| 2.5 | **Sector Health Bars** | Sorted by `pct_above_ema_50`. Color zones: BULLISH/HEALTHY/NEUTRAL/CAUTION/WEAK. |
| 2.6 | **Period + Benchmark Toggle** | Global selector: Period (1W/1M/3M/6M/12M), Benchmark (Nifty/Nifty 500/MSCI/Gold). Affects ALL dashboard components. |
| 2.7 | **Top Movers Preview** | 3-column grid: Top Leaders, Top Weakening, Top Fragile. Each with mini action badge + 2 key stats. |

### PHASE 3: Sector Explorer — 3-4 hours
**Goal**: Professional sector rotation tool.

| # | Task | Description |
|---|------|-------------|
| 3.1 | **Sector RRG (full page)** | Large scatter with quadrant labels, trails (last 5 periods), benchmark toggle |
| 3.2 | **Sector Table** | Sortable table: Sector, RS Rank, 3M Ret, 12M Ret, % Above EMA-50, Leader %, Action, Fragility. Color-coded rows. |
| 3.3 | **Sector Detail Page** | Header: sector name, action badge, member count. Sub-tabs: Stocks (sortable table), MFs, ETFs. Each with full metrics. |
| 3.4 | **Sector Context Panel** | Sector vs Market RS, sector breadth trend, top 5 stocks in sector |

### PHASE 4: Instrument Evidence Card — 4-5 hours
**Goal**: THE core page. Every metric in one dense view.

| # | Task | Description |
|---|------|-------------|
| 4.1 | **Header** | Symbol, Name, Price, Action Badge (large), Sector link, 1-line verdict |
| 4.2 | **RS Scorecard** | 7 rows (1W→3Y) × 4 columns (Nifty, Nifty 500, MSCI, Gold). Each cell: rank number + color. |
| 4.3 | **Technical Grid** | 2×4 grid: RSI-14, EMA-20/50/200 status, MACD, % from 52W high, Volatility, Golden Cross, Fragility. Each with icon + value + color. |
| 4.4 | **Narrative Panel** | Verdict box + Confirming Factors (expandable) + Risk Factors (expandable) + Recommended Action (new/existing/MF position guidance) |
| 4.5 | **Context Panel** | Sector context + Market regime context |
| 4.6 | **Risk Metrics** | Sharpe, Sortino, Calmar, Max DD, Beta |
| 4.7 | **Price Chart** | Recharts AreaChart with EMA-20/50/200 overlays + volume bars |

### PHASE 5: Funds & ETF Pages — 3-4 hours
**Goal**: Only show relevant funds, with rich look-through data.

| # | Task | Description |
|---|------|-------------|
| 5.1 | **Fund Universe Filter** | Only Regular + Equity + Growth plans (527 funds). Remove globals, debt funds, IDCW plans. |
| 5.2 | **Fund Rankings Table** | Sortable: Name, Category, 6 Factors (heatmap), AUM, Expense, Look-through RS, Action. |
| 5.3 | **Fund X-Ray** | Radar chart (6 factors), holdings table, sector donut, cap tilt bar, top 10 holdings with child action badges, look-through narrative. |
| 5.4 | **ETF Page** | Same as Fund X-Ray but for ETFs. Show underlying index + top holdings. |

### PHASE 6: Global Page — 2-3 hours
**Goal**: Country-level intelligence with visual appeal.

| # | Task | Description |
|---|------|-------------|
| 6.1 | **Country Flags** | Emoji flags or SVG flags for each country |
| 6.2 | **Global Bubble Chart** | Countries as bubbles: X=RS vs S&P 500, Y=RS vs MSCI, Size=market cap, Color=action |
| 6.3 | **Global Table** | Sortable: Country, Flag, Instruments, RS S&P 500, RS MSCI, 3M Ret, 12M Ret, Action |
| 6.4 | **Global Regime Gauge** | Same as India regime but for global basket |

### PHASE 7: Leaders & Weakening Pages — 2 hours
**Goal**: Actionable lists with full context.

| # | Task | Description |
|---|------|-------------|
| 7.1 | **Leaders Table** | Sortable: STRONG_ACCUMULATE + ACCUMULATE only. Columns: Name, RS 3M, RS 12M, State, Action, Sector, 3M Ret, RSI, Above EMA-50. |
| 7.2 | **Weakening Table** | Sortable: REDUCE + EXIT only. Same columns. |
| 7.3 | **Filter Bar** | Sector dropdown, Cap dropdown, Min RS slider. |

### PHASE 8: Shared Components & Polish — 3-4 hours
**Goal**: Consistency, density, and delight.

| # | Task | Description |
|---|------|-------------|
| 8.1 | **ActionBadge** | 5 colors, 2 sizes, with confidence % |
| 8.2 | **RegimeGauge** | Circular gauge 0-100, color zones, center text |
| 8.3 | **DataFreshness** | "Data as of 23 Apr 2026" with staleness warning |
| 8.4 | **Sparkline** | Mini line charts for trend visualization |
| 8.5 | **Tooltips** | Every metric has a tooltip explaining what it means |
| 8.6 | **PeriodSelector** | Global 1W/1M/3M/6M/12M toggle (affects all API calls) |
| 8.7 | **BenchmarkSelector** | Nifty/Nifty 500/MSCI/Gold toggle |

---

## 5. PRIORITY ORDER (What To Build First)

Given limited time, here's the order that maximizes impact:

### This Week (High Impact, Fix Wrong Data First)
1. **Phase 1**: Structural backend fixes (wrong sectors, wrong funds)
2. **Phase 2.1-2.5**: Dashboard overhaul (breadth gauges, quadrant chart, sector bars)
3. **Phase 3.1-3.2**: Sector RRG + sortable table
4. **Phase 7**: Leaders/Weakening with sortable tables

### Next Week (Deep Pages)
5. **Phase 4**: Evidence card (THE instrument detail page)
6. **Phase 5**: Fund universe filter + X-Ray
7. **Phase 6**: Global page with flags + bubbles
8. **Phase 8**: Shared components + polish

---

## 6. SPECIFIC UI MOCKUPS (Text-Based)

### Dashboard Top Section
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [ATLAS]  Dashboard  Sectors  Funds  Leaders  Weakening  Global              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │  REGIME     │  │  HEALTH     │  │  DIRECTION  │  │  SUMMARY          │  │
│  │  CAUTION_   │  │  [Gauge]    │  │  ↗ MIXED    │  │ "Market cautious. │  │
│  │  DEFENSIVE  │  │  24 / 100   │  │             │  │  51% above EMA-50.│  │
│  │  [orange]   │  │  NEUTRAL    │  │             │  │  Selective deploy"│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────────┘  │
│                                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ LEADERS  │ │ EMERGING │ │WEAKENING │ │ FRAGILE  │                       │
│  │   12     │ │    8     │ │    7     │ │    3     │                       │
│  │ [green]  │ │[lt green]│ │ [orange] │ │  [red]   │                       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
│                                                                             │
│  Period: [1W] [1M] [3M●] [6M] [12M]    Benchmark: [Nifty●] [Nifty 500] [MSCI]│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SECTOR ROTATION (RRG)                            │   │
│  │                                                                     │   │
│  │   Improving ↑        │        ↑ Leading                            │   │
│  │             ● Auto    │   IT ●                                      │   │
│  │                       │        ● Financial                          │   │
│  │   ────────────────────┼──────────────────── RS Rank →               │   │
│  │                       │                                             │   │
│  │             ● Pharma  │        ● Energy  ● Metal                    │   │
│  │   Lagging ↓           │        ↓ Weakening                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MARKET BREADTH                    SECTOR HEALTH                            │
│  ┌────────────────────┐           ┌─────────────────────────────────────┐   │
│  │ % Above EMA-20 ████│ 45%       │ Energy          ████████████ 100% BULL│   │
│  │ % Above EMA-50 ████│ 51%       │ IT              ██████████   72% HEALTH│   │
│  │ % Above EMA-200████│ 38%       │ Financial       ████████     58% HEALTH│   │
│  │ Participation  ████│ 14%       │ Pharma          ████         33% CAUT │   │
│  └────────────────────┘           │ Real Estate     ██           15% WEAK │   │
│                                   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Evidence Card (Instrument Detail)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RELIANCE  Reliance Industries Ltd    ₹2,485.50    [ACCUMULATE 82%]         │
│ Energy →                              "Add gradually. Leadership building." │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RELATIVE STRENGTH SCORECARD                                                │
│  ┌──────────┬──────────┬──────────┬──────────┐                              │
│  │          │  Nifty   │ Nifty 500│   MSCI   │                              │
│  ├──────────┼──────────┼──────────┼──────────┤                              │
│  │ 1 Week   │  72 [g]  │  68 [g]  │  55 [y]  │                              │
│  │ 1 Month  │  81 [g]  │  79 [g]  │  62 [g]  │                              │
│  │ 3 Months │  85 [g]  │  83 [g]  │  71 [g]  │                              │
│  │ 6 Months │  78 [g]  │  76 [g]  │  68 [g]  │                              │
│  │ 1 Year   │  91 [g]  │  89 [g]  │  82 [g]  │                              │
│  │ 2 Years  │  74 [g]  │  72 [g]  │  65 [g]  │                              │
│  │ 3 Years  │  68 [g]  │  66 [g]  │  58 [y]  │                              │
│  └──────────┴──────────┴──────────┴──────────┘                              │
│                                                                             │
│  TECHNICAL SNAPSHOT          RISK METRICS                                   │
│  ┌─────────────┬─────────────┐  ┌──────────┬──────────┬──────────┐        │
│  │ RSI-14      │ 62.4 [y]    │  │ Sharpe   │ 1.24 [g] │          │        │
│  │ EMA-20      │ Above [g]   │  │ Sortino  │ 1.85 [g] │          │        │
│  │ EMA-50      │ Above [g]   │  │ Calmar   │ 0.92 [y] │          │        │
│  │ EMA-200     │ Above [g]   │  │ Max DD   │ -18.3%   │          │        │
│  │ MACD        │ Bullish [g] │  │ Beta     │ 1.05     │          │        │
│  │ % from 52W  │ -4.2% [y]   │  │ Volatility│ 22.1%   │          │        │
│  │ Golden Cross│ Yes [g]     │  │ Fragility│ LOW [g]  │          │        │
│  └─────────────┴─────────────┘  └──────────┴──────────┴──────────┘        │
│                                                                             │
│  VERDICT: ACCUMULATE — Add gradually. Leadership confirmed.                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Top quintile vs Nifty (85th percentile)                           │   │
│  │ ✓ Price above 20-day and 50-day EMA                                 │   │
│  │ ✓ Strong across 86% of timeframes                                   │   │
│  │ ⚠ Momentum flattening — monitor for weakening                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FOR NEW POSITIONS:    Add up to 5% under current regime.                  │
│  FOR EXISTING:         Hold and trail stop to 10% below 50-day EMA.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. TECHNICAL DECISIONS

| Decision | Rationale |
|----------|-----------|
| Keep Recharts | Already in codebase, sufficient for scatter + area + bar charts |
| Add `country` filter to all APIs | Separates India (IN) from Global (US, CN, etc.) |
| Add `period` param to all APIs | 1W/1M/3M/6M/12M toggle affects RS rank, returns, momentum |
| Add `benchmark` param | Nifty/Nifty500/MSCI/Gold affects which RS columns are used |
| Client-side sorting | SWR caches data; sorting in React avoids API roundtrips |
| Emojis for flags | 🇺🇸 🇮🇳 🇨🇳 — simple, no external flag library needed |
| Heatmap cells for factors | 0-25 red, 25-50 orange, 50-75 yellow, 75-100 green — instant readability |

---

## 8. ACCEPTANCE CRITERIA

A fund manager should be able to:
1. Land on the dashboard and in 3 seconds understand market health + sector rotation
2. Click any sector bubble and see a sorted list of stocks in that sector
3. Click any stock and see a dense evidence card with 20+ metrics + narrative
4. Go to Funds and see only relevant Indian MFs, ranked by 6 factors
5. See clear action badges (ACCUMULATE/EXIT/HOLD) on every instrument
6. Toggle period/benchmark and watch ALL numbers update
7. See no MF categories mixed into the sector list
8. See no global funds in the India leaders list

---

*Plan written: 23 Apr 2026*
*Next step: Approve plan → begin Phase 1 implementation*
