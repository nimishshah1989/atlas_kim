# ATLAS Unified Intelligence — Frontend Mockup Proposal v1

> Based on: Product Spec PDF Section 6, Marketpulse design reference, current codebase audit
> Status: PENDING APPROVAL — Do not build until signed off

---

## Design Philosophy

1. **Information density first** — Every pixel carries signal. No wasted whitespace.
2. **Action-oriented** — Every view answers: "What should I do?"
3. **Color as signal** — Green = accumulate, red = exit, gray = hold. No decorative color.
4. **Mobile-responsive** — Fund managers check on phones. Core data must reflow gracefully.
5. **Performance** — < 2s TTFB, < 100ms interaction response. Skeleton loaders for every async section.

---

## Global Design Tokens

```css
/* Actions — from spec Appendix B */
--action-strong-accumulate: #16A34A;  /* green-600 */
--action-accumulate:      #22C55E;  /* green-500 */
--action-hold:            #71717A;  /* zinc-500 */
--action-reduce:          #F97316;  /* orange-500 */
--action-exit:            #EF4444;  /* red-500 */
--action-avoid:           #27272A;  /* zinc-800 */

/* Health Zones */
--health-fear:    #EF4444;  /* < 25 */
--health-weak:    #F97316;  /* 25-40 */
--health-neutral: #A1A1AA;  /* 40-55 */
--health-healthy: #22C55E;  /* 55-70 */
--health-bullish: #16A34A;  /* > 70 */

/* Background */
--bg-primary:   #FFFFFF;
--bg-secondary: #F8FAFC;
--card-bg:      #FFFFFF;
--border:       #E2E8F0;

/* Typography */
--font-serif:  "Newsreader", Georgia, serif;  /* headlines */
--font-sans:   system-ui, -apple-system, sans-serif;  /* data, labels */
--text-primary:   #0F172A;
--text-secondary: #475569;
--text-tertiary:  #94A3B8;
```

---

## Shared Shell (`layout.tsx`)

Current layout is good. Minor enhancements:

```
┌─────────────────────────────────────────────────────────────────────┐
│ atlas.  Unified    Dashboard  Sectors  Funds  Leaders  Weakening  [G]│  ← 52px sticky header
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [page content, max-width 1400px, centered]                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Changes from current:**
- Add `Global` nav item → `/unified/global` (MSCI/Gold/FX pulse)
- Active tab: 2px bottom border in accent color (current) ✓
- Add a subtle gradient bar below header when scrolling (visual polish)

---

## Page 1: Dashboard (`/unified`)

### Wireframe (single column, stacked sections)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Unified Intelligence                                    Updated 3:45 PM│  ← title + DataFreshness
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐ │
│ │   [gauge]   │ │   MIXED         │ │  Sector Explorer →          │ │  ← TOP BAR (3 cols)
│ │     52      │ │   Regime:       │ │  Accumulate Leaders →       │ │
│ │   Health    │ │   CAUTION_DEFEN…│ │  Fund Rankings →            │ │
│ │ [CAUTION]   │ │                 │ │  Weakening Signals →        │ │
│ └─────────────┘ └─────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ "Market is cautious. 45% of stocks above 20-day EMA. Selective      │  ← NarrativePanel
│  deployment advised. 12 leaders emerging, 7 weakening."             │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ Leaders  │ │ Emerging │ │Weakening │ │ Fragile  │               │  ← METRIC CARDS
│ │   12     │ │    8     │ │    7     │ │    3     │               │
│ │  [grn]   │ │ [lt grn] │ │  [orn]   │ │  [red]   │               │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
├─────────────────────────────────────────────────────────────────────┤
│ Universe Bubble                              [Nifty 50 ▼] [3M ▼]   │  ← BUBBLE CHART
│                                                                      │
│                          ● Banking                                   │
│                    ● IT                                               │
│         ● Pharma                                                      │
│                              ● Auto                                   │
│                    ● Energy                                           │
│                                                                      │
│   0        20        40        60        80       100                │
│              ← Median RS Rank →                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Market Breadth                                                      │  ← BREADTH BARS
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Above EMA 20  ████████████████████░░░░░░░░░░░░░░░░░░░░  45%   │ │
│ │ Above EMA 50  ████████████████████████████░░░░░░░░░░░░  62%   │ │
│ │ Above EMA 200 ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  38%   │ │
│ │ Participation ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14%   │ │
│ └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ Leaders                                          View all →          │  ← LEADERS PREVIEW
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐        │
│ │ RELIANCE        │ │ TCS             │ │ HDFCBANK        │        │
│ │ ACCUMULATE  82  │ │ STRONG_ACC… 91  │ │ ACCUMULATE  78  │        │
│ │ · Energy        │ │ · IT            │ │ · Banking       │        │
│ │ RS: 72  3M:+12% │ │ RS: 89  3M:+18% │ │ RS: 68  3M:+9%  │        │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Detailed Specifications

#### 1.1 Top Bar (3-column grid)

| Element | Data Source | Interaction |
|---------|------------|-------------|
| RegimeGauge | `/api/unified/regime` → `health_score`, `health_zone`, `regime` | None (static display) |
| Direction Card | `/api/unified/regime` → `direction`, `regime` | None |
| Quick Links | Static | Navigation links |

**RegimeGauge:** Circular SVG gauge, 52px radius, 8px stroke. Color zones from spec.

#### 1.2 Metric Cards (4-column grid, auto-fit minmax 180px)

| Card | Source | Color | Click Action |
|------|--------|-------|-------------|
| Leaders | `state = 'LEADER'` count | `#16A34A` | → `/unified/leaders` |
| Emerging | `state = 'EMERGING'` count | `#22C55E` | None (future: filter) |
| Weakening | `state = 'WEAKENING'` count | `#F97316` | → `/unified/weakening` |
| Fragile | `state = 'LAGGING' OR frag_score > 70` count | `#EF4444` | None |

