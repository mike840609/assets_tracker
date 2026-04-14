# Asset Tracker — Suggestions

## Overview

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| 1 | Fix hardcoded USD in trend chart tooltip | Bug Fix | 🔴 High | 10 min | ✅ Done |
| 2 | Deduplicate balance editor into `<InlineBalanceEditor>` | Code Quality | 🟡 Medium | 30 min | ✅ Done |
| 3 | Remove test-rate API route | Cleanup | 🟢 Low | 5 min | ✅ Done |
| 4 | Dashboard "Refresh Prices" button | Feature | 🔴 High | 1-2 hrs | ✅ Done |
| 5 | "Last Updated" timestamp for prices on dashboard | Feature | 🔴 High | 1-2 hrs | ✅ Done |
| 6 | Dark/Light/System theme toggle | Feature | 🟡 Medium | 1-2 hrs | ✅ Done |
| 8 | Authentication & multi-user support | Feature | 🔴 High | 6-10 hrs | ✅ Done |
| 10 | Error handling & loading states | Architecture | 🟡 Medium | 3-4 hrs | ✅ Done |
| 11 | Fix N+1 query patterns | Architecture | 🟡 Medium | 3-5 hrs | ✅ Done |
| 12 | Input validation on API routes | Architecture | 🟡 Medium | 2-3 hrs | ✅ Done |
| 18 | Automated Daily Snapshots (Cron) | Feature | 🔴 High | 1-2 hrs | ✅ Done |
| 19 | Internationalization (en-US / zh-TW) | Feature | 🟡 Medium | 3-4 hrs | ✅ Done |
| 20 | Inline account name editing | UX | 🟡 Medium | 1-2 hrs | ✅ Done |
| 21 | Holding & cash transaction history | Feature | 🔴 High | 3-4 hrs | ✅ Done |
| 7 | Cost basis & gain/loss tracking | Feature | 🔴 High | 4-6 hrs | ❌ Not Done |
| 9 | Data import/export | Feature | 🔴 High | 4-6 hrs | ✅ Done |
| 13 | Account reordering & archiving | UX | 🟡 Medium | 3-4 hrs | ❌ Not Done |
| 14 | Mobile-responsive holdings table | UX | 🟡 Medium | 2-3 hrs | ✅ Done |
| 15 | Monthly/yearly performance reports | Analytics | 🟡 Medium | 4-5 hrs | ❌ Not Done |
| 16 | Currency exposure chart | Analytics | 🟢 Low | 2-3 hrs | ✅ Done |
| 17 | Dividend / income tracking | Analytics | 🟡 Medium | 4-6 hrs | ❌ Not Done |
| 22 | Pagination / Infinite Scroll for Transactions | Performance | 🟡 Medium | 2-3 hrs | ✅ Done |
| 23 | Two-Factor Authentication (2FA) | Security | 🔴 High | 4-6 hrs | ❌ Not Done |
| 24 | Plaid / Brokerage API Sync | Feature | 🔴 High | 10+ hrs | ❌ Not Done |
| 25 | Customizable Dashboard Widgets | UX | 🟢 Low | 3-5 hrs | ❌ Not Done |
| 26 | Add test coverage (Vitest + Playwright) | Testing | 🔴 High | 8-12 hrs | ❌ Not Done |
| 27 | Add error boundary pages (error.tsx / not-found.tsx) | Reliability | 🔴 High | 1-2 hrs | ❌ Not Done |
| 28 | Fix missing auth checks on API routes | Security | 🔴 High | 30 min | ❌ Not Done |
| 29 | Validate environment variables at startup | DX / Reliability | 🔴 High | 1 hr | ❌ Not Done |
| 30 | Add structured logging (Pino) | Observability | 🟡 Medium | 3-4 hrs | ❌ Not Done |
| 31 | Add API rate limiting | Security | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 32 | Validate query parameters with Zod | Security | 🟡 Medium | 1 hr | ❌ Not Done |
| 33 | Add timeout guards to price service | Reliability | 🟡 Medium | 30 min | ❌ Not Done |
| 34 | Add .env.example file | DX | 🟢 Low | 15 min | ❌ Not Done |
| 35 | Utilize snapshot breakdown data in history service | Feature | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 36 | Non-destructive data import (merge strategy) | Reliability | 🟡 Medium | 3-4 hrs | ❌ Not Done |
| 37 | Expand supported currency list | Feature | 🟢 Low | 1 hr | ❌ Not Done |
| 38 | Fix transaction pagination (fetches N*page rows) | Performance | 🔴 High | 1 hr | ✅ Done |
| 39 | Filter PriceCache query on account detail page | Performance | 🔴 High | 15 min | ✅ Done |
| 40 | Fix O(n²) symbol lookup in accounts page | Performance | 🟡 Medium | 30 min | ✅ Done |
| 41 | Reduce client bundle size (date-fns) | Performance | 🟡 Medium | 1 hr | ✅ Done |
| 42 | Add `select` to reduce over-fetching in API routes | Performance | 🟢 Low | 1 hr | ❌ Not Done |
| 43 | Add aria-labels to icon-only buttons | Accessibility | 🔴 High | 1 hr | ❌ Not Done |
| 44 | Fix color-only differentiation for assets/liabilities | Accessibility | 🔴 High | 1 hr | ❌ Not Done |
| 45 | Add inline form validation errors | UX | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 46 | Improve empty states with clear CTAs | UX | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| 47 | Add account search/filter | UX | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| 48 | Add table accessibility attributes | Accessibility | 🟡 Medium | 1 hr | ❌ Not Done |
| 49 | Use native `confirm()` → proper confirmation dialogs | UX | 🟢 Low | 2 hrs | ❌ Not Done |
| 50 | Add auth/ownership checks to holding mutation routes | Security | 🔴 High | 1-2 hrs | ❌ Not Done |
| 51 | Validate snapshots query parameters with Zod | Reliability | 🔴 High | 30-60 min | ❌ Not Done |
| 52 | Add timeout guards to external pricing calls | Reliability | 🔴 High | 30-60 min | ❌ Not Done |
| 53 | Make data import merge-first (non-destructive) by default | Reliability | 🔴 High | 3-4 hrs | ❌ Not Done |
| 54 | Add startup environment validation module (`env.ts`) | DX / Reliability | 🔴 High | 1 hr | ❌ Not Done |
| 55 | Replace console logs with structured logging | Observability | 🟡 Medium | 2-4 hrs | ❌ Not Done |
| 56 | Add baseline automated tests (unit/API/E2E smoke) | Testing | 🔴 High | 1-2 days | ❌ Not Done |
| 57 | Improve accessibility semantics on controls/tables | Accessibility | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 58 | Add composite database indexes for hot query paths | Performance | 🔴 High | 1-2 hrs | ✅ Done |
---


## 2026-04-10 Targeted Suggestions (Latest Review)

> Added from the latest code review so active items are tracked in this canonical file (`SUGGESTIONS.md`).

50. **Add auth/ownership checks on holding mutations** (`POST/PATCH/DELETE /api/accounts/[id]/holdings`) to enforce defense-in-depth and prevent cross-account writes if middleware changes.
51. **Validate `/api/snapshots` query params with Zod** (`from`, `to`, `currency`) and return `400` for invalid values.
52. **Add timeout guards in `price-service.ts`** for Yahoo and CoinGecko calls to avoid long-hanging refresh operations.
53. **Change import default to merge/upsert strategy** in `POST /api/settings/data`; keep destructive replace as explicit opt-in.
54. **Add startup env validation** via `src/lib/env.ts` instead of direct non-null assertions on `process.env`.
55. **Adopt structured logging** (e.g., Pino) to replace scattered `console.*` for production debugging/monitoring.
56. **Establish baseline automated tests** (unit + API integration + one E2E smoke path).
57. **Improve accessibility semantics** on icon-only controls and sortable tables (`aria-label`, `aria-expanded`, `aria-sort`, keyboard handlers).

---
## Details (Pending Tasks)

### 7. Cost Basis & Gain/Loss Tracking
BUY/SELL transactions exist and are recorded, but have no `price` field — so cost basis can't be computed.

