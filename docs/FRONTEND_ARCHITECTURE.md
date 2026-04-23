# ATLAS-KIM Frontend Architecture

> **Version:** 2026-04-23  
> **Status:** Design proposal — ready for implementation  
> **Prerequisite:** Backend validation complete (4,257 instruments, 100% metrics coverage)

---

## 1. DESIGN PHILOSOPHY

The backend is now a **data powerhouse**. The frontend's job is to make that power feel obvious, immediate, and actionable.

### Core Principles

1. **Action over information** — Every view answers "What should I do?" before "What is this?"
2. **Color is signal** — Green = accumulate, red = exit, gray = hold. No decorative color. No gradients for decoration.
3. **Density without clutter** — Fund managers want to scan 50 rows in 10 seconds. Use compact tables, sparklines, and micro-badges.
4. **Progressive disclosure** — Surface the verdict first. Let users drill into the evidence.
5. **Mobile-first thinking** — Portfolio managers check positions on phones at market open. Core verdicts must be thumb-readable.

### Mental Model

The user is not "browsing." The user is **deploying capital**. Every screen is a decision-support system:

- **Should I buy?** → Check dashboard health + leaders + fund rankings
- **Should I sell?** → Check weakening signals + instrument snapshot
- **Where should I allocate?** → Check sector explorer + global pulse + fund screener
- **Is my fund any good?** → Check fund x-ray + factor radar + holdings quality

---

## 2. PAGE ARCHITECTURE

### 2.1 Global Shell (`/unified/layout.tsx`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ atlas.    Dashboard    Sectors    Funds    Leaders    Weakening    Global  │  ← 52px sticky
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                     │  │
│  │                    [page content, max-width 1440px]                │  │
│  │                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Nav items:**
- **Dashboard** — Market posture, top-level signals
- **Sectors** — Sector explorer + sector detail
- **Funds** — MF/ETF rankings + screener
- **Leaders** — Stocks in LEADER state
- **Weakening** — Stocks transitioning to WEAKENING
- **Global** — World indices, US ETFs, commodities, FX

**Global elements:**
- Regime badge in header (e.g., "CAUTION_DEFENSIVE")
- Data freshness indicator ("Updated 3:45 PM IST")
- Benchmark selector dropdown (Nifty 50 / Nifty 500 / S&P 500 / MSCI World / Gold)
- Period selector (1M / 3M / 6M / 12M)

---

### 2.2 Dashboard (`/unified`) — THE COMMAND CENTER

**Purpose:** Answer "What's the market telling me right now?" in 5 seconds.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Unified Intelligence                                    Updated 3:45 PM IST │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────────────────────────┐ │
│ │             │ │  CAUTION         │ │  Quick Links                        │ │
│ │    [52]     │ │  REGIME:         │ │  • Sector Explorer →               │ │
│ │   Health    │ │  Defensive       │ │  • Top Funds →                     │ │
│ │   Score     │ │  posture         │ │  • Weakening Signals →             │ │
│ │  [gauge]    │ │  advised.        │ │  • Global Pulse →                  │ │
│ └─────────────┘ └─────────────────┘ └─────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ "Market is cautious. 45% of stocks above 20-day EMA. Selective deployment   │
│  advised. 12 leaders emerging, 7 weakening."                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Leaders  │ │ Emerging │ │Weakening │ │ Fragile  │ │ Neutral  │          │
│ │   12     │ │    8     │ │    7     │ │    3     │ │   45     │          │
│ │ [green]  │ │[lt green]│ │ [orange] │ │  [red]   │ │  [gray]  │          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Universe Bubble Chart                    [Nifty 50 ▼] [3M ▼]               │
│                                                                             │
│        ● Banking (LEADER)                                                   │
│   ● IT        ● Auto                                                        │
│        ● FMCG         ● Pharma                                              │
│              ● Energy                                                       │
│                                                                             │
│  X: Avg RS Rank    Y: Avg Momentum    Size: Market Cap    Color: Action   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Top Leaders                          Top Funds (by lookthrough RS)          │
│ ┌────┬─────────────┬────┬────────┐  ┌────┬─────────────────┬────┬────────┐ │
│ │ #  │ Name        │ RS │ Action │  │ #  │ Fund            │ LT  │ Action │ │
│ │ 1  │ Reliance    │ 94 │ ACC    │  │ 1  │ PPFAS Flexi Cap │ 88  │ ACC    │ │
│ │ 2  │ TCS         │ 91 │ ACC    │  │ 2  │ Quant Active    │ 85  │ ACC    │ │
│ │ 3  │ HDFC Bank   │ 89 │ ACC    │  │ 3  │ Parag Parikh    │ 82  │ ACC    │ │
│ └────┴─────────────┴────┴────────┘  └────┴─────────────────┴────┴────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Sector Health Bars                                                          │
│ Banking    ████████████████████████████████████████░░░░░  78%  [HEALTHY]   │
│ IT         ██████████████████████████████░░░░░░░░░░░░░░░  62%  [HEALTHY]   │
│ Auto       ██████████████████████████░░░░░░░░░░░░░░░░░░░  55%  [NEUTRAL]   │
│ Energy     ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  28%  [WEAK]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Health gauge: `GET /api/unified/regime`
- State counts: `GET /api/unified/aggregate?cohort_type=state`
- Bubble chart: `GET /api/unified/aggregate?cohort_type=sector`
- Top leaders: `GET /api/unified/screen` with `state=LEADER`
- Top funds: `GET /api/unified/funds/rankings?sort_by=lookthrough_rs_3m&limit=5`
- Sector health: `GET /api/unified/aggregate?cohort_type=sector`

