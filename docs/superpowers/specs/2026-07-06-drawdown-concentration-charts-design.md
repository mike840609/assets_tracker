# Design: Drawdown curve (Analysis) + Concentration card (Dashboard)

Date: 2026-07-06
Status: Approved (pending spec review)

## Summary

Add two new charts that answer questions no existing chart covers, chosen for high value at
near-zero data cost (both are pure transforms of data the pages already load):

- **A — Drawdown ("underwater") curve** on the **Analysis** tab: how far below the prior
  net-worth peak we fell, over time, plus a max-drawdown headline.
- **B — Concentration card** on the **Dashboard**: how exposed the portfolio is to its
  largest positions, right now.

The Analysis/Dashboard split is forced by the data model, not preference (see below).

## Why this split (data reality)

- `NormalizedSnapshot.netWorth` is a full net-worth time series; `AnalysisView` already
  receives `snapshots: NormalizedSnapshot[]` and owns a range selector. Drawdown is a pure
  transform of that series → **Analysis tab**, range-aware for free.
- Per-holding market values exist **only at the current moment** via
  `NetWorthSummary.accounts[].holdings[].marketValueInBaseCurrency`. `NetWorthSnapshot`
  stores a per-**account** breakdown only — there is **no per-holding history**. So
  concentration is strictly point-in-time and belongs on the **Dashboard**, which already
  loads `NetWorthSummary` for the allocation / heatmap / currency sections. A concentration
  _trend_ is out of scope (would require a schema change to snapshot per-holding weights).

## A — Drawdown curve (Analysis tab)

### Behavior

- Series value at each snapshot: `(netWorth - runningPeak) / runningPeak`, always `<= 0`.
- **Running peak is computed over the full `snapshots` history**, then the series is sliced
  to the selected range for display. A drawdown that began before the visible window still
  renders truthfully (all-time peak, not window-local peak).
- Operates at raw snapshot granularity (no monthly bucketing) — it is a standalone card and
  does not need X-axis alignment with the month-padded charts.
- Headline: **max drawdown** within the displayed range (the most-negative point), formatted
  as a percentage.
- Empty/degenerate cases: 0 or 1 snapshot, or a peak of 0, must not divide-by-zero — emit an
  empty series (chart shows its existing empty state) rather than `NaN`/`Infinity`.

### Data

New pure function in `src/lib/services/analysis-service.ts`, co-located with the other
transforms:

```ts
export interface DrawdownPoint {
  date: string; // snapshot date (ISO "YYYY-MM-DD")
  drawdownPct: number; // <= 0
}

export function computeDrawdownSeries(
  snapshots: NormalizedSnapshot[], // full history, ascending by date
  rangeStartIso: string, // inclusive lower bound for the returned slice
): DrawdownPoint[];
```

Running peak accumulates across the full input; only points with `date >= rangeStartIso` are
returned. Unit-tested per the existing vitest pattern (`tests/unit/`): rising-only series →
all zeros; a dip-and-recover → correct trough and return to 0; a drawdown that starts before
`rangeStartIso` → first returned point already negative; single/empty snapshot → `[]`.

### UI

- New client component `src/components/analysis/drawdown-chart.tsx`: Recharts `AreaChart`,
  single series, `var(--loss)` fill, Y axis formatted as `%` (reuse chart-formatter
  conventions), tooltip shows date + drawdown %. Follows the existing chart components'
  structure (title, `ChartEmptyState` when no data).
- Lazy-load it by adding `LazyDrawdownChart` to
  `src/components/analysis/lazy-analysis-charts.tsx` (same pattern as the others).
- Render in `AnalysisView`'s **"movement" section**, in the existing grid alongside cash
  flow / cumulative growth / return trend. Derive the series with a `useMemo` over
  `snapshots` + `rangeStartIso` (both already in scope). No new props, no new page/service
  wiring, no new state — it reacts to the existing range selector.

## B — Concentration card (Dashboard)

### Behavior

- **Top-5 positions** as a horizontal bar list, each holding's
  `marketValueInBaseCurrency` as a % of **total assets**.
- Headline: **largest position = X%**.
- HHI-derived qualitative label (`low` / `moderate` / `high`) — _optional_, kept because it
  reuses the same numbers; may be cut without affecting the rest.
- Holdings are flattened across all accounts. Positions beyond the top 5 are ignored (no
  "other" bar needed for a risk-glance card).
- Empty case (no holdings / zero assets): render the card's empty state, no divide-by-zero.

### Data

New pure helper (co-located with dashboard/analysis pure logic — same file as A, or a small
new module if cleaner):

```ts
export interface ConcentrationResult {
  top: { label: string; pct: number }[]; // up to 5, descending
  topHoldingPct: number; // 0 when empty
  hhi: number; // sum of squared weights, 0..1
}

export function computeConcentration(summary: NetWorthSummary): ConcentrationResult;
```

Derived client-side from the `NetWorthSummary` the dashboard already loads. No new service,
query, or read. Unit-tested: single holding → `topHoldingPct = 100`, `hhi = 1`; even spread
→ small `hhi`; empty → zeros and `top: []`.

### UI

- New client component `src/components/dashboard/concentration-card.tsx`. Compact bar list +
  headline, matching the card idiom of its neighbors (`AllocationChart`,
  `CurrencyExposureChart`, `PortfolioHeatmap`).
- Place in the same dashboard grid row as `PortfolioHeatmapSection` in
  `dashboard-content.tsx` (heatmap = sizes visually, concentration = the risk number).
  Wrap in `Suspense` with a skeleton like its neighbors.

## Cross-cutting

- i18n: add strings to `messages/en-US.json` and `messages/zh-TW.json` (namespaces:
  `analysis` for A, `dashboard` for B). Use `pickMessages` boundaries as the surrounding code
  does.
- Release: prepend a changelog entry to `src/lib/changelog.ts` (bilingual, `added`) and bump
  `package.json` version to match.

## Out of scope (explicit)

- Concentration **trend** over time (no per-holding history in snapshots).
- Any new transaction types / income / dividend charts (data does not exist).
- Realized/unrealized gains, savings-rate, waterfall (deferred or redundant per the
  candidate-list triage).

## Testing

- Unit (vitest): `computeDrawdownSeries` and `computeConcentration` per the cases above —
  pure functions, no DB/env, following `tests/unit/` conventions.
- Manual: verify both render against seeded local data, including empty states, and that the
  drawdown chart tracks the range selector.