- Add a `price` (Decimal) column to `HoldingTransaction` to record purchase/sale price
- Compute **average cost basis**, **unrealized P&L**, and **total return %** per holding
- Display gain/loss with green/red coloring on the account detail page


### 13. Account Reordering & Archiving
`isActive` exists on the `Account` model but there is no UI to archive/unarchive. No way to reorder accounts.

- Add an "Archive" option in the account actions menu (instead of only hard delete)
- Show archived accounts in a collapsed section
- Add `sortOrder` field for manual drag-to-reorder


### 15. Monthly/Yearly Performance Reports
The trend chart shows raw net worth values but doesn't compute period-over-period growth.

- "Performance" view with monthly/yearly % change
- Bar chart showing month-over-month changes
- Summary stats: best month, worst month, average growth


### 17. Dividend / Income Tracking
Many stock/ETF holders care about dividend income, not just price appreciation.

- Add a `DIVIDEND` transaction type to `HoldingTransaction`
- Track dividend income per holding and aggregate monthly/yearly
- Display as a separate income chart on the dashboard


### 23. Two-Factor Authentication (2FA)
Financial applications require high security. Relying solely on a password leaves user data vulnerable to credential stuffing or simple password breaches.

- Add Time-based One-Time Password (TOTP) support using authenticator apps
- Store encrypted 2FA secrets in the database and require the 6-digit code on login
- Provide backup recovery codes

### 24. Plaid / Brokerage API Sync
Currently, users must manually enter transactions or import via CSV, which is time-consuming and error-prone.

- Integrate with Plaid or similar aggregators to automatically sync bank account balances
- Use brokerage APIs (or aggregators like SnapTrade) to automatically import historical trades and live holdings
- Add a periodic sync job to update balances automatically

### 25. Customizable Dashboard Widgets
The current dashboard is static. Users may prioritize different information (e.g., currency exposure vs. recent transactions vs. net worth trend).

- Break down the dashboard into discrete, draggable components (widgets)
- Allow users to reorder widgets, hide ones they don't care about, and save their layout preference to the database
- Provide a "Widget Library" to add new visual modules easily


### 26. Add Test Coverage (Vitest + Playwright)
The codebase has **zero test files** and no testing dependencies installed. This makes refactoring risky and regressions easy to miss.

- Install **Vitest** for unit/integration tests and **Playwright** for E2E tests
- Prioritize testing the service layer first (`src/lib/services/*.ts`) since it contains the most business logic (currency conversion, price fetching, net worth calculation)
- Add unit tests for validators (`src/lib/validators.ts`) and serializers (`src/lib/types.ts`)
- Add API route integration tests for CRUD operations
- Add E2E tests for critical flows: login, account creation, holding management, dashboard rendering
- **Affected files**: `package.json`, new `vitest.config.ts`, new `playwright.config.ts`, new `tests/` directory


### 27. Add Error Boundary Pages (error.tsx / not-found.tsx)
Every route group has `loading.tsx` skeleton files, but there are **zero `error.tsx` or `not-found.tsx` files**. Unhandled runtime errors or 404s show the default Next.js error page instead of a branded recovery UI.

- Add `src/app/error.tsx` (root-level catch-all) and `src/app/(main)/error.tsx` with a user-friendly error message and "Try Again" button
- Add `src/app/not-found.tsx` for invalid routes with a link back to the dashboard
- Consider adding `src/app/(main)/accounts/[id]/not-found.tsx` for invalid account IDs
- **Affected files**: new `src/app/error.tsx`, `src/app/(main)/error.tsx`, `src/app/not-found.tsx`


### 28. Fix Missing Auth Checks on API Routes
Two API route handlers do not call `auth()` to verify the user session:
- `POST /api/accounts/[id]/holdings` (`src/app/api/accounts/[id]/holdings/route.ts`) — creates holdings without verifying the requesting user owns the account
- `GET /api/search` (`src/app/api/search/route.ts`) — performs Yahoo Finance lookups without session validation

While middleware protects these routes at the edge layer, the handlers should still validate `session.user.id` for **defense-in-depth** and to correctly associate data with the authenticated user.

- Add `const session = await auth()` guard at the top of each handler
- Return `401` if no session, and verify account ownership where applicable
- **Affected files**: `src/app/api/accounts/[id]/holdings/route.ts`, `src/app/api/search/route.ts`


### 29. Validate Environment Variables at Startup
Environment variables are accessed with TypeScript non-null assertions (e.g., `process.env.DATABASE_URL!`). If a required variable is missing, the app crashes deep in the stack with an unhelpful error message.

- Create `src/lib/env.ts` using **Zod** (already a dependency) or `@t3-oss/env-nextjs` to validate all required env vars at module load time
- Provide clear, human-readable error messages listing which variables are missing
- Import from `env.ts` instead of accessing `process.env` directly
- **Affected files**: new `src/lib/env.ts`, `src/lib/prisma.ts`, `src/auth.config.ts`, `src/app/api/cron/snapshot/route.ts`


### 30. Add Structured Logging (Pino)
All logging uses `console.log`, `console.error`, and `console.warn`. In production, these lack timestamps, request context (userId, route), and structured fields, making debugging difficult.

- Install **Pino** (lightweight, JSON-structured logger) with `pino-pretty` for dev
- Create `src/lib/logger.ts` with child loggers for services
- Replace `console.*` calls in service files with structured log calls including context (userId, symbol, duration)
- **Affected files**: new `src/lib/logger.ts`, `src/lib/services/price-service.ts`, `src/lib/services/exchange-rate-service.ts`, `src/lib/services/net-worth-service.ts`


### 31. Add API Rate Limiting
No API endpoints have rate limiting. A malicious or misconfigured client could spam expensive operations like price refresh, exchange rate refresh, or data export, causing external API quota exhaustion or database load.

- Add rate limiting middleware, especially on:
  - `POST /api/prices/refresh` (calls Yahoo Finance / CoinGecko)
  - `POST /api/exchange-rates/refresh` (calls frankfurter.app / er-api)
  - `GET/POST /api/settings/data` (full database export/import)
- Use a lightweight in-memory approach (e.g., `Map`-based token bucket) or `upstash/ratelimit` for serverless-friendly limiting
- **Affected files**: new rate limit utility, API route files listed above


### 32. Validate Query Parameters with Zod
Date range query parameters in `/api/snapshots` and history-related endpoints are parsed with raw `new Date()` without Zod validation. Invalid or malformed date strings could produce `NaN` dates and cause silent data corruption or unexpected query results.

- Add Zod schemas for query parameters (date ranges, pagination params)
- Apply `safeParse()` and return `400` for invalid inputs
- **Affected files**: `src/lib/validators.ts`, `src/app/api/snapshots/route.ts`


### 33. Add Timeout Guards to Price Service
`exchange-rate-service.ts` wraps external API calls in a `withTimeout(2000)` guard, but `price-service.ts` has **no timeout protection**. If Yahoo Finance or CoinGecko responds slowly, the entire price refresh can hang indefinitely, blocking the user.

- Add `withTimeout()` (or `AbortSignal.timeout()`) to Yahoo Finance and CoinGecko fetch calls in `price-service.ts`
- Match the 2000ms pattern already used in the exchange rate service
- **Affected files**: `src/lib/services/price-service.ts`


### 34. Add .env.example File
No `.env.example` file exists. New developers must read `CLAUDE.md` to discover required environment variables. A standard `.env.example` with placeholder values and comments improves onboarding.