---

### 2.3 Sector Explorer (`/unified/sectors`) — THE MAP

**Purpose:** Answer "Which sectors are strong? Where should I look?"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sector Explorer                                    [Nifty 50 ▼] [3M ▼]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bubble Chart                                                                │
│                                                                             │
│  ● Banking          ● IT                                                    │
│       ● Auto                                                                │
│            ● Pharma                                                         │
│                                                                             │
│  Click any bubble to drill into sector detail                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Sector Table                                                                │
│ ┌───────────┬─────┬────────┬─────────┬──────────┬─────────┬──────────────┐  │
│ │ Sector    │Stocks│Leaders │Emerging │Weakening │Avg RS   │ Health       │  │
│ ├───────────┼─────┼────────┼─────────┼──────────┼─────────┼──────────────┤  │
│ │ Banking   │ 45  │   8    │    5    │    2     │  78.2   │ [HEALTHY]    │  │
│ │ IT        │ 52  │   6    │    4    │    3     │  65.4   │ [HEALTHY]    │  │
│ │ Auto      │ 28  │   3    │    2    │    1     │  54.1   │ [NEUTRAL]    │  │
│ │ Energy    │ 15  │   1    │    1    │    4     │  32.5   │ [WEAK]       │  │
│ └───────────┴─────┴────────┴─────────┴──────────┴─────────┴──────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click bubble → navigates to `/unified/sectors/[name]`
- Click sector row → navigates to `/unified/sectors/[name]`
- Benchmark/period selectors re-render both bubble and table

---

### 2.4 Sector Detail (`/unified/sectors/[name]`) — THE BATTLEFIELD

**Purpose:** Answer "What should I buy/sell WITHIN this sector?"

