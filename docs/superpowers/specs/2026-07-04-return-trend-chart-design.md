# Return Trend Chart — Design

**Date:** 2026-07-04
**Status:** Approved

## Goal

Extend the Portfolio Return KPI (v0.11.0) into a time series on `/analysis`: a
combo chart showing each month's investment return (bars) and the chained
cumulative return index (line), answering "how has my investing performed
month by month, and how much have I earned to date?"

## Computation

New pure function `computeInvestmentReturnSeries` in
`src/lib/services/analysis-service.ts`. Same inputs as
`computeInvestmentReturn` (range-filtered breakdown snapshots, account
metadata, per-account monthly cash flows, range-start month key) — all already
loaded client-side in `analysis-view.tsx`; **no new DB reads or cache
entries**.

Per month `m` in the selected range (month bucketing follows
`aggregateMonthlyChange` semantics — last snapshot of the month is the month
end):

```
investment accounts = category ∈ {BROKERAGE, CRYPTO_WALLET}

start = investment value at the last snapshot of the previous month
        (for the range's first month: the first snapshot within that month)
end   = investment value at the last snapshot of month m
cash  = Σ contributions for investment accounts with monthKey == m

monthlyReturn    = (end − start − cash) / (start + cash / 2)   // half-weight Dietz
                   null when base = start + cash/2 ≤ 0
cumulativeReturn = Π (1 + rᵢ) − 1  over non-null months so far
                   (null months contribute nothing; the index carries forward)
```

Output shape (one point per month, empty months synthesized so the X axis
aligns with the other charts):

```ts
interface ReturnTrendPoint {
  monthKey: string; // "YYYY-MM"
  label: string; // locale-formatted month label
  monthlyReturn: number | null; // fraction, e.g. 0.021
  cumulativeReturn: number | null; // fraction; null until first computable month
  isEmpty?: boolean; // no snapshot data this month
}
```

Returns `[]` when there are fewer than 2 snapshots or no investment accounts.

**KPI consistency:** the chained monthly product is not mathematically equal
to the KPI's single-period Dietz — this is expected (geometric linking vs.
single-period approximation). No reconciliation; the chart subtitle states the
method.

## Component

New `src/components/analysis/return-trend-chart.tsx`, modeled directly on
`cumulative-growth-chart.tsx`:

- Recharts `ComposedChart`: `Bar` for `monthlyReturn` (positive `--gain`,
  negative `--loss`), `Line` for `cumulativeReturn`, 0% `ReferenceLine`,
  percent-formatted Y axis, shared `ChartTooltipContainer` tooltip.
- Privacy mode: tooltip values render `***` (matches `portfolio-heatmap.tsx`,
  which hides even percentages).
- Empty months render as gaps (no bar, tooltip shows the existing
  `noDataMonth` copy).
- Lazy-loaded via `lazy-analysis-charts.tsx` like the other charts.

## Layout

Third card in the existing "movement" section grid in `analysis-view.tsx`
(currently cash flow | cumulative growth), with `xl:col-span-2` so it spans a
full-width row beneath the pair — monthly bars need width, and this avoids an
orphaned half-width card.

## i18n

New keys in the `analysis` namespace of `messages/en-US.json` and
`messages/zh-TW.json`: chart title, subtitle (naming the Dietz method and
investment-only scope), and tooltip series labels.

## Testing

Unit tests in `tests/unit/` for `computeInvestmentReturnSeries`:

- normal multi-month series (hand-computed Dietz values and chained index)
- first-month baseline uses the first snapshot within the range
- a null month (base ≤ 0) leaves a gap and the cumulative index carries
  forward through it
- empty months are synthesized with `isEmpty` and null returns
- no investment accounts → `[]`; fewer than 2 snapshots → `[]`

## Explicitly skipped (add later if needed)

- Annualization
- Benchmark comparison line (e.g. S&P 500) — would need external data
- Reconciling the chained index with the KPI's single-period number