- Create `.env.example` with all required variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CRON_SECRET`) and descriptive comments
- **Affected files**: new `.env.example`


### 35. Utilize Snapshot Breakdown Data in History Service
`NetWorthSnapshot.breakdown` stores per-account JSON data (account values with their original currencies), but `history-service.ts` (lines 64-75) only partially uses it. Currently, historical snapshots are converted using a single exchange rate applied to the total, which loses accuracy when accounts span multiple currencies.

- Fully parse the `breakdown` JSON and convert each account's value individually using the appropriate exchange rate
- Sum the individually-converted values for a more accurate historical net worth in the target currency
- **Affected files**: `src/lib/services/history-service.ts`


### 36. Non-Destructive Data Import (Merge Strategy)
The data import endpoint (`POST /api/settings/data`) **deletes all existing user data** (accounts, holdings, transactions, snapshots) before inserting imported data. This is risky — a malformed import file causes total data loss.

- Implement an **upsert/merge strategy** that matches by unique keys (account name + currency, holding symbol + account, snapshot date)
- Add a confirmation step or "dry run" mode that shows what will change before applying
- Keep the destructive "replace all" as an explicit option, not the default
- **Affected files**: `src/app/api/settings/data/route.ts`


### 37. Expand Supported Currency List
`src/lib/currencies.ts` hardcodes only 20 currencies with symbols and names, while the exchange rate APIs (frankfurter.app, er-api) support 150+. Users with accounts in unlisted currencies see raw currency codes instead of formatted values.

- Expand the static list to cover at least the top 40-50 world currencies
- Alternatively, fetch the currency list from the exchange rate API and cache it
- **Affected files**: `src/lib/currencies.ts`


### 38. Fix Transaction Pagination (Fetches N*page Rows)
The merged transaction endpoint at `src/app/api/accounts/[id]/transactions/route.ts` uses `take: limit * page` (line 14) instead of proper `skip`/`take` pagination. For page 10 with limit 20, it fetches **200 rows from each table**, merges and sorts them in JavaScript, then slices to 20 results. This gets linearly worse with every page.

```ts
// Current (line 14): fetches ALL rows up to current page
const take = limit * page;

// Fix: fetch only the rows needed for the current page from each table
// Note: because two tables are merged, you need to fetch `limit` from each
// and merge, or use a SQL UNION approach for truly optimal pagination.
```

- The root cause is that two separate tables (`HoldingTransaction` and `CashTransaction`) are merged by date, making DB-level pagination non-trivial
- **Quick fix**: Fetch `skip + limit` rows from each table (instead of `limit * page`), merge, sort, and slice — still over-fetches but bounded
- **Better fix**: Use a raw SQL `UNION ALL` query with `ORDER BY` and `LIMIT/OFFSET` to paginate at the database level
- **Affected files**: `src/app/api/accounts/[id]/transactions/route.ts`


### 39. Filter PriceCache Query on Account Detail Page
`src/app/(main)/accounts/[id]/page.tsx` line 26 fetches **every row from PriceCache** with an unfiltered `prisma.priceCache.findMany()`. For a user with 5 holdings, this still loads thousands of cached price rows for all symbols in the system.

```ts
// Current (line 26): fetches ALL price cache rows
cachedPrices: prisma.priceCache.findMany(),

// Fix: filter to only the symbols this account needs
// (requires fetching account first, or a two-step approach)
```

- The accounts list page (`src/app/(main)/accounts/page.tsx` line 45-47) already does this correctly with `where: { symbol: { in: allSymbols } }`
- Restructure to fetch the account first, then fetch prices filtered by `account.holdings.map(h => h.symbol)`
- **Affected files**: `src/app/(main)/accounts/[id]/page.tsx`


### 40. Fix O(n²) Symbol Lookup in Accounts Page
`src/app/(main)/accounts/page.tsx` lines 56-63 use `.find()` inside a `.filter()` loop to classify symbols as stock vs. crypto. For each uncached symbol, it scans the entire `allHoldings` array — O(n²) complexity.

```ts
// Current (lines 56-58): O(n) lookup per symbol
const stockSymbols = uncachedSymbols.filter((s) => {
  const h = allHoldings.find((h) => h.symbol === s); // O(n) scan
  return h && ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType);
});