**Critical requirement from user:** 3 sub-tabs — Stocks / Mutual Funds / ETFs

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Banking Sector                                    [Nifty 50 ▼] [3M ▼]      │
│                                                                             │
│ Health Score: 78 [HEALTHY]    Leaders: 8    Emerging: 5    Weakening: 2     │
│ "Banking is in a healthy posture. Large-cap private banks showing relative   │
│  strength. PSU banks mixed. Selective accumulation advised."                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Stocks]  [Mutual Funds]  [ETFs]                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ STOCKS TAB:                                                                 │
│ ┌────┬──────────────┬─────┬──────┬────────┬────┬───────┬──────────────┐    │
│ │ #  │ Name         │ RS  │ Ret  │ State  │RSI │ Action│ Sparkline    │    │
│ ├────┼──────────────┼─────┼──────┼────────┼────┼───────┼──────────────┤    │
│ │ 1  │ HDFC Bank    │ 92  │ +12% │ LEADER │ 68 │ ACC   │ ▁▂▄▆▇███▇   │    │
│ │ 2  │ ICICI Bank   │ 89  │ +10% │ LEADER │ 62 │ ACC   │ ▁▂▄▆▇██▇▇   │    │
│ │ 3  │ Axis Bank    │ 71  │  +5% │ EMERGE │ 58 │ ACC   │ ▁▃▄▆▇▇▇▆▅   │    │
│ │ 4  │ SBI          │ 45  │  -2% │ NEUTRAL│ 48 │ HOLD  │ ▅▆▇▇▆▅▃▂▁   │    │
│ └────┴──────────────┴─────┴──────┴────────┴────┴───────┴──────────────┘    │
│                                                                             │
│ MUTUAL FUNDS TAB:                                                           │
│ ┌────┬────────────────────┬─────────┬──────┬────────┬────────┬──────────┐  │
│ │ #  │ Fund               │ Category│ LT RS│ Leaders│ Action │ Factor   │  │
│ ├────┼────────────────────┼─────────┼──────┼────────┼────────┼──────────┤  │
│ │ 1  │ Axis Banking Fund  │Banking  │ 82   │ 65%    │ ACC    │ [radar]  │  │
│ │ 2  │ SBI Banking Fund   │Banking  │ 74   │ 58%    │ ACC    │ [radar]  │  │
│ └────┴────────────────────┴─────────┴──────┴────────┴────────┴──────────┘  │
│                                                                             │
│ ETFs TAB:                                                                   │
│ ┌────┬─────────────┬──────┬────────┬────────┬────────┐                     │
│ │ #  │ ETF         │ LT RS│ Leaders│ Action │ Factor │                     │
│ ├────┼─────────────┼──────┼────────┼────────┼────────┤                     │
│ │ 1  │ NIFTY BEES  │ 78   │ 62%    │ ACC    │ [radar]│                     │
│ └────┴─────────────┴──────┴────────┴────────┴────────┘                     │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Stocks: `GET /api/unified/screen` with `sector=[name]`
- MFs: `GET /api/unified/funds/screen` with `sector=[name]` (funds whose dominant_sectors include this sector)
- ETFs: `GET /api/unified/funds/screen` with `instrument_type=ETF` + sector filter

**MFs appear** if the sector is in their `dominant_sectors` JSONB (top 2-3 sectors by weight).

---

### 2.5 Funds Rankings (`/unified/funds`) — THE HEATMAP

**Purpose:** Answer "Which funds are objectively strong across ALL dimensions?"

**Critical requirement:** No composite score. 6 independent factors. Color-coded heatmap.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fund Rankings                                                               │
│                                                                             │
│ [Category ▼: All] [Cap Tilt ▼: All] [Min AUM ▼: 0] [Sort: Momentum ▼]     │
│                                                                             │
│ ┌────────────────────┬────┬────┬────┬────┬────┬────┬────┬────────┬────────┐│
│ │ Fund               │Mom │Qual│Res │Hold│Cost│Con │Cap │ AUM    │ Action ││
│ ├────────────────────┼────┼────┼────┼────┼────┼────┼────┼────────┼────────┤│
│ │ PPFAS Flexi Cap    │ 92 │ 88 │ 85 │ 90 │ 78 │ 82 │ Lg │ 45,200 │ ACC    ││
│ │ Quant Active Fund  │ 90 │ 75 │ 80 │ 85 │ 65 │ 88 │ Lg │ 12,800 │ ACC    ││
│ │ Parag Parikh Flexi │ 88 │ 90 │ 82 │ 87 │ 85 │ 80 │ Lg │ 68,500 │ ACC    ││
│ │ Axis Bluechip      │ 75 │ 82 │ 78 │ 72 │ 70 │ 75 │ Lg │ 32,100 │ ACC    ││
│ │ HDFC Index Nifty   │ 68 │ 65 │ 70 │ 65 │ 92 │ 72 │ Lg │ 8,500  │ HOLD   ││
│ └────────────────────┴────┴────┴────┴────┴────┴────┴────┴────────┴────────┘│
│                                                                             │
│ Legend:  0-25 [red]  25-50 [orange]  50-75 [yellow]  75-100 [green]        │
│                                                                             │
│ Click any row → Fund X-Ray                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Factor columns:**
- **Mom** = Momentum (NAV RS + trend)
- **Qual** = Risk-Adjusted Quality (Sharpe, Sortino, Calmar)
- **Res** = Resilience (inverted drawdown + low vol)
- **Hold** = Holdings Quality (lookthrough RS + leader % + concentration)
- **Cost** = Cost Efficiency (inverted expense ratio + AUM)
- **Con** = Consistency (positive return streaks + low std dev)

**Data source:** `GET /api/unified/funds/rankings`

