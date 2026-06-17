# Assets Tracker - New Feature List

Audit date: 2026-06-17

This is a fresh, codebase-aligned feature plan. It is based on the current app
routes, Prisma schema, services, and existing product docs rather than the older
tracker statuses alone. Several older docs are stale; this list treats shipped
features as shipped when the current code shows the route, model, component, or
service exists.

## Sources Reviewed

- Product intent: `PRODUCT.md`, `README.md`, `DESIGN.md`
- Existing planning docs: `docs/ENHANCEMENT_PLAN.md`, `docs/ROADMAP.md`,
  `docs/SUGGESTIONS.md`, `docs/DATABASE.md`, `docs/UI_UX.md`,
  `docs/CODE_QUALITY.md`, `docs/BUGS.md`, `docs/PERFORMANCE.md`
- Code surface: `src/app/(main)/*`, `src/app/api/*`, `src/components/*`,
  `src/lib/services/*`, `prisma/schema.prisma`
- Next.js guidance: installed Next.js 16 docs under
  `node_modules/next/dist/docs/`, especially App Router and `cacheComponents`

## Current Product Baseline

The app already covers the core personal finance tracker surface:

- Authenticated, multi-user net-worth dashboard.
- Accounts, holdings, cash transactions, holding transactions, account
  ordering, pinning, archiving, and mobile-first account details.
- Market data refresh through Yahoo Finance and CoinGecko fallback, plus FX
  rate refresh and stale-rate warnings.
- Multi-currency snapshots with lossless breakdown history.
- Goals, projections, stock watchlist, allocation, currency exposure, portfolio
  heatmap, top movers, attribution, cash-flow analysis, and history views.
- Recurring cash transactions and recurring investments materialized by the
  existing daily snapshot cron.
- Settings for base currency and locale, data export/import, privacy/security
  controls, install/PWA prompts, version/changelog, theme, color schema, and
  density controls.
- Operational foundations: `/api/health`, `CronRun` audit rows, Sentry-aware
  logger, CSP, rate limiting, unit tests, Playwright smoke coverage, and
  bundle-size CI.

Do not re-plan these as "new" unless the feature below explicitly extends them.

## Implementation Guardrails

- This project runs Next.js `16.2.2` with `cacheComponents: true`. New features
  that read server data should follow the local cache pattern: `"use cache"`,
  `cacheLife`, `cacheTag`, and explicit `revalidateTag` from mutation routes.
- Do not assume old route-segment caching behavior. Check the installed
  Next.js docs before adding route config, runtime config, or caching APIs.
- Every user-facing feature needs `en-US` and `zh-TW` message parity.
- Money math should stay Decimal-backed at the database/service boundary.
  Client rendering may format numbers, but source of truth should not be floats.
- Every mutation needs auth, ownership scoping, rate limiting, validation, cache
  invalidation, and a focused unit or E2E test when behavior is non-trivial.
- Mobile behavior should preserve the app's native-feeling patterns: bottom
  sheets, swipe actions, large titles, haptics, safe areas, and privacy mode.

## Recommended Release Sequence

### 0.7 - Ledger Truth

Build the data model needed for trustworthy performance, tax, and restore
features.

1. Explicit transaction dates
2. Cost-basis foundation on holding transactions
3. Merge-first import and safer restore flow
4. True account deletion
5. Price provenance and manual price override groundwork

### 0.8 - Performance Analytics

Use the improved ledger to answer "what changed and why?"

1. Realized/unrealized P&L
2. Dividend and income tracking
3. Analysis Phase 3: custom ranges, YoY, CSV export, PDF later
4. Benchmark overlay and volatility/drawdown KPIs
5. Labelled snapshots and reconciliation warnings

### 0.9 - Automation and Personalization

Add features that make daily use easier once the accounting base is solid.

1. Price alerts
2. Multi-broker CSV importer
3. Dashboard widget customization
4. Cross-device preference sync
5. In-app help and keyboard shortcut reference