// Fix: build a Map once, then look up in O(1)
const holdingBySymbol = new Map(allHoldings.map(h => [h.symbol, h]));
const stockSymbols = uncachedSymbols.filter(s => {
  const h = holdingBySymbol.get(s);
  return h && ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType);
});
```

- With many holdings this adds up; the fix is trivial and O(n) total
- **Affected files**: `src/app/(main)/accounts/page.tsx`


### 41. Reduce Client Bundle Size (date-fns)
`src/components/dashboard/dashboard-actions.tsx` (line 8-9) imports `formatDistanceToNow` from `date-fns` plus two locale objects (`zhTW`, `enUS`) in a `"use client"` component. date-fns is tree-shakeable but the locale modules are large (~15-20KB each).

- Consider using the native `Intl.RelativeTimeFormat` API instead, which has zero bundle cost
- Alternatively, compute the "time ago" string on the server and pass it as a prop, eliminating the client-side dependency entirely
- **Affected files**: `src/components/dashboard/dashboard-actions.tsx`


### 42. Add `select` to Reduce Over-Fetching in API Routes
Several API route handlers use `include: { holding: true }` or `include: { account: true }` which fetches **all columns** from related models when only a few fields are needed.

Examples:
- `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts` line 15: `include: { holding: true }` — only needs `id`, `quantity`, `accountId`
- Same file line 54: `include: { account: true }` — only needs `id` for ownership check

- Replace `include` with `select` specifying only the needed columns
- Reduces data transfer from the database and memory usage
- **Affected files**: `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts`, `src/app/api/accounts/[id]/holdings/route.ts`


### 43. Add aria-labels to Icon-Only Buttons
Multiple interactive elements across the app use icons without text and lack `aria-label` attributes, making them invisible to screen readers.

Affected locations:
- `src/components/layout/theme-toggle.tsx` lines 32-46: Theme toggle buttons use only `title` (not ARIA) — screen readers won't announce purpose
- `src/components/dashboard/dashboard-actions.tsx` line 85: RefreshCw icon button lacks `aria-label`
- `src/components/accounts/transaction-history.tsx` line 222: MoreHorizontal "..." menu button has no accessible name
- `src/components/accounts/accounts-list.tsx` line 318: Chevron expand/collapse SVG icon lacks label
- `src/components/accounts/account-detail.tsx` line 327: Dropdown trigger icon button lacks label

- Add `aria-label="Toggle theme"`, `aria-label="Refresh prices"`, `aria-label="More actions"`, etc. to each icon-only interactive element
- For expand/collapse, also add `aria-expanded={isExpanded}` to communicate state
- **Affected files**: `src/components/layout/theme-toggle.tsx`, `src/components/dashboard/dashboard-actions.tsx`, `src/components/accounts/transaction-history.tsx`, `src/components/accounts/accounts-list.tsx`, `src/components/accounts/account-detail.tsx`


### 44. Fix Color-Only Differentiation for Assets/Liabilities
Several components use **green for assets and red for liabilities** as the sole visual differentiator. Users with color vision deficiency (affects ~8% of males) cannot distinguish them.

Affected locations:
- `src/components/dashboard/net-worth-card.tsx` lines 25, 33: Assets (text-green-600) and liabilities (text-red-600) with no text label
- `src/components/dashboard/accounts-summary.tsx` lines 145, 171: Badge color is the only indicator of ASSET vs LIABILITY type
- `src/components/history/history-table.tsx` lines 87-88: Positive/negative changes shown only with green/red text

- Add explicit text labels (e.g., "Assets: $X" / "Liabilities: $X") alongside the color
- For the history table, add a `+` or `-` prefix before percentage changes so the sign is visible without color
- Consider adding icons (e.g., TrendingUp/TrendingDown) as a secondary non-color cue
- **Affected files**: `src/components/dashboard/net-worth-card.tsx`, `src/components/dashboard/accounts-summary.tsx`, `src/components/history/history-table.tsx`


### 45. Add Inline Form Validation Errors
All forms display validation errors only via toast notifications. Users don't see **which field** failed validation — they must dismiss the toast, re-read the form, and guess.

Affected forms:
- `src/components/accounts/account-form.tsx` lines 72-75: Create/edit account form shows errors via `toast.error()`
- `src/components/accounts/holding-form.tsx` lines 127-159: Add holding form shows errors via toast
- `src/components/accounts/edit-holding-dialog.tsx` lines 63-68: Edit holding dialog shows errors via toast

- Parse the Zod validation error response and display messages below each invalid field
- Add `aria-invalid={true}` and `aria-describedby="field-error"` to inputs with errors
- Keep the toast as a fallback for unexpected server errors, but field-level errors should be inline
- **Affected files**: `src/components/accounts/account-form.tsx`, `src/components/accounts/holding-form.tsx`, `src/components/accounts/edit-holding-dialog.tsx`


### 46. Improve Empty States with Clear CTAs
Several views show minimal "no data" messages without guiding the user on what to do next.

Affected locations:
- `src/components/accounts/accounts-list.tsx` lines 188-191: "No accounts yet" text but **no button** to create one (the "Add Account" button is in the page header, not in the empty state)
- `src/components/history/history-table.tsx` lines 46-49: "No data" message with no explanation of when data will appear (e.g., "Snapshots are created daily — check back tomorrow")
- `src/components/accounts/transaction-history.tsx` lines 176-179: "No transactions yet" with no CTA to add a holding or cash transaction

- Replace bare text with an illustrated empty state (icon + message + primary action button)
- Example for accounts: "No accounts yet. Track your assets and liabilities by adding your first account." + [Add Account] button
- Example for history: "No snapshots yet. Your net worth history will appear here after the first daily snapshot." 
- **Affected files**: `src/components/accounts/accounts-list.tsx`, `src/components/history/history-table.tsx`, `src/components/accounts/transaction-history.tsx`


### 47. Add Account Search/Filter
The accounts list page has no search or filter functionality. Users with many accounts must scroll through the entire list organized by category to find a specific account.

- Add a search input at the top of `AccountsList` that filters accounts by name (client-side, since all accounts are already loaded)
- Optionally add type filter buttons (All / Assets / Liabilities) for quick filtering
- Use `useMemo` to derive filtered results from the search query and selected type
- **Affected files**: `src/components/accounts/accounts-list.tsx`


### 48. Add Table Accessibility Attributes
Tables across the app are missing semantic attributes that help screen readers navigate data.

Affected locations:
- `src/components/accounts/account-detail.tsx` lines 283-293: Holdings table headers lack `scope="col"` attribute
- `src/components/dashboard/accounts-summary.tsx` lines 101-112: Clickable sortable headers lack `role="button"`, `tabIndex={0}`, and keyboard event handlers (Enter/Space to trigger sort)

- Add `scope="col"` to all `<TableHead>` elements
- For sortable columns, add `role="button"`, `tabIndex={0}`, `aria-sort="ascending|descending|none"`, and `onKeyDown` handler for Enter/Space
- **Affected files**: `src/components/accounts/account-detail.tsx`, `src/components/dashboard/accounts-summary.tsx`


### 49. Replace Native `confirm()` with Proper Confirmation Dialogs
Destructive actions (delete account, bulk delete) use the browser's native `window.confirm()` dialog, which is unstyled, cannot be themed, blocks the main thread, and provides a jarring experience inconsistent with the rest of the UI.

Affected locations:
- `src/components/accounts/accounts-list.tsx` line 135: Bulk delete uses `confirm()`
- `src/components/accounts/account-detail.tsx` line 113: Delete account uses `confirm()`

- Replace with a styled `AlertDialog` component from shadcn/ui (already available in the project's ui primitives)
- Include the account name in the dialog body so users know exactly what they're deleting
- Use a red "Delete" button and a neutral "Cancel" button
- **Affected files**: `src/components/accounts/accounts-list.tsx`, `src/components/accounts/account-detail.tsx`


### 58. Add Composite Database Indexes for Hot Query Paths
Several API endpoints repeatedly filter/order by the same fields (especially account-scoped transaction history and snapshot date ranges), but the schema currently relies mostly on default single-column indexes. As row counts grow, these scans become slower and can dominate response times.

- Add composite indexes in `prisma/schema.prisma` for common access patterns, for example:
  - `HoldingTransaction(holdingId, createdAt DESC)` for account transaction history joins
  - `CashTransaction(accountId, createdAt DESC)` for merged cash/history queries
  - `NetWorthSnapshot(userId, date DESC)` for range queries in `/api/snapshots` and history chart loading
  - `PriceCache(updatedAt)` to speed stale-price checks and targeted refresh logic
- Run `EXPLAIN ANALYZE` on the slowest queries before/after to verify index usage and measure improvements
- Document expected query plans in a short note so future migrations preserve these performance characteristics
- **Affected files**: `prisma/schema.prisma`, new migration under `prisma/migrations/*`

**Implementation (2026-04-12):**
- Updated Prisma indexes to use descending date order for hot history paths:
  - `HoldingTransaction(holdingId, createdAt DESC)`
  - `CashTransaction(accountId, createdAt DESC)`
  - `NetWorthSnapshot(userId, date DESC)`
- Added `PriceCache(updatedAt)` index to speed stale-price scans.
- Added SQL migration: `prisma/migrations/202604120001_add_hot_path_indexes/migration.sql`.

---

## 2026-04-12 Performance & UI/UX Audit

> New findings from a full read of the codebase. Items are numbered starting at 59 to continue the running sequence.

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| 59 | Filter `PriceCache` query in `getNetWorthSummary` | Performance | 🔴 High | 15 min | ✅ Done |
| 60 | Remove live price fetches from accounts page SSR | Performance | 🔴 High | 30 min | ✅ Done |
| 61 | Remove dead code in `getNormalizedHistory` | Code Quality | 🟢 Low | 15 min | ✅ Done |
| 62 | Fix collapse animation (`max-h-[2000px]` → grid collapse) | Performance / UX | 🟡 Medium | 1 hr | ✅ Done |
| 63 | Fix DashboardSkeleton to match 3-chart layout (CLS) | UX | 🔴 High | 15 min | ✅ Done |
| 64 | Replace `window.confirm()` with `AlertDialog` | UX | 🟡 Medium | 1 hr | ❌ Not Done |
| 65 | Show net worth change delta in `NetWorthCard` | UX | 🔴 High | 1 hr | ❌ Not Done |
| 66 | Add assets/liabilities series to `TrendChart` | UX | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| 67 | Show full date in trend chart tooltip | UX | 🟢 Low | 15 min | ❌ Not Done |
| 68 | Unified onboarding empty state for new users | UX | 🔴 High | 2-3 hrs | ✅ Done |
| 69 | Clarify "%" column in holdings (% of holdings vs. account) | UX | 🟡 Medium | 15 min | ❌ Not Done |
| 70 | Add `aria-hidden` to decorative emoji icons | Accessibility | 🟡 Medium | 15 min | ❌ Not Done |

---

### 59. Filter `PriceCache` Query in `getNetWorthSummary`

**File:** `src/lib/services/net-worth-service.ts:19`

`prisma.priceCache.findMany()` fetches every symbol ever cached — not just the ones relevant to this user's holdings. As the table grows (more users, more symbols), this query grows with it and bloats every dashboard render.

```ts
// Current — loads every cached price in the table
const prices = await prisma.priceCache.findMany();

// Fix — filter to only the symbols this user's holdings need
const userSymbols = accounts.flatMap(a => a.holdings.map(h => h.symbol));
const prices = await prisma.priceCache.findMany({
  where: { symbol: { in: userSymbols } },
});
```

Note: `accounts` is fetched in the same `Promise.all`, so `userSymbols` can be derived right after it resolves. The three parallel queries can still run together; the filtering happens in the mapping step.


### 60. Remove Live Price Fetches from Accounts Page SSR

**File:** `src/app/(main)/accounts/page.tsx:52–85`

When any holding symbol is absent from `PriceCache`, the accounts page fires live Yahoo Finance and CoinGecko HTTP requests at SSR time, blocking page delivery. The dashboard already has an explicit **Refresh Prices** button; the accounts page does not.

**Fix:** Remove the live-fetch block. Serve whatever is in `PriceCache` (filtering by the user's symbols as in #59) and show `—` for any missing price. This aligns with the existing pattern on the dashboard and gives users clear control over when external APIs are called.


### 61. Remove Dead Code in `getNormalizedHistory`

**File:** `src/lib/services/history-service.ts:48–85`

The `canUseLossless` branch loops through snapshot breakdown data and accumulates `newAssets` / `newLiabilities` — but never assigns or returns those values. Both the `if` and `else` branches execute the identical snapshot-level rate multiplication. The condition is dead.

```ts
// Lines 53–79: this block computes newAssets/newLiabilities but discards them
// Both branches end with the same three lines:
const snapshotRate = resolveRate(allRatesMap, s.baseCurrency, targetBaseCurrency) ?? 1;
netWorth *= snapshotRate;
totalAssets *= snapshotRate;
totalLiabilities *= snapshotRate;
```

**Fix:** Remove the `canUseLossless` block entirely. If per-account currency breakdown is needed later, the snapshot `breakdown` JSON must also store each account's `type` (`ASSET`/`LIABILITY`) before the logic can work correctly.


### 62. Fix Collapse Animation (`max-h-[2000px]` → CSS Grid Collapse)

**File:** `src/components/accounts/accounts-list.tsx:330`

```tsx
className={`... ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
```

CSS `max-height` transitions interpolate over the full declared range. With a ceiling of 2000px, even a 100px panel animates over 2000px of transition time — slow and robotic on expand, instant-feeling on collapse (since closing interpolates from 0).

**Fix:** Use the CSS grid collapse pattern — zero JavaScript, no layout measurement:

```tsx
<div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
  <div className="overflow-hidden">
    {/* content */}
  </div>
