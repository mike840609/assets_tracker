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