**Current gap:** API doesn't expose these counts. Need `GET /api/unified/regime` to include `state_counts` object.

#### 1.3 Bubble Chart

**Current issue:** Bubbles not rendering. Root causes:
1. `bubble_x`, `bubble_y`, `bubble_size` may be null in API response
2. Fallback to `median_rs_rank` / `median_ret_3m` / `member_count` may also be null
3. Colors using CSS variables that may not resolve

**Fix:** 
- Ensure backend `get_cohort_aggregate` always computes these fields
- Add defensive `?? 0` fallbacks in frontend
- Use inline hex colors instead of CSS variables for Recharts

**Interaction:** Click bubble → router.push(`/unified/sectors/${key}`)

#### 1.4 Breadth Bars

**Current gap:** No BreadthBar component exists. Need to build.

```tsx
// Props: label, value (0-100), colorZone, onClick?
// Visual: Full-width bar, 8px height, rounded. Filled portion = value%.
// Color: green if > 50, orange if 30-50, red if < 30
// Label left, percentage right
```

Data source: `/api/unified/regime` → `breadth` object with `pct_above_ema20`, `pct_above_ema50`, `pct_above_ema200`, `participation`.

#### 1.5 Leaders Preview

**Current issue:** EvidenceCard shows sparse data (many "—"). 

**Fix:** Backend `/api/unified/screen` must return all fields needed for card display, or EvidenceCard must gracefully handle nulls with smaller, more focused layout.

---