---

### 2.6 Fund X-Ray (`/unified/funds/[id]`) — THE AUTOPSY

**Purpose:** Answer "Should I hold this fund? Is it actually good or just lucky?"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Funds                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Parag Parikh Flexi Cap Fund    [ACCUMULATE]                                 │
│ Regular Plan · Growth · Flexi-Cap · AUM: ₹68,500 Cr · Expense: 0.62%       │
│ Benchmark: Nifty 500                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌──────────────────────────────────────────────┐ │
│ │                        │ │                                              │ │
│ │    [RADAR CHART]       │ │  6-Factor Analysis                          │ │
│ │                        │ │                                              │ │
│ │      Momentum          │ │  Momentum        88  ████████████████████   │ │
│ │         ●              │ │  Quality         90  ████████████████████   │ │
│ │        /|\             │ │  Resilience      82  ██████████████████░░   │ │
│ │       / | \            │ │  Holdings        87  ████████████████████   │ │
│ │      /  |  \           │ │  Cost            85  ████████████████████   │ │
│ │  Hold---●---Cost       │ │  Consistency     80  ███████████████████░   │ │
│ │      \  |  /           │ │                                              │ │
│ │       \ | /            │ │  vs Category Median (dashed line)            │ │
│ │        \|/             │ │                                              │ │
│ │         ●              │ │                                              │ │
│ │     Resilience         │ │                                              │ │
│ │                        │ │                                              │ │
│ └────────────────────────┘ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Evidence Card                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ NAV RS 3M: 82nd percentile    Lookthrough RS: 87    Action: ACCUMULATE  │ │
│ │ Above 50-EMA: Yes             Leaders in holdings: 65%                 │ │
│ │ Sharpe 1Y: 1.45               Top sector: Financial Services           │ │
│ │ Max DD 1Y: -8.2%              Concentration (top 10): 42%              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Holdings (Top 20)                                                           │
│ ┌────┬──────────────┬────────┬────┬────────┬────────┬────────┐             │
│ │ #  │ Name         │ Weight │ RS │ State  │ Sector │ Action │             │
│ ├────┼──────────────┼────────┼────┼────────┼────────┼────────┤             │
│ │ 1  │ HDFC Bank    │  8.5%  │ 92 │ LEADER │ Bank   │ ACC    │             │
│ │ 2  │ ICICI Bank   │  7.2%  │ 89 │ LEADER │ Bank   │ ACC    │             │
│ │ 3  │ ITC          │  5.8%  │ 72 │ EMERGE │ FMCG   │ ACC    │             │
│ │ 4  │ Reliance     │  5.1%  │ 68 │ NEUTRAL│ Energy │ HOLD   │             │
│ └────┴──────────────┴────────┴────┴────────┴────────┴────────┘             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Sector Allocation                                                           │
│ ┌────────────────────────┐ ┌────────────────────────────────────────────┐  │
│ │    [DONUT CHART]       │ │  Financial Services    35%  ████████░░░░  │  │
│ │                        │ │  Technology            22%  █████░░░░░░░  │  │
│ │    Bank     IT         │ │  Consumer Staples      15%  ███░░░░░░░░░  │  │
│ │       \   /            │ │  Energy                12%  ██░░░░░░░░░░  │  │
│ │        \ /             │ │  Healthcare             8%  █░░░░░░░░░░░  │  │
│ │    FMCG — Energy       │ │  Others                 8%  █░░░░░░░░░░░  │  │
│ │                        │ │                                            │  │
│ └────────────────────────┘ └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cap Tilt                                                                    │
│ Large: 55% ██████████████████████████  Mid: 30% ██████████████  Small: 15% │
├──────────────────────────────────────────────────────────────────────────────┤
│ Narrative                                                                   │
│ "This fund demonstrates strong momentum with an 82nd percentile NAV RS rank.│
│  Holdings quality is excellent — 65% of portfolio is in LEADER-state stocks.│
│  The fund is concentrated in Financial Services (35%) which is currently    │
│  the strongest sector. Expense ratio of 0.62% is reasonable for the category│
│  Sharpe ratio of 1.45 indicates good risk-adjusted returns. Recommended    │
│  action: ACCUMULATE."                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Header + evidence: `GET /api/unified/snapshot/{id}`
- Factor radar: `GET /api/unified/funds/{id}/xray`
- Holdings table: `GET /api/unified/funds/{id}/holdings`
- Sector donut: computed from holdings response
- Narrative: `snapshot.narrative` JSONB

