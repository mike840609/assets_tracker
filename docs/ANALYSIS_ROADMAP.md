# Analysis Tab — Feature Roadmap

Roadmap for the `/analysis` tab introduced in `feat: add Analysis tab with monthly net-worth breakdown`. Phases are ordered by dependency and value; within a phase, items are independent and can be picked up in any order.

## Legend

| Symbol | Meaning |
| --- | --- |
| 🔴 | High impact |
| 🟡 | Medium impact |
| 🟢 | Low impact |
| ✅ | Shipped |
| 🚧 | In progress |
| ❌ | Not started |

---

## Phase 1 — v1 (shipped)

The foundation: turn existing `NetWorthSnapshot` data into month-over-month insight.

| # | Feature | Impact | Status |
| --- | --- | --- | --- |
| 1 | `/analysis` route wired into sidebar + mobile nav | 🔴 | ✅ |
| 2 | Monthly Net Worth Change bar chart (green/red per sign) | 🔴 | ✅ |
| 3 | Assets vs. Liabilities by Month grouped bar chart | 🟡 | ✅ |
| 4 | KPI tiles: Best / Worst / Avg monthly Δ, YTD growth | 🟡 | ✅ |
| 5 | Range selector (6M / 1Y / 2Y / All), default 1Y | 🟡 | ✅ |
| 6 | i18n for en-US and zh-TW | 🟢 | ✅ |

**Reusable primitives created**: `aggregateMonthlyChange()` and `computeKpis()` in `src/lib/services/analysis-service.ts`, the `MonthlyBucket` type, `formatMonthLabel()`. Phase 2 items should extend these rather than re-roll their own aggregation.

---

## Phase 2 — near-term (next ~2 sprints)

Deepen "what drove the change?" insight by bringing transaction data in.

### 2.1 Cash Flow Decomposition — 🔴 ✅

Split each month's Δ net worth into **contributions** (money the user actually put in or pulled out) vs. **market performance** (price movement on existing holdings).

