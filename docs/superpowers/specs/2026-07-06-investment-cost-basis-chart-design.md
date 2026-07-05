# Investment Cost Basis Chart Design

## Goal

Add one focused analysis chart that answers: "Are my current investment holdings above or below cost?"

Use the buy unit price now stored on holding transactions to compare current market value against cost basis for brokerage and crypto holdings. Keep this separate from the net worth trend because net worth mixes cash, property, liabilities, and holdings; cost basis only applies to investment holdings.

## Scope

Build a new Investment Cost Basis chart in the Analysis tab's Movement section, near the existing Return Trend chart.

The chart shows current investment holdings, not historical monthly cost-basis changes:

- Market value: current priced value of included holdings.
- Cost basis: remaining cost basis for included holdings with transaction unit prices.
- Unrealized gain/loss: market value minus cost basis, shown in tooltip and supporting copy.
- Unrealized gain/loss percent: unrealized gain/loss divided by cost basis when cost basis is positive.

Out of scope for this spec:

- Backfilling historical monthly cost basis.
- Adding a cost line to the overall net worth chart.
- Cost analysis for property, vehicles, cash, loans, mortgages, or other non-investment categories.

## Data

Add a small server-side analysis helper that reads active brokerage and crypto accounts with positive holdings and their holding transactions. It reuses existing account categories:

- `BROKERAGE`
- `CRYPTO_WALLET`

For each holding:

- Market value comes from the same current price pipeline used by net worth: current price times quantity times option multiplier when relevant, converted to the user's base currency.
- Cost basis is computed from `HoldingTransaction` rows with `unitPrice`.
- BUY transactions increase quantity and cost basis.
- SELL transactions reduce cost basis by the sold fraction of the current tracked lot basis, using average cost.
- EDIT transactions reset the tracked quantity. If the EDIT has `unitPrice`, reset cost basis to edited quantity times unit price. If it has no `unitPrice`, reset tracked cost basis to zero because the adjusted quantity has no reliable cost.
- Holdings with no usable `unitPrice` are included in market value but excluded from cost basis.

The helper returns one summary object:

```ts
interface InvestmentCostBasisSummary {
  marketValue: number;
  costBasis: number;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
  pricedHoldingCount: number;
  costedHoldingCount: number;
}
```

`unrealizedGain` and `unrealizedGainPct` are `null` when `costBasis <= 0`.

## UI

Add a lazy-loaded chart component following the existing Analysis chart pattern.

Display:

- A compact two-bar comparison for Market Value and Cost Basis.
- Tooltip rows for Market Value, Cost Basis, Unrealized Gain/Loss, and Gain/Loss %.
- Privacy mode hides monetary values with the existing `"***"` convention.
- Empty state appears when there are no priced investment holdings.
- Note appears when some priced holdings lack cost basis: "Cost basis only includes holdings with buy unit prices."

Use existing chart primitives, cards, density handling, i18n messages, and Recharts. Do not add dependencies.

## Placement

In `AnalysisView`, place the new chart in the Movement section next to investment return context. Use the existing responsive grid: stacked cards on mobile, two columns on wide screens.

- Cash Flow
- Cumulative Growth
- Investment Cost Basis
- Return Trend

## Errors and Edge Cases

- Missing price: exclude that holding from `marketValue` and `pricedHoldingCount`.
- Missing unit price: include in `marketValue`, exclude from `costBasis`.
- Sell quantity greater than tracked costed quantity: reduce tracked cost to zero and continue.
- Missing FX rate: follow the existing net-worth behavior and fall back to rate `1`, with existing logging if available in the reused helper path.
- Options: use the existing `contractMultiplier` behavior. If multiplier is missing, use the same default used by net worth.

## Testing

Add one focused pure-function test for the cost-basis reducer:

- BUY 10 at 100, BUY 10 at 200, SELL 5 leaves quantity 15 and cost basis 2250.
- A holding with no unit prices contributes no cost basis.
- Selling more than tracked costed quantity does not produce negative cost basis.

Run the existing typecheck or test command used by this repo after implementation.