---

### 2.7 Instrument Detail (`/unified/instrument/[id]`) — THE DOSSIER

**Purpose:** Answer "What's the story on THIS specific stock/ETF/index?"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HDFC Bank Ltd    [LEADER]    [ACCUMULATE]                                   │
│ Banking · NSE · Large Cap                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌──────────────────────────────────────────────┐ │
│ │  RS Rank vs Nifty 50   │ │  Evidence                                   │ │
│ │                        │ │                                             │ │
│ │  3M:  92  ████████░░   │ │  Return 3M:    +12.4%                      │ │
│ │  6M:  88  ████████░░   │ │  Return 12M:   +28.1%                      │ │
│ │  12M: 85  ████████░░   │ │  RSI-14:       68 (neutral)                │ │
│ │  24M: 79  ███████░░░   │ │  MACD:         Bullish crossover           │ │
│ │                        │ │  Above 50-EMA: Yes                         │ │
│ │  [vs Nifty 500]        │ │  Max DD 1Y:    -8.2%                       │ │
│ │  3M:  89  ████████░░   │ │  Fragility:    LOW (0.32)                  │ │
│ │  12M: 82  ████████░░   │ │                                             │ │
│ └────────────────────────┘ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Narrative                                                                   │
│ "HDFC Bank is in a LEADER state with strong relative strength across all    │
│  timeframes. The stock is above its 50-day EMA and MACD shows a bullish     │
│  crossover. Fragility is LOW, indicating stable price action. In the        │
│  current CAUTION regime, this is a high-conviction accumulation candidate." │
├──────────────────────────────────────────────────────────────────────────────┤
│ Price Chart (1Y)                                                            │
│ [Line chart with EMA-20, EMA-50, EMA-200 overlays]                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data source:** `GET /api/unified/snapshot/{id}`

---

### 2.8 Leaders (`/unified/leaders`) — THE HONOR ROLL

**Purpose:** "Show me everything that's working right now."

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Leaders                                    [Nifty 50 ▼] [3M ▼]             │
│                                                                             │
│ ┌────┬──────────────┬──────┬──────┬────────┬────┬───────┬──────────────┐   │
│ │ #  │ Name         │Sector│ RS   │ Ret 3M │RSI │ Action│ Sparkline    │   │
│ ├────┼──────────────┼──────┼──────┼────────┼────┼───────┼──────────────┤   │
│ │ 1  │ HDFC Bank    │ Bank │  92  │ +12.4% │ 68 │ ACC   │ ▁▂▄▆▇███▇   │   │
│ │ 2  │ TCS          │ IT   │  91  │ +10.2% │ 62 │ ACC   │ ▁▂▄▆▇██▇▇   │   │
│ │ 3  │ ICICI Bank   │ Bank │  89  │  +9.8% │ 58 │ ACC   │ ▁▃▄▆▇▇▇▆▅   │   │
│ └────┴──────────────┴──────┴──────┴────────┴────┴───────┴──────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data source:** `POST /api/unified/screen` with `state=LEADER`

---

### 2.9 Weakening (`/unified/weakening`) — THE WARNING SYSTEM

**Purpose:** "Show me what I should be worried about."

Same table structure as Leaders, but filter `state=WEAKENING` or `state=BROKEN`.
Color scheme shifts to orange/red.

**Data source:** `POST /api/unified/screen` with `state=WEAKENING`

---

### 2.10 Global Pulse (`/unified/global`) — THE WORLD VIEW

