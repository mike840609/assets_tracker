# Realistic Demo Seed

## Goal

Make `pnpm seed:demo` populate the preview user with a deterministic but believable personal portfolio. The result must render useful dashboard, history, analysis, and transaction views without requiring live market APIs.

## Portfolio

Keep the existing four-account shape:

- `Cathay Bank`: a TWD bank account with a realistic current cash balance and dated salary, housing, living-expense, and investment-transfer activity.
- `Fidelity Brokerage`: a USD brokerage account holding only Apple (`AAPL`), NVIDIA (`NVDA`), and Tesla (`TSLA`), plus a modest cash balance.
- `Cold Wallet`: a USD-denominated crypto wallet holding Bitcoin (`BTC-USD`).
- `Visa Credit Card`: a USD liability with a believable outstanding balance.

Each holding will have multiple dated purchase transactions with fixed quantities and unit prices. The transaction quantities must add up exactly to the holding's current quantity, giving every holding a meaningful cost basis and gain/loss result.

## Deterministic Prices and Valuation

The seed will provide fixed cached USD prices for `AAPL`, `NVDA`, `TSLA`, and `BTC-USD`, plus fixed TWD/USD exchange rates. It will not make network requests. Re-running the seed against the same code therefore produces the same current account values and net worth, aside from generated identifiers and dates relative to the run date.

Current account balances, holding quantities, transaction amounts, cached prices, and exchange rates will be internally consistent. The current net worth will be calculated from the same fixture data that is inserted into the database.

## Historical Story

Generate 180 daily net-worth snapshots ending on the current Taiwan calendar day. Historical values will remain deterministic while giving account categories distinct behavior:

- Bank cash changes gently and remains less volatile than investments.
- Brokerage and Bitcoin values follow separate trend and oscillation curves.
- Credit-card debt varies modestly instead of being scaled with assets.
- The final snapshot exactly equals the seeded current balances and fixed prices.

Snapshot totals will be expressed in USD, while each breakdown entry will retain its account currency and account-relative value, matching the application's existing snapshot contract.

## Structure

Move the static portfolio definition and pure valuation/history helpers into an importable demo-data module under `scripts/`. Keep database connection, safety checks, transaction handling, deletion, and inserts in `scripts/seed-demo.mjs`.

This boundary lets unit tests validate the fixture without requiring PostgreSQL and keeps the command's existing behavior:

- It targets `e2e-test@preview.local`.
- It is idempotent for that user's demo data.
- It wraps mutations in a database transaction.
- It refuses non-local databases unless `--force` is supplied.
- It never depends on a live market-data service.

## Verification

Add unit coverage proving that:

- The brokerage symbols are exactly `AAPL`, `NVDA`, and `TSLA`.
- The cold wallet contains `BTC-USD`.
- Every holding has multiple purchases whose quantities total the holding quantity.
- Every holding has a fixed cached price.
- Current asset, liability, and net-worth totals are calculated consistently.
- Snapshot generation returns 180 entries and its final entry matches the current portfolio exactly.

Run the focused unit test first through a failing and passing cycle, then run formatting, linting, type checking, the complete unit suite, and `pnpm seed:demo` against the local development database.

## Out of Scope

- Fetching current or historical market prices.
- Reproducing exact real-world market history.
- Adding new account, holding, or transaction schema fields.
- Changing preview authentication or seed command safety rules.
