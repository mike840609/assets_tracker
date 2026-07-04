# Portfolio Return % KPI Tile — Design

**Date:** 2026-07-04
**Status:** Approved

## Goal

Answer "how well am I investing?" on the `/analysis` tab with a single number: the
selected range's investment return, e.g. `+7.2%`, shown as a new tile in the
existing KPI row.

## Scope

- **Accounts counted:** investment accounts only — `AccountCategory` in
  (`BROKERAGE`, `CRYPTO_WALLET`). Idle bank cash, property, vehicles, and
  liabilities are excluded so the number reads as "my portfolio returned X%".
- **Range:** follows the same range selector as the other KPI tiles.
- **Not annualized:** it is the range's period return, matching how the other
  tiles read ("YTD", "past 12 months").

## Computation

New pure function in `src/lib/services/analysis-service.ts`, reusing the exact
inputs `computePerformanceAttribution` already receives (range-filtered
breakdown snapshots, account metadata, per-account monthly cash flows —
all already loaded by `analysis-payload-service.ts`; **no new DB reads or
cache entries**):

```
investment accounts = accounts where category ∈ {BROKERAGE, CRYPTO_WALLET}

gain = Σ marketPerformance        // totalDelta − cashContribution, per account
base = Σ startValue + (Σ cashContribution) / 2
returnPct = base > 0 ? gain / base : null
```

This is the simple Modified-Dietz approximation: contributions are assumed to
arrive mid-period, so they carry half weight in the denominator. No XIRR
solver.

**Null / edge cases** — return `null` (tile renders `—`) when:

- fewer than 2 snapshots in range
- `base <= 0` (no investment capital, or withdrawals exceed starting value)

## UI

- One new tile in `src/components/analysis/kpi-tiles.tsx`, styled like the
  existing YTD % value (`+X.X%` / `−X.X%`, gain/loss tone via `toneFor`).
- Respects privacy mode the same way the other tiles do.
- One added line in the existing methodology `<details>` block explaining the
  approximation and the investment-only scope.
- i18n strings in `messages/en-US.json` and `messages/zh-TW.json`.

## Testing

Unit test in `tests/unit/` for the new function, following the existing
analysis-service test pattern (real exported function, no DB):

- normal case (positive gain, some contributions)
- zero / negative base → `null`
- withdrawal-heavy period
- fewer than 2 snapshots → `null`

## Explicitly skipped (add later if needed)

- PROPERTY appreciation in the return — misleading without regular valuations
- All-assets scope toggle
- XIRR / true money-weighted return — revisit if the half-weight
  approximation ever feels wrong
- Annualization