**Purpose:** "What's happening outside India?"

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Global Pulse                                                                │
│                                                                             │
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────────────────────────┐ │
│ │             │ │  Global Regime   │ │  Quick Links                        │ │
│ │    [58]     │ │                 │ │  • US Markets →                    │ │
│ │   Health    │ │  CAUTION         │ │  • Europe →                        │ │
│ │   Score     │ │  Posture:        │ │  • Asia →                          │ │
│ │  [gauge]    │ │  Mixed signals   │ │  • Commodities →                   │ │
│ └─────────────┘ └─────────────────┘ └─────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ World Indices                                                               │
│ ┌─────────────┬──────┬──────┬────────┬──────┬────────┬──────────────┐      │
│ │ Index       │Region│ RS   │ Ret 3M │RSI   │ Action │ Sparkline    │      │
│ ├─────────────┼──────┼──────┼────────┼──────┼────────┼──────────────┤      │
│ │ S&P 500     │ US   │  75  │  +5.2% │  58  │ ACC    │ ▁▂▄▆▇██▇▇   │      │
│ │ NASDAQ      │ US   │  82  │  +8.1% │  64  │ ACC    │ ▁▂▄▆▇███▇   │      │
│ │ DAX         │ EU   │  68  │  +3.4% │  52  │ HOLD   │ ▁▃▄▆▇▇▆▅▃   │      │
│ │ Nikkei 225  │ Asia │  72  │  +4.8% │  55  │ ACC    │ ▁▂▄▆▇▇▇▆▅   │      │
│ │ FTSE 100    │ UK   │  45  │  -1.2% │  48  │ HOLD   │ ▅▆▇▇▆▅▃▂▁   │      │
│ │ Hang Seng   │ Asia │  35  │  -4.5% │  42  │ REDUCE │ ▇▇▆▅▃▂▁▁▁   │      │
│ └─────────────┴──────┴──────┴────────┴──────┴────────┴──────────────┘      │
├──────────────────────────────────────────────────────────────────────────────┤
│ US ETFs                                                                     │
│ ┌─────────────┬──────┬──────┬────────┬──────┬────────┬──────────────┐      │
│ │ ETF         │Sector│ RS   │ Ret 3M │RSI   │ Action │ Sparkline    │      │
│ ├─────────────┼──────┼──────┼────────┼──────┼────────┼──────────────┤      │
│ │ SPY         │Broad │  75  │  +5.1% │  58  │ ACC    │ ▁▂▄▆▇██▇▇   │      │
│ │ QQQ         │Tech  │  85  │  +9.2% │  65  │ ACC    │ ▁▂▄▆▇███▇   │      │
│ │ GLD         │Gold  │  62  │  +2.8% │  51  │ HOLD   │ ▁▃▄▆▇▇▆▅▃   │      │
│ └─────────────┴──────┴──────┴────────┴──────┴────────┴──────────────┘      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Commodities & FX                                                            │
│ ┌─────────────┬──────┬──────┬────────┬──────┬────────┐                     │
│ │ Instrument  │Type  │ RS   │ Ret 3M │RSI   │ Action │                     │
│ ├─────────────┼──────┼──────┼────────┼──────┼────────┤                     │
│ │ Gold        │Cmdty │  62  │  +2.8% │  51  │ HOLD   │                     │
│ │ Crude Oil   │Cmdty │  48  │  -0.5% │  46  │ HOLD   │                     │
│ │ USD/INR     │FX    │  55  │  +1.2% │  49  │ HOLD   │                     │
│ └─────────────┴──────┴──────┴────────┴──────┴────────┘                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Regime: `GET /api/unified/global/regime`
- Indices/ETFs: `GET /api/unified/global/aggregate`
- Commodities/FX: `GET /api/unified/global/aggregate?cohort_type=asset_class`

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Shared Components (existing + new)

| Component | Status | Usage |
|-----------|--------|-------|
| `ActionBadge` | ✅ Exists | Every table row, card header |
| `RegimeGauge` | ✅ Exists | Dashboard, Global page |
| `BubbleChart` | ✅ Exists | Dashboard, Sectors, Global |
| `NarrativePanel` | ✅ Exists | Dashboard, Fund X-Ray, Instrument |
| `EvidenceCard` | ✅ Exists | Instrument detail, Fund X-Ray |
| `RSScorecard` | ✅ Exists | Instrument detail |
| `DataFreshness` | ✅ Exists | Every page header |
| `BreadthBar` | ✅ Exists | Dashboard sector health |
| `FactorHeatmapCell` | 🆕 NEW | Funds rankings table |
| `RadarChart` | 🆕 NEW | Fund X-Ray, Fund sector tab |
| `HoldingsTable` | 🆕 NEW | Fund X-Ray |
| `SectorDonut` | 🆕 NEW | Fund X-Ray |
| `CapTiltBar` | 🆕 NEW | Fund X-Ray |
| `Sparkline` | 🆕 NEW | Every table row |
| `SubTabNav` | 🆕 NEW | Sector detail (Stocks/MFs/ETFs) |

### 3.2 Component Specs