- **Why**: answers "am I growing wealth or just saving more?" — arguably the single most important analytical question for this app.
- **Chart**: stacked `BarChart` per month, two series (`contributions`, `marketPerformance`), with the net outline matching bar #2 from Phase 1.
- **Data**:
  - `CashTransaction` (DEPOSIT − WITHDRAWAL) aggregated by month.
  - `HoldingTransaction` (BUY cost − SELL proceeds, using `createdAt` and the snapshot's currency conversion rates) aggregated by month.
  - `marketPerformance = Δ netWorth − netContributions`.
- **Implementation**:
  - New service fn `getMonthlyCashFlow(userId, baseCurrency, from, to)` in `analysis-service.ts` that queries both transaction tables grouped by month and converts each line to `baseCurrency` via `resolveRate()`.
  - New client component `src/components/analysis/cashflow-chart.tsx`.
  - Add to `AnalysisView` below the existing two charts.
- **Risks**: historical transactions predate the current base currency — need to pull the FX rate *at transaction time* (not today's rate). Start with today's rate for v1 and document the drift, then layer in historical rates later.
- **i18n keys**: `analysis.cashFlow`, `analysis.seriesContributions`, `analysis.seriesMarket`.

### 2.2 Category Trend Over Time — 🟡 ✅

Which asset category is actually driving growth — brokerage, crypto, property, cash?

- **Why**: users intuit category shifts but rarely have the data to confirm them.
- **Chart**: stacked `AreaChart` (categories on Y over time) + optional "small-multiples" one line-chart per category for clarity on mobile.
- **Data**: `NetWorthSnapshot.breakdown` (already populated by the cron — see SUGGESTIONS.md item #35 which notes this field is currently unused).
- **Implementation**:
  - Service: `aggregateCategoryHistory(snapshots)` that unpacks `breakdown` JSON into `{ date, BANK, BROKERAGE, ... }` rows. Handle missing categories gracefully (categories appear/disappear as accounts are added).
  - Client: `src/components/analysis/category-trend-chart.tsx`, reusing the category colors/labels already used by `allocation-chart.tsx`.
- **Blocking prerequisite**: confirm the cron is actually writing `breakdown` JSON for all users (SUGGESTIONS.md #35 implies it's captured but unused).

### 2.3 Top Movers — 🟡 ✅

Which individual holdings gained/lost the most over the selected period.

- **Why**: complements KPI tiles with actionable "why was it a bad month?" detail.
- **Chart**: horizontal bar chart ranking top 10 by absolute $ change, with a toggle for %. Color by sign.
- **Data**:
  - Start-of-period value: derived from `HoldingTransaction` history up to that date × historical price.
  - End-of-period value: current `PriceCache` × current quantity.
  - Simpler v1 fallback: just use today's vs. N-days-ago `PriceCache` snapshots for currently-held positions, ignoring transaction timing.
- **Implementation**:
  - Service: `computeTopMovers(userId, baseCurrency, periodDays)`.
  - Client: `src/components/analysis/top-movers-list.tsx` (can be a table rather than a chart if the horizontal bar feels noisy).
- **Coupling**: reuses logic similar to `net-worth-service.ts`; consider factoring a shared "holding-value-at-date" helper.

---

## Phase 3 — medium-term

Polishing the tab into a reporting surface.

### 3.1 Custom Date Range Picker — 🟡

Let users pick arbitrary `from` / `to` dates instead of fixed 6M / 1Y / 2Y / All buckets. Adds a `DateRangePicker` primitive (shadcn calendar + popover). Lives in `src/components/ui/` because History page can reuse it. Maintain the preset shortcuts as quick-picks inside the popover.

### 3.2 Yearly Summary & YoY Comparison — 🟡

A second sub-view (tab switcher inside `/analysis`) that:
- Aggregates by year instead of month.
- Shows year-over-year % growth.
- Side-by-side bar comparison: "this year vs. last year, same months so far".

Reuse `aggregateMonthlyChange()` and add `aggregateYearlyChange()`.

### 3.3 Export Analysis (CSV / PDF) — 🟡

Download the visible analysis as CSV (simple) or PDF (nicer for reports). CSV first — drop-in `papaparse` + blob download. PDF via `@react-pdf/renderer` or screenshot-driven `html2canvas`.

### 3.4 Benchmark Overlay — 🟢

Plot the user's net-worth growth curve against a benchmark (S&P 500, or user's base-currency inflation) normalized to 100 at the period start.

- **Data**: use Yahoo Finance 2 (already a dependency) to pull `^GSPC`, `^IXIC`, index history. Cache in a new `BenchmarkPrice` model or reuse `PriceCache`.
- **Risk**: comparing apples to oranges (portfolio vs. equity index). Add a disclaimer tooltip.

### 3.5 Volatility / Drawdown Indicator — 🟢

KPI row additions: max drawdown %, longest winning streak, stddev of monthly change. Pure math over the existing `MonthlyBucket[]`. Good accessibility opportunity to include sparkline alt-text.

---

## Phase 4 — long-term

Predictive and goal-oriented features. These require some new data models.

### 4.1 Net Worth Projection / Forecast — 🟡

Line chart extending into the future based on trailing-12-month average contributions and compounded market returns. Let users tweak assumptions (monthly contribution, expected return %). Simple compound-interest math; no ML needed.

**New**: user-scoped assumption settings stored on the `Setting` model.

### 4.2 Goal Tracking (FIRE / Milestones) — 🟡

Users set a target net worth (e.g., $1M) and an optional date. Show:
- Progress bar on the Analysis tab.
- Projected hit date vs. target date.
- Required monthly contribution to hit the target on time.

**New model**: `Goal { id, userId, targetNetWorth, targetDate?, baseCurrency, archived }`.

### 4.3 Insights / Annotations — 🟢

Let the user (or a future AI helper) annotate events on the trend chart — "bought house", "bonus deposit", "market crash". Renders as vertical reference lines with tooltips.

**New model**: `Annotation { id, userId, date, title, note }`.

### 4.4 Tax View — Realized Gains/Losses — 🟡

Derive realized P&L by matching `HoldingTransaction` SELLs to their BUY cost basis (FIFO or specific-lot). Group by tax year. Tie-in to SUGGESTIONS.md item #7 (cost basis & gain/loss tracking).

**Prerequisite**: SUGGESTIONS.md #7 must ship first — this builds on that data.

### 4.5 Dividend / Income Analysis — 🟢

If/when dividend tracking lands (SUGGESTIONS.md #17), add a monthly dividend bar chart and yield-on-cost KPI. Currently blocked on the underlying data model.

---

## Cross-cutting concerns

These apply to every phase and should be kept in mind when picking up items.

- **Accessibility**: every bar/line chart needs an alt description or adjacent data table (see SUGGESTIONS.md #44 — "color-only differentiation for assets/liabilities" already flagged). Add `aria-label` on range-selector buttons.
- **Testing**: ship each new service function with pure-function unit tests (Vitest). Aggregation math is the exact kind of code that rewards tests. Align with SUGGESTIONS.md #26.
- **Caching**: analysis views already piggyback on `getFullNormalizedHistory()` which is uncached. Once the tab gets heavy (category trend, top movers), wrap each service fn in `unstable_cache` with a `snapshots` tag, matching the `history-service.ts:79` pattern.
- **Mobile layout**: current v1 uses a single-column stack which is fine for 2–3 charts. When Phase 2+ adds more, introduce a sub-tab switcher (`Tabs` from `src/components/ui/tabs.tsx`) so mobile doesn't become an endless scroll.
- **i18n**: every new string must land in **both** `messages/en-US.json` and `messages/zh-TW.json` simultaneously.
- **Breakdown JSON usage**: Phase 2.2 unblocks SUGGESTIONS.md #35. Track them together.

---

## Suggested order of attack

If picking one feature at a time, this ordering keeps value-per-sprint highest:

1. **Phase 2.1 — Cash Flow Decomposition** (highest user value, no new models)
2. **Phase 2.2 — Category Trend** (unblocks an already-collected data field)
3. **Phase 3.1 — Custom Date Range** (foundational for everything else)
4. **Phase 2.3 — Top Movers** (requires more careful data plumbing; benefits from #3's date picker)
5. **Phase 3.2 — Yearly/YoY** (cheap once the date picker exists)
6. **Phase 3.3 — Export**, then Phase 4 items by user demand.