</div>
```

`grid-template-rows` animating `0fr → 1fr` collapses to exact content height with correct easing in both directions.


### 63. Fix DashboardSkeleton to Match 3-Chart Layout

**File:** `src/components/dashboard/dashboard-skeleton.tsx:26–38`

The skeleton renders **2** chart placeholders in a `grid-cols-2` layout. The real dashboard renders **3** charts (`TrendChart`, `AllocationChart`, `CurrencyExposureChart`) inside a `lg:grid-cols-2 xl:grid-cols-3` grid. The mismatch causes a visible layout shift (CLS) when the skeleton is replaced by content on every dashboard load.

**Fix:**

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
  {[...Array(3)].map((_, i) => (
    <Card key={i}>
      <CardHeader className="pb-2">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  ))}
</div>
```


### 64. Replace `window.confirm()` with `AlertDialog`

**Files:**
- `src/components/accounts/account-detail.tsx:163` — delete account
- `src/components/accounts/accounts-list.tsx:135` — bulk delete

Native browser confirmation dialogs are unstyled, can't be themed, block the main thread, and are suppressed in some embedded/webview contexts. The project already has a `Dialog` component from shadcn/ui.

**Fix:** Add the `AlertDialog` component (`npx shadcn@latest add alert-dialog`) and replace both `confirm()` calls. Include the account name in the dialog body so users know exactly what they're deleting.


### 65. Show Net Worth Change Delta in `NetWorthCard`

**File:** `src/components/dashboard/net-worth-card.tsx`

Users have no at-a-glance answer to "am I up or down?" without navigating to History. The snapshot data is already fetched in `DashboardContent`; the previous snapshot's `netWorth` is one array index away.

**Fix:** Pass `previousNetWorth` into `NetWorthCard` and render a change badge inline:

```tsx
// In DashboardContent: snapshots[snapshots.length - 2]?.netWorth
const delta = netWorth - previousNetWorth;
const pct = previousNetWorth > 0 ? (delta / previousNetWorth) * 100 : 0;
// Render: "+$1,234 (+2.1%)" in green or "-$500 (-0.8%)" in red
```


### 66. Add Assets/Liabilities Series to `TrendChart`

**File:** `src/components/dashboard/trend-chart.tsx:105–113`

`totalAssets` and `totalLiabilities` are already present in every data point (`SnapshotData`), but only `netWorth` is rendered. Users can't tell from the chart whether a net worth drop was caused by falling assets or rising liabilities.

**Fix:** Add two more `<Area>` series. Toggle buttons (mirroring the existing range selector) can control visibility to keep the chart readable:

```tsx
<Area dataKey="totalAssets" stroke="var(--color-emerald-500)" fillOpacity={0.05} ... name="Assets" />
<Area dataKey="totalLiabilities" stroke="var(--color-red-500)" fillOpacity={0.05} ... name="Liabilities" />
```


### 67. Show Full Date in Trend Chart Tooltip

**File:** `src/components/dashboard/trend-chart.tsx:80–86`

The X-axis tick formatter renders `M/D` only. With multi-year history, users cannot tell which year a data point belongs to from either the axis label or the tooltip.

**Fix:** Add a `labelFormatter` to the existing `<Tooltip>`:

```tsx
<Tooltip
  labelFormatter={(label) =>
    new Date(label).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    })
  }
  ...
/>
```


### 68. Unified Onboarding Empty State for New Users

**Files:** `src/components/dashboard/dashboard-content.tsx`, `src/components/dashboard/accounts-summary.tsx`, `src/components/dashboard/trend-chart.tsx`

A brand-new user hits the dashboard and sees three separate "No data" / empty messages scattered across cards with no clear path forward.

**Fix:** In `DashboardContent`, check `summary.accounts.length === 0` before rendering charts and short-circuit to a single onboarding card:

```tsx
if (summary.accounts.length === 0) {
  return (
    <OnboardingCard>
      Welcome! Add your first account to start tracking your net worth.
      <Button asChild><Link href="/accounts">Add Account</Link></Button>
    </OnboardingCard>
  );
}
```

This avoids rendering all chart components unnecessarily and gives the user a single, clear call to action.


### 69. Clarify "%" Column in Holdings Table

**File:** `src/components/accounts/account-detail.tsx:411–414`

```ts
((h.marketValue / totalHoldingsValue) * 100).toFixed(1) + "%"
```

The percentage is share of *investment holdings only*, not the total account value (holdings + cash). For an account with $50k in holdings and $50k cash, holdings show 100% even though they represent only 50% of the account. The column header gives no hint.

**Fix (choose one):**
- Rename the column header from "%" to "% of holdings" to set correct expectations, or  
- Change the denominator to `totalValue` (`account.cashBalance + totalHoldingsValue`) to reflect share of the full account.


### 70. Add `aria-hidden` to Decorative Emoji Icons

**File:** `src/components/accounts/accounts-list.tsx` — `CATEGORY_ICONS` map (line 17), rendered around line 301

```tsx
<span className="text-2xl flex-shrink-0">{icon}</span>
```

Emoji without `aria-hidden="true"` are announced by screen readers using their Unicode description ("bank building", "chart increasing"), which is redundant and disruptive when followed immediately by the category label.

**Fix:**

```tsx
<span className="text-2xl flex-shrink-0" aria-hidden="true">{icon}</span>
```

---

## 2026-04-12 Loading Speed Improvements

> Targeted findings focused on reducing time-to-first-content on the dashboard and reducing redundant work across page loads.

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| 71 | Wrap `getOrCreateSettings` in `React.cache()` | Performance | 🟡 Medium | 15 min | ✅ Done |
| 72 | Eliminate Phase 1→Phase 2 waterfall in `DashboardContent` | Performance | 🟡 Medium | 1 hr | ✅ Done |
| 73 | Cache `getNetWorthSummary` with Next.js `unstable_cache` | Performance | 🔴 High | 1-2 hrs | ✅ Done |
| 74 | Add granular Suspense boundaries inside `DashboardContent` | Performance | 🔴 High | 2-3 hrs | ✅ Done |
| 75 | Add `Cache-Control` headers to `GET /api/exchange-rates` | Performance | 🟢 Low | 15 min | ❌ Not Done |

---

### 71. Wrap `getOrCreateSettings` in `React.cache()`

**File:** `src/lib/services/settings-service.ts`