### 1.0+ - Connected Finance

Larger features with greater compliance, privacy, and operational risk.

1. Read-only brokerage sync through Plaid/SnapTrade or equivalent
2. Household/read-only sharing
3. Tax-lot selection and year-end tax export
4. Real estate and vehicle composite assets
5. AI portfolio insights after ledger and cost-basis data is reliable

## Feature Backlog

### NF1 - Explicit Transaction Dates

Priority: P0

Current state:

- `HoldingTransaction` and `CashTransaction` have `createdAt`, but no explicit
  user-editable transaction date.
- Recurring rows have `occurrenceDate`, which already proves the app needs an
  event date separate from insertion time.

Feature:

- Add a `date` field to both transaction tables.
- Let users backdate deposits, withdrawals, buys, sells, and edits.
- Update history, analysis, and transaction lists to use event date by default,
  with created time retained for audit/debugging.

First slice:

- Prisma migration with nullable/backfilled `date`, then make it required.
- Add indexes for account/holding timeline reads.
- Update create/edit forms and validators.

Acceptance checks:

- A buy entered today for last month appears in last month's analysis bucket.
- Existing rows retain current behavior after backfill.
- Import/export preserves both transaction date and created timestamp.

### NF2 - Cost Basis and P&L Foundation

Priority: P0

Current state:

- `HoldingTransaction` records quantity but not execution price or fee.
- `PriceCache` stores only current price.
- Existing docs identify this as the keystone for P&L, tax lots, and richer
  attribution.

Feature:

- Add `price`, `fee`, and optionally `priceCurrency` to `HoldingTransaction`.
- Require execution price for new BUY/SELL rows.
- Preserve nullable fields for legacy transactions.
- Show clear "basis unavailable" states when legacy data is incomplete.

First slice:

- Schema migration and validators.
- Holding form support for price and fee.
- Service helpers for average cost, total cost, and current unrealized P&L.

Acceptance checks:

- Holdings table can display cost basis, market value, unrealized gain/loss,
  and gain/loss percentage.
- Editing a historical transaction updates cost basis deterministically.
- Legacy holdings with missing basis do not show misleading gain/loss.

### NF3 - Realized and Unrealized Performance

Priority: P1

Depends on: NF1, NF2

Feature:

- Add portfolio, account, and holding-level performance views.
- Split realized gains, unrealized gains, cash contributions, FX movement, and
  market movement where the data supports it.

First slice:

- Add service-layer math over holding transactions.
- Add P&L columns to desktop holdings table and compact summary rows on mobile.
- Add an Analysis card for realized/unrealized totals.

Acceptance checks:

- SELL transactions reduce quantity and record realized gain/loss.
- Multi-currency holdings convert basis and market value into base currency.
- Unit tests cover partial sells and fee handling.

### NF4 - Dividend and Income Tracking

Priority: P1

Current state:

- Cash transactions can record deposits/withdrawals, but there is no income
  event tied to a holding.

Feature:

- Add income events for dividends, interest, coupons, and other investment
  income.
- Tie events to holdings when possible, or accounts when not.
- Add trailing twelve month income, yield on cost, and income by source.

First slice:

- Add `IncomeEvent` with amount, currency, type, holding/account relation,
  ex-date/pay-date, and note.
- Add an account detail income section and Analysis income card.

Acceptance checks:

- Income events affect cash balance only when the user chooses to deposit them.
- Export/import preserves income events.
- Analysis can show income separately from contributions.

### NF5 - Analysis Phase 3

Priority: P1

Current state:

- Analysis already includes monthly change, assets/liabilities, cash flow,
  category trend, top movers, and attribution.
- `docs/UI_UX.md` lists medium-term gaps: custom date range, YoY, CSV/PDF,
  benchmark overlay, and volatility/drawdown.

Feature:

- Add custom date ranges, yearly summary, YoY comparison, CSV export, and
  volatility/drawdown KPIs.
- Defer PDF until CSV and table export primitives are stable.

First slice:

- Add a reusable date range control.
- Add CSV export for currently visible analysis data.
- Add max drawdown and monthly standard deviation KPIs.

Acceptance checks:

- Range state persists like existing preset range state.
- CSV output matches visible table/chart source data.
- Empty and sparse history states do not render misleading volatility metrics.

### NF6 - Benchmark Overlay

Priority: P1

Depends on: stable market data cache design

Feature:

- Compare net-worth growth against benchmarks such as S&P 500, NASDAQ, TWII,
  inflation, or a user-selected symbol.
- Normalize both series to 100 at the selected period start.

First slice:

- Add benchmark symbol definitions and price-history storage separate from the
  current point-in-time `PriceCache`.
- Add one benchmark overlay to the trend or analysis chart.

Acceptance checks:

- Benchmark data is cached and does not fetch on every render.
- Missing benchmark dates align gracefully with snapshot dates.
- User portfolio and benchmark are visually distinguishable in both themes.

### NF7 - Manual Price Overrides and Price Provenance

Priority: P1

Current state:

- `PriceCache` stores symbol, price, currency, and updated time, but not source.
- Docs already suggest a `source` field and manual overrides.

Feature:

- Store market data source: Yahoo, CoinGecko, manual, import, or broker sync.
- Let users override a stale or unavailable price for `OTHER`, private assets,
  thinly traded funds, options, property proxies, and long-tail crypto.

First slice:

- Add `source` and optional `manualPriceUpdatedAt`.
- Add a manual override action from holding detail/edit.
- Show provenance in price freshness UI.

Acceptance checks:

- Manual prices survive market refreshes unless the user opts back into live
  provider pricing.
- The dashboard warns when net worth includes manual or stale prices.

### NF8 - Labelled Snapshots and Reconciliation

Priority: P1

Current state:

- Snapshots are automated and lossless, but users cannot annotate major life
  events or corrections.
- Enhancement docs mention reconciliation drift alerts.

Feature:

- Allow labelled snapshots such as "bonus paid", "property revalued",
  "brokerage migrated", or "manual correction".
- Add a reconciliation job that flags large differences between snapshot totals
  and reconstructed current balances.

First slice:

- Add optional snapshot label/note fields.
- Add UI to label the latest snapshot.
- Add service warning when drift exceeds a configured threshold.

Acceptance checks:

- Labels appear on history and trend chart tooltips.
- Reconciliation warnings never mutate data automatically.

### NF9 - Merge-First Import and Safer Restore

Priority: P0

Current state:

- Settings has data export/import routes and UI.
- Existing docs repeatedly flag destructive import and restore safety as a
  remaining risk.

Feature:

- Make import merge-first by default, with explicit replace mode gated behind a
  stronger confirmation.
- Preview import impact before writing: created, updated, skipped, conflicted,
  and invalid rows.

First slice:

- Add a dry-run mode to `/api/settings/data`.
- Add stable external IDs or deterministic matching where possible.
- Surface import conflicts in Settings.

Acceptance checks:

- Re-importing the user's own export is idempotent.
- Import errors do not expose raw server exception messages.
- Replace mode is impossible to trigger accidentally.

### NF10 - True Account Deletion

Priority: P0

Current state:

- User data export exists.
- Prisma relations mostly cascade from `User`.
- Current docs say GDPR deletion is still missing as a real endpoint and flow.

Feature:

- Add a Settings flow to delete the current user account and all app data.
- Require a deliberate confirmation step and explain irreversibility.

First slice:

- Add `DELETE /api/account` or equivalent route.
- Delete the `User` row and rely on cascade relations.
- Sign out and clear local client preferences after success.

Acceptance checks:

- Deleting a user removes accounts, holdings, transactions, settings,
  snapshots, goals, stock watch items, sessions, and auth accounts.