## Page 2: Instrument Detail (`/unified/instrument/[id]`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back                    RELIANCE               [ACCUMULATE  82]   │  ← HEADER
│                           Reliance Industries Ltd                   │
│                           ₹2,485.50  · Energy  → sector            │
├─────────────────────────────────────────────────────────────────────┤
│ [Price Chart Area — 300px height]                                   │  ← PRICE CHART
│ EMA 20 ───  EMA 50 ───  EMA 200 ───                               │
│                                                                      │
│ Volume ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
├─────────────────────────────────────────────────────────────────────┤
│ RS Scorecard                    [Nifty 50 ▼]                       │  ← RS SCORECARD
│ ┌──────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐             │
│ │          │ 1D  │ 1W  │ 1M  │ 3M  │ 6M  │ 12M │ 24M │             │
│ ├──────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤             │
│ │ Nifty    │ —   │ 58  │ 62  │ 72  │ 65  │ 58  │ —   │             │
│ │ Nifty 500│ —   │ —   │ —   │ 68  │ —   │ 55  │ —   │             │
│ │ MSCI     │ —   │ —   │ —   │ 71  │ —   │ —   │ —   │             │
│ │ Gold     │ —   │ —   │ —   │ 45  │ —   │ —   │ —   │             │
│ └──────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘             │
│ (Cells: green ≥60, yellow 40-60, red <40)                           │
├─────────────────────────────────────────────────────────────────────┤
│ VERDICT                                                             │  ← NARRATIVE PANEL
│ "Add Reliance gradually. Leadership confirmed but momentum           │
│  flattening."                                                       │
│                                                                      │
│ Confirming Factors                    Risk Factors                  │
│ ▼ Nifty Relative Strength            ▼ Trend Structure              │
│   Top quintile (72nd percentile)       Momentum flattening            │
│   Outperforms 72% of market          ▼ Market Environment           │
│ ▼ Trend                                Bearish regime — caution       │
│   Price above 20-day and 50-day EMA                                 │
│ ▼ Global Flow                                                        │
│   Outperforming global equities (71st percentile)                   │
├─────────────────────────────────────────────────────────────────────┤
│ Recommended Action                                                  │
│ ┌─────────────────┬─────────────────┬─────────────────┐             │
│ │ For New Positions│ For Existing    │ Position Size   │             │
│ │                  │ Positions       │ Guidance        │             │
│ │ "Add gradually.  │ "Hold existing. │ "Max 5% of      │             │
│ │  Wait for EMA    │  Do not add     │  portfolio in   │             │
│ │  confirmation."  │  until RS       │  this instrument│             │
│ │                  │  slope turns    │  under current  │             │
│ │                  │  positive."     │  regime."       │             │
│ └─────────────────┴─────────────────┴─────────────────┘             │
├─────────────────────────────────────────────────────────────────────┤
│ Technical Snapshot                                                  │  ← TECHNICALS
│ ┌────────┬────────┬────────┬────────┬────────┐                     │
│ │ RSI 14 │ EMA 20 │ EMA 50 │EMA 200 │ 52W Hi │                     │
│ │  62.3  │ Above  │ Above  │ Above  │ -8.5%  │                     │
│ └────────┴────────┴────────┴────────┴────────┘                     │
├─────────────────────────────────────────────────────────────────────┤
│ Risk Metrics                                                        │  ← RISK
│ ┌────────┬────────┬────────┬────────┬────────┐                     │
│ │ Sharpe │Sortino │ Calmar │ Max DD │ Beta   │                     │
│ │  1.24  │  1.89  │  0.82  │ -18.3% │  0.94  │                     │
│ └────────┴────────┴────────┴────────┴────────┘                     │
├─────────────────────────────────────────────────────────────────────┤
│ Context                                                             │  ← CONTEXT
│ Sector: Energy  [LEADER]  Breadth: 68%  Fragility: Low              │
│ Market: CAUTION_DEFENSIVE  Health: 52/100  Direction: MIXED         │
└─────────────────────────────────────────────────────────────────────┘
```

### For MF/ETF — Additional Section

```
┌─────────────────────────────────────────────────────────────────────┐
│ Look-Through (Holdings as of 15-Apr-2026)        [stale?]           │
│ ┌──────────┬────────────┬────────┬────────────────┐                │
│ │ Holding  │ Weight %   │ Action │ RS 3M Rank     │                │
│ ├──────────┼────────────┼────────┼────────────────┤                │
│ │ RELIANCE │    8.2%    │ ACCUM… │     72.3       │                │
│ │ HDFCBANK │    6.1%    │ ACCUM… │     68.1       │                │
│ │ ...      │    ...     │ ...    │     ...        │                │
│ └──────────┴────────────┴────────┴────────────────┘                │
│ Switch to: [Top Ranked Fund in Category]                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Gaps vs Spec