`getOrCreateSettings` makes a `prisma.setting.findUnique()` call each time it is invoked. It is not currently memoized, so if multiple React Server Components in the same render tree call it (e.g. after splitting `DashboardContent` into streaming sections per #74), each issues a separate database round-trip.

`getAllExchangeRates()` in `exchange-rate-service.ts` already uses this pattern correctly.

**Fix:**

```ts
import { cache } from "react";

export const getOrCreateSettings = cache(async (userId: string) => {
  let settings = await prisma.setting.findUnique({ where: { userId } });
  // ... existing creation logic
  return settings;
});
```

- **Affected files:** `src/lib/services/settings-service.ts`

**Implementation (2026-04-12):** Wrapped `getOrCreateSettings` with React's `cache()` function. The function is now memoized per `userId` within each server request, preventing duplicate `prisma.setting.findUnique()` calls across streaming RSC sections.


### 72. Eliminate Phase 1 → Phase 2 Waterfall in `DashboardContent`

**File:** `src/components/dashboard/dashboard-content.tsx`

`DashboardContent` runs two sequential `Promise.all` phases:

```ts
// Phase 1 — must complete before Phase 2 can start
const [dbUser, settings] = await Promise.all([
  prisma.user.findUnique(...),
  getOrCreateSettings(userId),
]);

// Phase 2 — blocked until Phase 1 finishes
const [summary, snapshots, latestPrice] = await Promise.all([
  getNetWorthSummary(userId, baseCurrency),   // internally: accounts + rates + prices
  getNormalizedHistory(userId, baseCurrency),  // internally: snapshots + rates
  prisma.priceCache.findFirst(...),
]);
```

Phase 2 is blocked because `baseCurrency` (from settings) is needed before calling the service functions. However, the database queries *inside* those services — `prisma.account.findMany`, `getAllExchangeRates`, `prisma.netWorthSnapshot.findMany` — do not need `baseCurrency`. Only the final in-memory computation does.

**Fix:** Kick off the DB-independent queries in parallel with settings, then perform the computation once all data is available:

```ts
// All DB queries start immediately — no sequential dependency
const [dbUser, settings, accounts, allRatesMap, snapshotsRaw, latestPrice] =
  await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getOrCreateSettings(userId),
    prisma.account.findMany({ where: { userId, isActive: true }, include: { holdings: { where: { quantity: { gt: 0 } } } } }),
    getAllExchangeRates(),
    prisma.netWorthSnapshot.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.priceCache.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);

const baseCurrency = settings.baseCurrency;
const userSymbols = accounts.flatMap(a => a.holdings.map(h => h.symbol));

// Only this second phase is actually sequential (needs symbols from accounts)
const cachedPrices = userSymbols.length > 0
  ? await prisma.priceCache.findMany({ where: { symbol: { in: userSymbols } } })
  : [];

// Then compute net worth and normalize history in-memory using the pre-fetched data
```

This eliminates one full DB round-trip from the critical path. Requires refactoring `getNetWorthSummary` and `getNormalizedHistory` to accept pre-fetched data as parameters (or extracting their computation logic into pure functions).

- **Affected files:** `src/components/dashboard/dashboard-content.tsx`, `src/lib/services/net-worth-service.ts`, `src/lib/services/history-service.ts`

**Implementation (2026-04-12):**
- Extracted `fetchUserAccountsWithHoldings(userId)` as a React `cache()`-memoised function in `net-worth-service.ts`; `computeNetWorthSummary` now calls it internally, giving the React per-request deduplication needed for the warm-up pattern.
- Updated `DashboardContent` to fire `fetchUserAccountsWithHoldings(userId)` and `getAllExchangeRates()` immediately (without awaiting) so their DB queries run in parallel with the Phase 1 `Promise.all`. Because `getCachedNetWorthSummary` on a cache-miss calls the same React-cached functions, it receives already-resolved results, eliminating the hidden waterfall.
- Moved `recentSnapshots` and `latestPrice` fetches into the Phase 1 `Promise.all` — they don't depend on `baseCurrency` and no longer need to wait for Phase 1 to complete before starting.


### 73. Cache `getNetWorthSummary` with Next.js `unstable_cache`

**File:** `src/lib/services/net-worth-service.ts`

`getNetWorthSummary` runs 2–3 database queries plus a potential external API call for missing exchange rates on **every dashboard page load**. For users who visit the dashboard frequently (or after a fast page reload), this recalculates identically unless prices or account data changed.

**Fix:** Wrap the function with Next.js `unstable_cache`, keyed by `[userId, baseCurrency]`, with a short TTL. Invalidate explicitly when prices are refreshed.

```ts
import { unstable_cache } from "next/cache";

export const getNetWorthSummary = unstable_cache(
  async (userId: string, baseCurrency: string): Promise<NetWorthSummary> => {
    // ... existing implementation unchanged
  },
  ["net-worth-summary"],
  {
    revalidate: 60,           // recompute at most once per minute on cache miss
    tags: ["net-worth"],      // invalidated explicitly on price refresh
  }
);
```

Then in the price-refresh route, add cache invalidation:

```ts
// src/app/api/prices/refresh/route.ts
import { revalidateTag } from "next/cache";

// After refreshing prices:
revalidateTag("net-worth");
```

Repeat dashboard visits within the 60-second window return the cached result instantly. The first load after the TTL or after a price refresh recomputes. Note: `unstable_cache` serializes return values, so `Decimal` fields must already be plain numbers (they are, via the serializers in `types.ts`).

- **Affected files:** `src/lib/services/net-worth-service.ts`, `src/app/api/prices/refresh/route.ts`

**Implementation (2026-04-12):**
- Renamed the existing function body to `computeNetWorthSummary` (private).
- Exported `getCachedNetWorthSummary = unstable_cache(computeNetWorthSummary, ["net-worth-summary"], { revalidate: 60, tags: ["net-worth"] })`.
- Kept `getNetWorthSummary` as an alias to `getCachedNetWorthSummary` for backward-compatibility (snapshot-service.ts unchanged).
- Added `revalidateTag("net-worth")` after `refreshAllPrices()` in both `POST /api/prices/refresh` and `GET /api/cron/snapshot` so the cache is invalidated before user-triggered reloads and before snapshot creation.


### 74. Add Granular Suspense Boundaries Inside `DashboardContent`

**File:** `src/components/dashboard/dashboard-content.tsx`

`DashboardContent` is a single async Server Component. The browser displays the `<DashboardSkeleton>` until **all** data — net worth, snapshot history, price timestamp — is fully resolved. If `getNetWorthSummary` resolves in 80ms but `getNormalizedHistory` takes 200ms, the net worth card is invisible for an extra 120ms with no reason.

**Fix:** Split `DashboardContent` into independent async RSC sections, each fetching only what it needs, each wrapped in its own `<Suspense>`:

```tsx
// dashboard-content.tsx (thin orchestrator)
export async function DashboardContent({ userId }: { userId: string }) {
  const settings = await getOrCreateSettings(userId); // cached (see #71)
  const { baseCurrency } = settings;

  return (
    <>
      <Suspense fallback={<ActionsBarSkeleton />}>
        <ActionsSection baseCurrency={baseCurrency} />
      </Suspense>

      <Suspense fallback={<NetWorthSkeleton />}>
        <NetWorthSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>

      <Suspense fallback={<AccountsTableSkeleton />}>
        <AccountsSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>
    </>
  );
}
```

Each `*Section` is an async RSC that fetches only the data it needs. `NetWorthSection` calls `getNetWorthSummary`; `ChartsSection` calls `getNormalizedHistory`; both share cached calls to `getOrCreateSettings` and `getAllExchangeRates` (deduplicated via `React.cache()`). The user sees the net worth card as soon as the faster query resolves, without waiting for chart history.

Requires #71 (`getOrCreateSettings` cached) to prevent duplicate settings queries across sections.

- **Affected files:** `src/components/dashboard/dashboard-content.tsx`, new section components under `src/components/dashboard/`

**Implementation (2026-04-12):**
- Created `src/components/dashboard/trend-chart-section.tsx` — a new async RSC that calls `getNormalizedHistory` and renders `LazyTrendChart`.
- Rewrote `DashboardContent` to: (a) call `getCachedNetWorthSummary` in the main data phase, (b) fetch only the 2 most recent snapshots (instead of full history) to derive `previousNetWorth` and `lastSnapshotDate`, and (c) wrap `TrendChartSection` in a `<Suspense>` inside the chart grid so it streams in independently once history resolves.
- Net worth card, allocation chart, currency exposure chart, and accounts summary all appear as soon as the cached summary resolves (~5ms on warm cache), while the trend chart loads the full snapshot history separately (~30–80ms).


### 75. Add `Cache-Control` Headers to `GET /api/exchange-rates`

**File:** `src/app/api/exchange-rates/route.ts`

The `GET /api/exchange-rates` endpoint returns all stored exchange rates with no caching headers. Exchange rates are refreshed at most once per hour by user action, yet every client-side page navigation that needs rates re-fetches this endpoint without any cache benefit.

**Fix:** Add a `Cache-Control` response header:

```ts
return NextResponse.json(rates, {
  headers: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
});
```

This allows CDN edges and the browser to serve the cached response for up to 1 hour, and serve a stale response for up to 24 hours while revalidating in the background. The exchange-rate refresh endpoint (`POST /api/exchange-rates/refresh`) already bypasses caching since it's a mutation.

- **Affected files:** `src/app/api/exchange-rates/route.ts`

---

## 2026-04-14 Code-Quality Refactor Review

> New code-quality findings from a full read of the codebase. Items are numbered starting at 76 to continue the running sequence. These focus on DRY, cohesion, and consistency — not on features, security, or performance work already tracked above.

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| 76 | Extract `withAuth()` HOF for API routes | Code Quality | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 77 | Unify Yahoo Finance quote fetcher (stock + crypto) | Code Quality | 🟢 Low | 30 min | ❌ Not Done |
| 78 | Dedupe `normalizeSnapshots` in history-service | Code Quality | 🟡 Medium | 1 hr | ✅ Done |
| 79 | Centralize exchange-rate upsert (`persistExchangeRate`) | Code Quality | 🟢 Low | 30 min | ❌ Not Done |
| 80 | Share chart tooltip/legend formatters | Code Quality | 🟡 Medium | 30 min | ❌ Not Done |
| 81 | Extract `<HoldingSearch>` component | Code Quality | 🟡 Medium | 1-2 hrs | ✅ Done |
| 82 | `formatQuantity()` helper in `currencies.ts` | Code Quality | 🟢 Low | 30 min | ❌ Not Done |
| 83 | Shared enum constants for Prisma/Zod | Code Quality | 🟡 Medium | 30 min | ✅ Done |
| 84 | `Serialized<T>` type + `serializeModel` helper | Code Quality | 🟡 Medium | 1-2 hrs | ✅ Done |
| 85 | Standardize API response shape | Code Quality | 🟡 Medium | 2-3 hrs | ✅ Done |
| 86 | `calculateBalanceDelta()` for cash-tx edits | Correctness | 🔴 High | 1 hr | ✅ Done |
| 87 | Split `account-detail.tsx` into subcomponents | Code Quality | 🟡 Medium | 2-3 hrs | ✅ Done |

---

### 76. Extract `withAuth()` Higher-Order Handler for API Routes

**Files:** `src/app/api/**/route.ts`

Every route handler opens with the same 3-line auth check:

```ts
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

This pattern appears in 15+ handlers across `/accounts`, `/holdings`, `/snapshots`, `/settings`, `/exchange-rates`, `/prices`, and `/search`. The duplication is mechanical and easy to get wrong (e.g., a route might forget the `user.id` narrowing).

**Fix:** Introduce `src/lib/api-handler.ts` exporting a wrapper:

```ts
export function withAuth<Ctx>(
  handler: (req: NextRequest, ctx: Ctx, userId: string) => Promise<Response>
) {
  return async (req: NextRequest, ctx: Ctx) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, ctx, session.user.id);
  };
}
```

Then handlers become `export const GET = withAuth(async (req, _ctx, userId) => { ... })`. Removes ~50 lines of boilerplate and guarantees a consistent 401 shape.

- **Affected files:** new `src/lib/api-handler.ts`; every `src/app/api/**/route.ts` file.


### 77. Unify Yahoo Finance Quote Fetcher Between Stock and Crypto

**File:** `src/lib/services/price-service.ts` (lines 26–53 and 60–85)

`fetchStockPrices` and `fetchCryptoPrices` share identical Yahoo Finance scaffolding — dynamic import, `Array.isArray(quotes)` guard, result-map population. Only the CoinGecko fallback differs.

**Fix:** Extract a private helper:

```ts
async function fetchYahooQuotes(
  symbols: string[]
): Promise<Map<string, { price: number; currency: string }>> {
  const results = new Map<string, { price: number; currency: string }>();
  if (symbols.length === 0) return results;
  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    const quotes = await yahooFinance.quote(symbols);
    for (const q of Array.isArray(quotes) ? quotes : [quotes]) {
      if (q?.regularMarketPrice && q.symbol) {
        results.set(q.symbol, { price: q.regularMarketPrice, currency: q.currency || "USD" });
      }
    }
  } catch (error) {
    console.error("Yahoo Finance fetch failed:", error);
  }
  return results;
}
```

`fetchStockPrices` then becomes a direct alias. `fetchCryptoPrices` calls `fetchYahooQuotes` first, then layers the CoinGecko fallback for any symbols still missing. Cuts ~40 lines of duplication.

- **Affected files:** `src/lib/services/price-service.ts`.


### 78. Deduplicate Snapshot Normalization Logic in `history-service`

**File:** `src/lib/services/history-service.ts`

`computeNormalizedHistory` and `getFullNormalizedHistory` implement the same pipeline — fetch snapshots → convert each snapshot's values to the target base currency → dedupe by date — with only caching and default date ranges differing. Changes to the conversion logic must be kept in sync across both functions today.

**Fix:** Extract the pure transformation:

```ts
function normalizeSnapshots(
  snapshots: NetWorthSnapshot[],
  allRatesMap: Map<string, number>,
  targetBaseCurrency: string
): NormalizedSnapshot[] {
  // existing per-snapshot conversion + dedupe-by-date logic
}
```

Both entry points then call it. This also sets up a natural home for the eventual `breakdown`-aware multi-currency conversion described in #35.

- **Affected files:** `src/lib/services/history-service.ts`.


### 79. Centralize Exchange-Rate Persistence

**File:** `src/lib/services/exchange-rate-service.ts` (lines ~120, ~162, ~174, ~228)

The same fire-and-forget upsert appears 4 times:

```ts
prisma.exchangeRate
  .upsert({
    where: { fromCurrency_toCurrency: { fromCurrency, toCurrency } },
    update: { rate, updatedAt: new Date() },
    create: { fromCurrency, toCurrency, rate, updatedAt: new Date() },
  })
  .catch(() => {});