#### FactorHeatmapCell
```tsx
interface FactorHeatmapCellProps {
  value: number | null; // 0-100 percentile
}
// Color mapping:
// 0-25   → bg-red-100 text-red-700
// 25-50  → bg-orange-100 text-orange-700
// 50-75  → bg-yellow-100 text-yellow-700
// 75-100 → bg-green-100 text-green-700
// null   → bg-gray-100 text-gray-400 "N/A"
```

#### RadarChart
```tsx
interface RadarChartProps {
  data: {
    momentum: number;
    quality: number;
    resilience: number;
    holdings: number;
    cost: number;
    consistency: number;
  };
  median?: { /* same shape */ }; // dashed overlay
}
// Library: recharts RadarChart or chart.js
```

#### Sparkline
```tsx
interface SparklineProps {
  data: number[]; // 30-90 days of prices
  width?: number;
  height?: number;
  color?: string; // green for positive trend, red for negative
}
// Library: inline SVG path (no heavy library needed)
```

---

## 4. DATA FETCHING STRATEGY

### 4.1 React Query Patterns

All data fetching uses `useUnifiedData` (GET) and `useUnifiedDataPost` (POST) hooks with **15-minute stale-while-revalidate caching**.

```tsx
// Dashboard
const { data: regime } = useUnifiedData<RegimeResponse>("/regime");
const { data: aggregates } = useUnifiedData<AggregateResponse>("/aggregate?cohort_type=sector");
const { data: leaders } = useUnifiedDataPost<ScreenerResponse>("/screen", { state: "LEADER", limit: 10 });

// Fund Rankings
const { data: rankings } = useUnifiedData<FundRankingsResponse>("/funds/rankings");

// Fund X-Ray
const { data: snapshot } = useUnifiedData<SnapshotResponse>(`/snapshot/${id}`);
const { data: xray } = useUnifiedData<FundXRayResponse>(`/funds/${id}/xray`);
const { data: holdings } = useUnifiedData<FundHoldingsResponse>(`/funds/${id}/holdings`);
```

### 4.2 Skeleton Loading

Every async section shows a skeleton placeholder:
- Tables: 5 rows of gray pulse bars
- Cards: gray rounded rectangle with animated shimmer
- Charts: gray box with "Loading chart data..." centered

### 4.3 Error States

- **API 500:** "Data temporarily unavailable. Retrying in 15s..." with retry button
- **Empty results:** "No funds match your filters. Try broadening your criteria."
- **Slow load:** Show cached data with "Last updated 3:30 PM" banner + spinner

---

## 5. MOBILE STRATEGY

### 5.1 Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px (sm) | Single column, stacked cards, horizontal scroll tables |
| 640-1024px (md) | 2-column grid, condensed tables |
| > 1024px (lg) | Full layout as spec'd above |

### 5.2 Mobile-First Adaptations

**Dashboard:**
- Health gauge + regime card stack vertically
- Bubble chart becomes a scrollable horizontal list of sector cards
- Top leaders/funds become swipeable carousels

**Funds Rankings:**
- Horizontal scroll table (pin fund name column)
- Filters collapse into a bottom sheet

**Fund X-Ray:**
- Radar chart → 6 horizontal bars (one per factor)
- Holdings table → swipeable cards (one holding per card)
- Sector donut → horizontal bar chart

---

## 6. COLOR SYSTEM

### Actions

| Action | Hex | Tailwind | Usage |
|--------|-----|----------|-------|
| STRONG_ACCUMULATE | #16A34A | green-600 | Highest conviction buy |
| ACCUMULATE | #22C55E | green-500 | Buy |
| HOLD | #71717A | zinc-500 | Neutral |
| REDUCE | #F97316 | orange-500 | Trim position |
| EXIT | #EF4444 | red-500 | Sell |
| AVOID | #27272A | zinc-800 | Do not enter |

### States

| State | Color | Badge style |
|-------|-------|-------------|
| LEADER | green | Solid fill |
| EMERGING | emerald-400 | Solid fill |
| WEAKENING | orange | Solid fill |
| LAGGING | red | Solid fill |
| BASE_BUILDING | blue | Outline |
| BROKEN | red | Outline + strikethrough name |

### Health Zones

| Zone | Range | Color |
|------|-------|-------|
| FEAR | < 25 | red-500 |
| WEAK | 25-40 | orange-500 |
| NEUTRAL | 40-55 | zinc-400 |
| HEALTHY | 55-70 | green-500 |
| BULLISH | > 70 | green-600 |