| Spec Requirement | Current State | Gap |
|-----------------|---------------|-----|
| Price chart with EMA overlays | Not present | Need Recharts AreaChart + EMA lines |
| RS Scorecard 7×4 grid | Only 5 periods × 5 benchmarks, many nulls | Need all 40 columns populated in backend |
| Narrative panel with expandable lists | Shows only verdict + one-line summary | Need full structured narrative JSON |
| Technical snapshot grid | EvidenceCard has 10 metric boxes | Need dedicated section on detail page |
| Risk metrics (Sharpe, etc.) | Not present | Need backend to compute/store |
| Context section | Not present | Need sector + market context cards |
| Look-through panel | Not present | Need MF holdings pipeline first |

---

## Page 3: Sectors (`/unified/sectors`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sector Explorer                              [Nifty 50 ▼] [3M ▼]   │
│                                                                      │
│ [Full-width bubble chart — same as dashboard, all sectors]           │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Sector Table                                                         │
│ ┌────────────┬─────────┬────────┬────────┬────────┬────────┐        │
│ │ Sector     │ Stocks  │ Med RS │ Med 3M │ Action │ Frag   │        │
│ ├────────────┼─────────┼────────┼────────┼────────┼────────┤        │
│ │ Banking    │   42    │  68.2  │ +14.2% │ ACCUM… │ Low    │        │
│ │ IT         │   38    │  72.1  │ +18.5% │ STRONG…│ Low    │        │
│ │ Energy     │   24    │  58.3  │  +9.1% │ HOLD   │ Med    │        │
│ │ ...        │   ...   │  ...   │  ...   │ ...    │ ...    │        │
│ └────────────┴─────────┴────────┴────────┴────────┴────────┘        │
│ (Click row → sector detail)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Page 4: Sector Detail (`/unified/sectors/[name]`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back    BANKING                                    [LEADER]       │
│           42 stocks · Median RS: 68.2 · Median 3M: +14.2%           │
├─────────────────────────────────────────────────────────────────────┤
│ [Bubble chart — stocks IN this sector, colored by individual action] │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Sector Breadth                                                       │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                        │
│ │ % > EMA 20 │ │ % > EMA 50 │ │ % > EMA 200│                        │
│ │    62%     │ │    58%     │ │    45%     │                        │
│ └────────────┘ └────────────┘ └────────────┘                        │
├─────────────────────────────────────────────────────────────────────┤
│ Stocks in Banking                                                    │
│ ┌──────────┬────────┬────────┬────────┬────────┬────────┐           │
│ │ Symbol   │ Price  │ RS 3M  │ Ret 3M │ Action │ RSI    │           │
│ ├──────────┼────────┼────────┼────────┼────────┼────────┤           │
│ │ HDFCBANK │ 1,685  │  71.2  │ +16.2% │ ACCUM… │  58    │           │
│ │ ICICIBANK│ 1,245  │  68.5  │ +14.8% │ ACCUM… │  62    │           │
│ │ ...      │ ...    │  ...   │  ...   │ ...    │  ...   │           │
│ └──────────┴────────┴────────┴────────┴────────┴────────┘           │
│ (Click row → instrument detail)                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Page 5: Leaders (`/unified/leaders`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Accumulate Leaders                                                   │
│                                                                      │
│ Filter: [All Actions ▼] [All Sectors ▼] [Min RS: 0] [Max: 100]     │
│ Sort: [RS 3M Rank ▼]                                                │
│                                                                      │
│ ┌──────────┬────────┬────────┬────────┬────────┬────────┐           │
│ │ Symbol   │ Name   │ Sector │ RS 3M  │ Action │ Conf   │           │
│ ├──────────┼────────┼────────┼────────┼────────┼────────┤           │
│ │ TCS      │ Tata … │ IT     │  89.2  │ STRONG…│  91    │           │
│ │ RELIANCE │ Reli…  │ Energy │  72.3  │ ACCUM… │  82    │           │
│ │ ...      │ ...    │ ...    │  ...   │ ...    │  ...   │           │
│ └──────────┴────────┴────────┴────────┴────────┴────────┘           │
│                                                                  1-50│
│ [Previous] [1] [2] [3] ... [12] [Next]                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Current gap:** Table view not built. Currently shows EvidenceCard grid. Need switchable view: Card grid ↔ Table.

---

## Page 6: Funds (`/unified/funds`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Fund Rankings                                                        │
│                                                                      │
│ Category: [All ▼]  [Large Cap] [Mid Cap] [Small Cap] [Flexi] [ELSS] │  ← Pill selectors
│                                                                      │
│ Sort: [RS 3M ▼] [RS 12M] [Consistency] [Sharpe]                     │
│                                                                      │
│ ┌────────────┬──────────┬────────┬────────┬────────┬────────┐       │
│ │ Fund       │ Category │ RS 3M  │ RS 12M │ Consist│ Action │       │
│ ├────────────┼──────────┼────────┼────────┼────────┼────────┤       │
│ │ Nippon Ind…│ Large Cap│  78.2  │  72.1  │  0.85  │ ACCUM… │       │
│ │ HDFC Top … │ Large Cap│  65.3  │  68.4  │  0.72  │ HOLD   │       │
│ │ ...        │ ...      │  ...   │  ...   │  ...   │ ...    │       │
│ └────────────┴──────────┴────────┴────────┴────────┴────────┘       │
│ (Click row → fund x-ray)                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Fund Detail (`/unified/funds/[id]`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back    Nippon India Growth Fund          [ACCUMULATE  78]        │
│           Large Cap · Direct · Growth · AUM ₹12,450 Cr              │
├─────────────────────────────────────────────────────────────────────┤
│ 6-Factor Positioning                                                 │
│                                                                      │
│      RS 3M Rank          Consistency Score         Sharpe Ratio      │
│        [72]                  [0.85]                  [1.24]          │
│                                                                      │
│      Volatility Adj        Trend Strength          Lookthrough Quality│
│        [68]                  [0.72]                  [0.81]          │
│                                                                      │
│ (No composite score. Six independent dimensions.)                   │
├─────────────────────────────────────────────────────────────────────┤
│ Look-Through Holdings                                                │
│ ┌──────────┬────────────┬────────┬────────────────┐                │
│ │ Holding  │ Weight %   │ Action │ RS 3M Rank     │                │
│ ├──────────┼────────────┼────────┼────────────────┤                │
│ │ RELIANCE │    8.2%    │ ACCUM… │     72.3       │                │
│ │ HDFCBANK │    6.1%    │ ACCUM… │     68.1       │                │
│ │ ...      │    ...     │ ...    │     ...        │                │
│ └──────────┴────────────┴────────┴────────────────┘                │
│                                                                      │
│ Sector Allocation (from holdings):                                   │
│ Banking 32%  IT 24%  Energy 18%  Auto 12%  Others 14%               │
├─────────────────────────────────────────────────────────────────────┤
│ Switch to: [Higher ranked fund in same category]                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Page 7: Global Pulse (`/unified/global`)

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ Global Pulse                                                         │
│                                                                      │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│ │ MSCI World │ │    Gold    │ │ USD/INR    │ │  Crude     │        │
│ │   [gauge]  │ │   [gauge]  │ │   [gauge]  │ │   [gauge]  │        │
│ │    58      │ │    72      │ │    45      │ │    38      │        │
│ │  Healthy   │ │  Bullish   │ │  Neutral   │ │   Weak     │        │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘        │
│                                                                      │
│ [Mini price sparklines for each — 7 days]                           │
│                                                                      │
│ Cross-Asset RS Matrix                                                │
│ ┌──────────┬────────┬────────┬────────┐                            │
│ │ vs →     │ Nifty  │ MSCI   │ Gold   │                            │
│ ├──────────┼────────┼────────┼────────┤                            │
│ │ Nifty    │   —    │  52    │  68    │                            │
│ │ MSCI     │  48    │   —    │  45    │                            │
│ │ Gold     │  32    │  55    │   —    │                            │
│ └──────────┴────────┴────────┴────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Inventory (Build List)

### New Components Required

| Component | File | Complexity | Blocked By |
|-----------|------|-----------|-----------|
| BreadthBar | `components/unified/BreadthBar.tsx` | Low | None |
| PriceChart | `components/unified/PriceChart.tsx` | Medium | Price history API |
| MetricCards | `components/unified/MetricCards.tsx` | Low | API state_counts |
| FundCard | `components/unified/FundCard.tsx` | Medium | MF data pipeline |
| FundXray | `components/unified/FundXray.tsx` | High | MF holdings + rankings |
| GlobalPulse | `components/unified/GlobalPulse.tsx` | Medium | Global index data |
| Sparkline | `components/unified/Sparkline.tsx` | Low | None |
| DataTable | `components/unified/DataTable.tsx` | Medium | None |

### Components to Refactor

| Component | Current Issues | Fixes |
|-----------|---------------|-------|
| BubbleChart | No visible bubbles, CSS var colors | Inline hex colors, defensive nulls |
| EvidenceCard | Sparse data, wrong for list vs detail | Two modes: compact (list) vs full (detail) |
| RSScorecard | Only 5 periods, many nulls | Add 1D/24M/36M, populate all in backend |
| NarrativePanel | Only shows verdict line | Full structured narrative with expandables |
| RegimeGauge | Good, minor color fix needed | Match spec exactly |

---

## API Gaps to Close

| Endpoint | Missing Field | Priority |
|----------|--------------|----------|
| `GET /regime` | `state_counts` (Leader/Emerging/Weakening/Fragile) | High |
| `GET /regime` | `breadth` object with pct_above_ema20/50/200 | High |
| `GET /snapshot/{id}` | Full narrative JSON (verdict, factors, risks, action) | High |
| `GET /snapshot/{id}` | Technical snapshot (RSI, EMAs, MACD, 52W hi) | High |
| `GET /snapshot/{id}` | Risk metrics (Sharpe, Sortino, Calmar, Max DD, Beta) | Medium |
| `GET /snapshot/{id}` | Sector context + Market context | Medium |
| `POST /screen` | All fields needed for EvidenceCard (ret_1m, ret_6m, frag_level, etc.) | High |
| `GET /aggregate` | Ensure `bubble_x`, `bubble_y`, `bubble_size` always populated | High |
| `GET /funds/*` | ALL MF endpoints — new | High (after data pipeline) |

---

## Build Order (After Approval)

### Phase A: Dashboard Fixes (1-2 days)
1. Fix BubbleChart (inline colors, null defense)
2. Build BreadthBar component
3. Add state_counts to `/regime` API
4. Build MetricCards component
5. Redesign dashboard layout per wireframe

### Phase B: Instrument Detail (2-3 days)
1. Build PriceChart (AreaChart + EMA overlays)
2. Expand RSScorecard to 7 periods
3. Build full NarrativePanel with expandables
4. Build Technical Snapshot grid
5. Build Risk Metrics grid
6. Build Context section

### Phase C: List Views (1-2 days)
1. Build DataTable component (sortable, filterable)
2. Redesign Leaders page (table view)
3. Redesign Weakening page (table view)
4. Add view toggle: Card ↔ Table

### Phase D: MF Pages (2-3 days, blocked on data)
1. Build FundCard component
2. Build FundXray with 6-factor positioning
3. Build Funds list page with pill selectors
4. Build Fund detail with look-through

### Phase E: Global Pulse (1 day)
1. Build GlobalPulse component
2. Build sparkline mini-charts
3. Cross-asset RS matrix

---

## Open Questions for You

1. **Fund detail look-through:** The spec shows holdings with individual RS ranks. This requires the MF holdings pipeline (Morningstar + NAV + sector mapping). Should I build the UI skeleton now with placeholder data, or wait until the pipeline is complete?

2. **Price chart:** The spec mentions "placeholder for TradingView integration in Phase 2." Should I build a Recharts AreaChart with EMA overlays now, or use a simpler sparkline and wait for TradingView?

3. **Color for metric cards:** The spec says Leaders=green, Emerging=light green, Weakening=orange, Fragile=red. Should Fragile include both LAGGING and high frag_score stocks, or only one criterion?

4. **Mobile priority:** Should I optimize for desktop-first (fund manager at desk) or ensure mobile works from day one?

5. **Table vs Card preference:** For list views (Leaders, Weakening, Funds), do you prefer the dense table view (like marketpulse) or card grid (like current), or a toggle between both?

---

*Mockup proposal ready for review. Awaiting your approval before any code is written.*