```

**Fix:** Extract:

```ts
async function persistExchangeRate(from: string, to: string, rate: number) {
  try {
    await prisma.exchangeRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
      update: { rate, updatedAt: new Date() },
      create: { fromCurrency: from, toCurrency: to, rate, updatedAt: new Date() },
    });
  } catch (error) {
    console.warn(`Failed to persist exchange rate ${from}->${to}`, error);
  }
}
```

This also gives a single spot to upgrade to structured logging later (#55) instead of the current silent swallow.

- **Affected files:** `src/lib/services/exchange-rate-service.ts`.


### 80. Share Chart Tooltip and Legend Formatters

**Files:** `src/components/dashboard/allocation-chart.tsx` (L70-77), `currency-exposure-chart.tsx` (L59-66), `trend-chart.tsx` (L98-103)

Three Recharts tooltips reimplement the same `Intl.NumberFormat`-based currency formatter. `allocation-chart` and `currency-exposure-chart` are ~95% duplicated — both pie charts, same tooltip signature, same Legend wrapper.

**Fix:** Create `src/lib/chart-formatters.ts`:

```ts
export function createCurrencyTooltipFormatter(currency: string) {
  return (value: number) => formatCurrency(value, currency);
}

export function createPercentLegendFormatter(total: number) {
  return (value: string, entry: { payload?: { value?: number } }) => {
    const pct = total > 0 ? ((entry.payload?.value ?? 0) / total) * 100 : 0;
    return `${value} (${pct.toFixed(1)}%)`;
  };
}
```

Removes ~30 lines of duplication and guarantees consistent formatting — a single change in `formatCurrency` now propagates to every chart tooltip.

- **Affected files:** new `src/lib/chart-formatters.ts`; `src/components/dashboard/allocation-chart.tsx`, `currency-exposure-chart.tsx`, `trend-chart.tsx`.


### 81. Extract Reusable `<HoldingSearch>` Component

**Files:** `src/components/accounts/holding-form.tsx`, `src/components/accounts/quick-add-holding.tsx`

Both components reimplement debounced ticker search, results state, loading spinner, and result-row JSX — roughly 80 lines of code each with ~80% overlap. A future search improvement (e.g., exchange filter, type filter, keyboard navigation) would require duplicate changes.

**Fix:** Extract `<HoldingSearch onSelect={(result) => ...} />` that owns `query`, `results`, `isLoading`, debounce, and the result-row UI internally, emitting only the chosen result. The two parent components then consume it in their own step flow without caring about search internals.

- **Affected files:** new `src/components/accounts/holding-search.tsx`; `src/components/accounts/holding-form.tsx`, `src/components/accounts/quick-add-holding.tsx`.


### 82. Centralize Quantity Formatting in `currencies.ts`

**Files:** `src/components/accounts/accounts-list.tsx` (L426), `account-detail.tsx` (L399), `transaction-history.tsx` (L220)

The crypto-vs-non-crypto decimals rule — `h.assetType === "CRYPTO" ? 7 : 2` followed by `.toFixed()` — is inlined in at least three components. The logic is trivial, but duplicated string formatting inevitably drifts (e.g., one site adds thousands separators and others don't).

**Fix:** Add to `src/lib/currencies.ts` (which already hosts `formatCurrency` / `formatNumber`):

```ts
export function formatQuantity(qty: number, assetType: string): string {
  const decimals = assetType === "CRYPTO" ? 7 : 2;
  return formatNumber(qty, decimals);
}
```

Components import and call `formatQuantity(h.quantity, h.assetType)`.

- **Affected files:** `src/lib/currencies.ts`; `src/components/accounts/accounts-list.tsx`, `account-detail.tsx`, `transaction-history.tsx`.


### 83. Extract Enum Constants Shared Between Prisma and Zod Schemas

**Files:** `src/lib/validators.ts` (L5-15, L32, L58, L64, L87-95, L102, L106, L113); `prisma/schema.prisma`

Account categories, account types, holding asset types, and transaction types are hardcoded as `z.enum([...])` tuples at least twice — once in each individual create/update schema and again inside `dataImportSchema`. Adding a new category requires updating 3+ call sites and keeping them aligned with the Prisma enum.

**Fix:** Create `src/lib/enums.ts`:

```ts
export const ACCOUNT_TYPES = ["ASSET", "LIABILITY"] as const;
export const ACCOUNT_CATEGORIES = [
  "BANK", "BROKERAGE", "CRYPTO_WALLET", "PROPERTY", "VEHICLE",
  "CREDIT_CARD", "LOAN", "MORTGAGE", "OTHER",
] as const;
export const HOLDING_ASSET_TYPES = [
  "STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER",
] as const;
export const HOLDING_TRANSACTION_TYPES = ["BUY", "SELL", "EDIT"] as const;
export const CASH_TRANSACTION_TYPES = ["DEPOSIT", "WITHDRAWAL", "EDIT"] as const;
```

Zod schemas reference via `z.enum(ACCOUNT_CATEGORIES)`. Optional future improvement: a small test that compares these tuples to `Prisma.$Enums.*` to catch drift.

- **Affected files:** new `src/lib/enums.ts`; `src/lib/validators.ts`.


### 84. Add `Serialized<T>` Utility Type and `serializeModel` Helper

**File:** `src/lib/types.ts`

`SerializedAccount`, `SerializedHolding`, and `SerializedTransaction` each manually `Omit<...>` Decimal/Date fields and intersect with a literal reshape. The corresponding `serializeAccount` / `serializeHolding` functions then hand-copy every column. Adding a new column to any model requires touching both the type and the serializer.

**Fix:** Introduce:

```ts
export type Serialized<
  T,
  DecimalKeys extends keyof T = never,
  DateKeys extends keyof T = never,
