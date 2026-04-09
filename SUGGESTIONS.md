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
| 40 | Fix O(n²) symbol lookup in accounts page | Performance | 🟡 Medium | 30 min | ❌ Not Done |
| 41 | Reduce client bundle size (date-fns) | Performance | 🟡 Medium | 1 hr | ❌ Not Done |
| 42 | Add `select` to reduce over-fetching in API routes | Performance | 🟢 Low | 1 hr | ❌ Not Done |
| 43 | Add aria-labels to icon-only buttons | Accessibility | 🔴 High | 1 hr | ❌ Not Done |
| 44 | Fix color-only differentiation for assets/liabilities | Accessibility | 🔴 High | 1 hr | ❌ Not Done |
| 45 | Add inline form validation errors | UX | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 46 | Improve empty states with clear CTAs | UX | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| 47 | Add account search/filter | UX | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| 48 | Add table accessibility attributes | Accessibility | 🟡 Medium | 1 hr | ❌ Not Done |
| 49 | Use native `confirm()` → proper confirmation dialogs | UX | 🟢 Low | 2 hrs | ❌ Not Done |
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