- The endpoint cannot delete another user.
- E2E or API tests cover the destructive flow against a test user.

### NF11 - Price Alerts

Priority: P2

Current state:

- Watchlist and price refresh exist.
- Cron audit and health checks exist, so scheduled alerting now has an
  operational base.

Feature:

- Let users create alerts for above, below, percent up, percent down, and stale
  price conditions.
- Support in-app notifications first, then email or web push.

First slice:

- Add `PriceAlert` model and CRUD UI from holding/watchlist rows.
- Evaluate alerts during existing market refresh or daily cron.
- Record `lastFiredAt` to prevent alert spam.

Acceptance checks:

- Alerts do not fire repeatedly without a reset condition.
- Alert evaluation is scoped per user.
- Failures are logged through the existing logger/Sentry path.

### NF12 - Multi-Broker CSV Importer

Priority: P2

Depends on: NF1, NF2, NF9

Feature:

- Import transactions from broker CSV exports before attempting live brokerage
  API sync.
- Start with a mapping wizard rather than hard-coding one broker.

First slice:

- Add CSV upload with column mapping for symbol, date, side, quantity, price,
  fee, currency, and account.
- Save reusable import presets locally or in settings.

Acceptance checks:

- A preview shows exactly which rows will be created or skipped.
- Duplicate import rows do not double-count quantity or cash.
- Imported trades feed cost basis and P&L.

### NF13 - Spending Categories and Cashflow Insights

Priority: P2

Current state:

- Cash transactions, recurring cash transactions, projections, and cash-flow
  analysis exist.
- Cash transactions have no category field.

Feature:

- Add cashflow categories for deposits, withdrawals, recurring rules, and
  optional budgeting/spending insights.
- Use categories to improve projection assumptions and savings-rate analysis.

First slice:

- Add `CashCategory` or a simple enum/string category on cash transactions.
- Add category picker on cash transaction forms and recurring cash rules.
- Add monthly category breakdown in Analysis.

Acceptance checks:

- Existing uncategorized transactions remain valid.
- Category totals reconcile to existing contribution/withdrawal totals.
- Projection defaults can optionally use trailing categorized cashflow.

### NF14 - Dashboard Customization

Priority: P2

Current state:

- Dashboard has many useful cards: net worth, trend, allocation, currency
  exposure, goals, projections, heatmap, history heatmap, and watchlist.
- Density and sidebar preferences already prove the app supports user UI
  preferences.

Feature:

- Let users choose visible dashboard widgets and reorder them.
- Keep a sensible default layout for new users.

First slice:

- Add a dashboard layout setting, likely persisted on `Setting`.
- Add a compact edit mode with drag handles on desktop and move controls on
  mobile.

Acceptance checks:

- Hidden widgets do not fetch heavy data unnecessarily.
- Layout survives reloads and second-device login if stored server-side.
- Empty dashboards always keep a way back into customization.

### NF15 - Cross-Device Preference Sync

Priority: P2

Current state:

- `Setting` stores base currency and locale.
- Color schema, density, sidebar collapsed state, and several UI preferences are
  currently local/client-side.

Feature:

- Persist durable preferences to `Setting`, while keeping localStorage as an
  immediate hydration seed where needed.

First slice:

- Add `colorSchema` and `density` to `Setting`.
- Update settings PATCH and providers to reconcile server value and local value.

Acceptance checks:

- A user changing density on one device sees it on another device after login.
- First paint does not flash through the wrong layout or color schema.

### NF16 - In-App Help and Keyboard Reference

Priority: P2

Current state:

- Command palette and keyboard shortcuts exist.
- Docs mention a missing keyboard shortcut reference and in-app help.

Feature:

- Add a help surface with shortcuts, data model explanations, privacy mode
  behavior, import/export guidance, and market data freshness explanations.

First slice:

- Add a help command to the command palette.
- Add `docs/KEYBOARD_SHORTCUTS.md` or an in-app generated equivalent.
- Add a compact help dialog/page reachable from Settings.

Acceptance checks:

- Every shortcut shown in help is backed by code.
- Help copy is localized.
- Help is accessible from desktop and mobile.

### NF17 - Real Estate and Vehicle Composite Assets

Priority: P3

Current state:

- Account categories include `PROPERTY` and `VEHICLE`, but the model treats
  them like generic account balances/holdings.

Feature:

- Model a property or vehicle as an asset with optional linked debt, valuation
  history, purchase price, and notes.

First slice:

- Add optional asset profile metadata for property/vehicle accounts.
- Add manual valuation history using the snapshot/price override patterns.

Acceptance checks:

- Net worth can show gross asset value, linked liability, and net equity.
- Manual valuations are clearly distinguished from market-priced holdings.

### NF18 - Tax Lots and Year-End Tax Export

Priority: P3

Depends on: NF1, NF2, NF3

Feature:

- Track FIFO, average cost, and later specific-lot cost basis.
- Export year-end realized gains, income, and transaction summaries.

First slice:

- Implement FIFO lot accounting in services.
- Add a tax-year report as CSV.

Acceptance checks:

- Partial sells consume lots deterministically.
- Fees are included according to the chosen accounting policy.
- Export can be regenerated from ledger data without hidden client state.

### NF19 - Household or Read-Only Sharing

Priority: P3

Depends on: NF10 and security docs

Feature:

- Allow a user to grant another account read-only access to selected views, such
  as dashboard, goals, or reports.

First slice:

- Add an invitation/share model with read-only permissions.
- Start with dashboard-only access.

Acceptance checks:

- Shared users cannot mutate accounts, holdings, settings, imports, or exports.
- Revocation takes effect immediately.
- Privacy mode remains per viewer.

### NF20 - Read-Only Brokerage Sync

Priority: P3

Depends on: NF9, NF12, mature security posture

Feature:

- Connect Plaid, SnapTrade, or another provider to read balances and holdings.
- Treat provider data as imported/reconciled data, not blindly authoritative.

First slice:

- Choose provider and threat model.
- Add account linking for read-only sandbox mode.
- Reconcile provider holdings against existing holdings without overwriting
  user-entered data.

Acceptance checks:

- Disconnecting a provider stops future syncs and removes stored tokens.
- Sync conflicts are visible before applying changes.
- Provider failures do not corrupt manual ledger data.

### NF21 - AI Portfolio Insights

Priority: P4

Depends on: cost basis, income, benchmark, and data quality work

Feature:

- Generate plain-language explanations of portfolio changes, concentration
  risk, stale data, and goal progress.

First slice:

- Add deterministic insight payload generation first.
- Use AI only to phrase verified facts, not to compute financial truth.

Acceptance checks:

- Insights cite the underlying numbers used.
- The feature never gives personalized financial advice without explicit
  compliance review and disclaimers.
- Users can disable AI features entirely.

## Deferred or Not Recommended Yet

- Full live brokerage sync before CSV import and merge-first restore are stable.
- Tax export before cost basis, explicit dates, and realized gains are reliable.
- AI advice before deterministic insight payloads exist.
- Household sharing before account deletion, security docs, and permission
  boundaries are complete.
- Decorative dashboard redesigns that do not improve repeated finance workflows.

## Cross-Feature Test Plan

Use this as the minimum bar for each release:

- Unit tests for service-layer money math, especially Decimal, FX conversion,
  cost basis, P&L, and lot accounting.
- API tests for auth, ownership, validation failures, and rate limits on new
  mutation routes.
- Playwright coverage for at least one happy path and one error/empty state for
  each major user-facing feature.
- Import/export round-trip tests whenever the schema changes.
- i18n key parity check for `messages/en-US.json` and `messages/zh-TW.json`.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, and a
  production build before release.