> = {
  [K in keyof T]: K extends DecimalKeys ? number : K extends DateKeys ? string : T[K];
};

export function serializeModel<T, D extends keyof T, Dt extends keyof T>(
  obj: T,
  opts: { decimals: readonly D[]; dates: readonly Dt[] }
): Serialized<T, D, Dt> {
  // iterate keys, coerce Decimal via Number(), Dates via .toISOString()
}
```

`serializeAccount(a)` becomes a one-liner: `serializeModel(a, { decimals: ["cashBalance"], dates: ["createdAt", "updatedAt"] })`. Shrinks `types.ts` by ~30 lines and keeps serializers in sync with model shape automatically.

- **Affected files:** `src/lib/types.ts`.


### 85. Standardize API Response Shape via `src/lib/api-responses.ts`

**Files:** all `src/app/api/**/route.ts`

Route handlers return three different error shapes today:

- `{ error: "Unauthorized" }` (most routes)
- `{ error: parsed.error.flatten() }` (validation failures)
- `{ ok: true }` (mutation success in some routes, bare data in others)

The client therefore has to branch on response shape, and Zod validation details are inconsistently surfaced.

**Fix:** Add `src/lib/api-responses.ts`:

```ts
export const ok = <T>(data: T, init?: ResponseInit) =>
  NextResponse.json({ data }, init);

export const failure = (message: string, status = 400) =>
  NextResponse.json({ error: { message } }, { status });

export const validationError = (zodError: z.ZodError) =>
  NextResponse.json(
    { error: { message: "Validation failed", issues: zodError.flatten() } },
    { status: 400 }
  );
```

Update routes to emit `ok(data)` / `failure("Unauthorized", 401)` / `validationError(parsed.error)`. Clients then parse a single envelope.

- **Affected files:** new `src/lib/api-responses.ts`; all `src/app/api/**/route.ts`.


### 86. Extract `calculateBalanceDelta()` for Cash-Transaction Edits

**Files:** `src/app/api/accounts/[id]/cash-transactions/route.ts` (L39-57); `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts` (L79-95, L153-154)

The sign arithmetic for DEPOSIT/WITHDRAWAL/EDIT — including the "old type vs new type changed" branch on edit, and the "reverse effect on delete" branch — is inlined in at least three places with slightly different sign conventions. This is exactly the kind of logic that silently drifts and produces wrong balances.

**Fix:** Extract a pure function:

```ts
type CashTxInput = { type: "DEPOSIT" | "WITHDRAWAL" | "EDIT"; amount: number };

export function calculateBalanceDelta(
  oldTx: CashTxInput | null,
  newTx: CashTxInput | null
): number {
  const toSign = (tx: CashTxInput) =>
    tx.type === "DEPOSIT" ? tx.amount
    : tx.type === "WITHDRAWAL" ? -tx.amount
    : tx.amount; // EDIT represents an absolute adjustment
  return (newTx ? toSign(newTx) : 0) - (oldTx ? toSign(oldTx) : 0);
}
```

All three call sites then become `account.cashBalance += calculateBalanceDelta(old, next)`. Unit-testable, single source of truth for an error-prone calculation.

- **Affected files:** new `src/lib/services/balance.ts` (or inline in `cash-transaction-service.ts`); `src/app/api/accounts/[id]/cash-transactions/route.ts`; `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts`.


### 87. Split Oversized `account-detail.tsx` into Focused Subcomponents

**File:** `src/components/accounts/account-detail.tsx` (~460 lines, `"use client"`)

One large client component renders the breadcrumb + three conditional stat-card blocks + holdings table + transaction history + edit/delete menus. The breadcrumb and stat cards have no interactivity yet ship as client JS. The three stat-card branches (brokerage / bank / investment) also duplicate a Card → CardContent → Label → Value pattern ~3× with small variations.

**Fix:** Break the file into:

- `<AccountStatCards account={...}>` — presentational RSC deriving the right set of stats from `account.category`.
- `<HoldingRow holding={...} totalValue={...} onEdit onDelete>` — isolates the `assetType === "CRYPTO" ? 7 : 2` decimals, percentage, and color logic into one row component (pairs naturally with #82).
- Keep the outer `AccountDetail` as a thin `"use client"` wrapper for dialogs, sorting, and mutation state.

Result: smaller client bundle, each subcomponent is independently testable, and the stat-card branching collapses into one declarative RSC.

- **Affected files:** `src/components/accounts/account-detail.tsx`; new `src/components/accounts/account-stat-cards.tsx`, `src/components/accounts/holding-row.tsx`.