---

## 7. PERFORMANCE BUDGET

| Metric | Target | How |
|--------|--------|-----|
| TTFB | < 1.5s | Backend caching (15min TTL), CDN for static assets |
| First Contentful Paint | < 2s | Server-side render dashboard shell |
| Time to Interactive | < 3s | Lazy load charts below fold |
| API response (cached) | < 100ms | PostgreSQL indexes on (date, instrument_type) |
| API response (uncached) | < 500ms | Query optimization, materialized views if needed |
| Table render (500 rows) | < 100ms | Virtualized table (react-window) |
| Chart render | < 200ms | Canvas-based charts (chart.js), not SVG for large datasets |

---

## 8. IMPLEMENTATION PRIORITY

### Phase 1: Dashboard Polish (1-2 days)
- [ ] Add benchmark + period selectors to dashboard
- [ ] Add Top Funds preview card
- [ ] Add sector health bars
- [ ] Connect all data hooks to real endpoints

### Phase 2: Funds Module (3-4 days)
- [ ] Build `/unified/funds` rankings page with heatmap table
- [ ] Build `/unified/funds/[id]` X-Ray page with radar + holdings + sector donut
- [ ] Build factor heatmap cell component
- [ ] Build radar chart component
- [ ] Build holdings table component
- [ ] Build sector donut component

### Phase 3: Sector Module (2-3 days)
- [ ] Add 3 sub-tabs to sector detail (Stocks / MFs / ETFs)
- [ ] Build MF/ETF sector filter logic (dominant_sectors JSONB)
- [ ] Add sparklines to sector stock table

### Phase 4: Global Pulse (2 days)
- [ ] Build `/unified/global` page
- [ ] Add global regime gauge
- [ ] Add world indices table
- [ ] Add US ETFs table
- [ ] Add commodities/FX table

### Phase 5: Instrument Detail (1-2 days)
- [ ] Extend `/unified/instrument/[id]` for MF/ETF/Index types
- [ ] Show type-specific evidence cards
- [ ] Add price chart with EMA overlays

### Phase 6: Polish & QA (2-3 days)
- [ ] Mobile responsive pass
- [ ] Skeleton loaders everywhere
- [ ] Error states
- [ ] Performance audit (Lighthouse)
- [ ] Screenshot every page

**Total estimate: 11-16 days of focused frontend work**

---

## 9. KEY FILES TO MODIFY/CREATE

### New Components
```
frontend/src/components/unified/FactorHeatmapCell.tsx
frontend/src/components/unified/RadarChart.tsx
frontend/src/components/unified/HoldingsTable.tsx
frontend/src/components/unified/SectorDonut.tsx
frontend/src/components/unified/CapTiltBar.tsx
frontend/src/components/unified/Sparkline.tsx
frontend/src/components/unified/SubTabNav.tsx
```

### New Pages
```
frontend/src/app/unified/global/page.tsx
frontend/src/app/unified/funds/page.tsx          (rebuild)
frontend/src/app/unified/funds/[id]/page.tsx     (rebuild)
frontend/src/app/unified/sectors/[name]/page.tsx (add sub-tabs)
frontend/src/app/unified/instrument/[id]/page.tsx (extend)
```

### Modified Files
```
frontend/src/app/unified/page.tsx                 (dashboard)
frontend/src/app/unified/layout.tsx               (add Global nav)
frontend/src/lib/api-unified.ts                   (add new types)
frontend/src/hooks/useUnifiedData.ts              (no changes needed)
```

---

## 10. DESIGN DECISIONS

1. **No dark mode** — Financial data is read in bright offices and outdoors. Light mode only.
2. **Serif for headlines, sans for data** — Creates visual hierarchy. Headlines feel editorial; data feels precise.
3. **No stock photos, no illustrations** — Every pixel is data. No decorative elements.
4. **Tables over cards for lists** — Fund managers scan tables faster than card grids.
5. **Sticky headers on tables** — When scrolling 500 funds, the column labels must remain visible.
6. **Inline sparklines, not full charts** — Trend direction in 60px. Click to expand if needed.
7. **Verdict-first layout** — Action badge is the leftmost column in every table. RS rank is second.

---

*Document version: 2026-04-23*  
*Next review: After Phase 1 implementation*
