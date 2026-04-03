# Asset Tracker — Suggestions

## Overview

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| 1 | Fix hardcoded USD in trend chart tooltip | Bug Fix | 🔴 High | 10 min | ✅ Done |
| 2 | Deduplicate balance editor into `<InlineBalanceEditor>` | Code Quality | 🟡 Medium | 30 min | ✅ Done |
| 3 | Remove test-rate API route | Cleanup | 🟢 Low | 5 min | ✅ Done |
| 4 | Dashboard "Refresh Prices" & "Take Snapshot" buttons | Feature | 🔴 High | 1-2 hrs | ✅ Done |
| 5 | "Last Updated" timestamp for prices on dashboard | Feature | 🔴 High | 1-2 hrs | ✅ Done |
| 6 | Dark/Light/System theme toggle | Feature | 🟡 Medium | 1-2 hrs | ✅ Done |
| 7 | Cost basis & gain/loss tracking | Feature | 🔴 High | 4-6 hrs | ❌ Not Done |
| 8 | Authentication & multi-user support | Feature | 🔴 High | 6-10 hrs | ❌ Not Done |
| 9 | Data import/export | Feature | 🔴 High | 4-6 hrs | ❌ Not Done |
| 10 | Error handling & loading states | Architecture | 🟡 Medium | 3-4 hrs | ❌ Not Done |
| 11 | Fix N+1 query patterns | Architecture | 🟡 Medium | 3-5 hrs | ❌ Not Done |
| 12 | Input validation on API routes | Architecture | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 13 | Account reordering & archiving | UX | 🟡 Medium | 3-4 hrs | ❌ Not Done |
| 14 | Mobile-responsive holdings table | UX | 🟡 Medium | 2-3 hrs | ❌ Not Done |
| 15 | Monthly/yearly performance reports | Analytics | 🟡 Medium | 4-5 hrs | ❌ Not Done |
| 16 | Currency exposure chart | Analytics | 🟢 Low | 2-3 hrs | ❌ Not Done |
| 17 | Dividend / income tracking | Analytics | 🟡 Medium | 4-6 hrs | ❌ Not Done |

---

## Details

### 7. Cost Basis & Gain/Loss Tracking
BUY/SELL transactions exist but have no `price` field. Without cost basis, users can't see profit/loss per holding.

- Add a `price` (Decimal) column to `HoldingTransaction` to record purchase/sale price
- Compute **average cost basis**, **unrealized P&L**, and **total return %** per holding
- Display gain/loss with green/red coloring on the account detail page

### 8. Authentication & Multi-User Support
No auth — anyone who can reach the URL owns all the data. Fine for local use, risky if deployed.

- Add NextAuth.js (or Clerk) for authentication
- Add a `userId` foreign key to `Account` and `Setting`
- Protect all API routes and server components

### 9. Data Import/Export
No way to back up data or migrate. One database wipe and everything is gone.

- **Export:** "Download as CSV/JSON" button on accounts and holdings pages
- **Import:** CSV import for bulk-adding holdings (e.g. from brokerage statements)
- Full database backup/restore via JSON dump

### 10. Error Handling & Loading States
Many client-side fetches have minimal error handling. Server Components use `force-dynamic` everywhere.

- Add Suspense boundaries and loading skeletons for server components
- Add retry logic or exponential backoff for price/exchange-rate fetches
- Add an error boundary component

### 11. Fix N+1 Query Patterns
`fetchStockPrices` loops through symbols one-by-one. `getNetWorthSummary` calls `getExchangeRate()` in a loop, each triggering DB + HTTP requests.

- Batch stock price fetches (Yahoo Finance supports arrays)
- Pre-load all needed exchange rates in a single query at the start of `getNetWorthSummary()`
- Add in-memory cache for exchange rates within a single request lifecycle

### 12. Input Validation on API Routes
Validators file exists (`validators.ts`) but not all API routes consistently validate inputs with Zod.

- Audit all `route.ts` files to ensure they validate request bodies
- Return proper 400 status codes with descriptive error messages
- Consider a shared middleware pattern

### 13. Account Reordering & Archiving
`isActive` exists on accounts but no UI to archive/unarchive. No way to reorder.

- Add an "Archive" option (instead of only hard delete)
- Show archived accounts in a collapsed section
- Add `sortOrder` field for manual reordering

### 14. Mobile-Responsive Holdings Table
The holdings table has 9 columns — cramped on mobile.

- Switch to card-based layout on mobile
- Or make the table horizontally scrollable with sticky first column
- Consider collapsible rows

### 15. Monthly/Yearly Performance Reports
Trend chart shows raw net worth but doesn't compute period-over-period growth.

- "Performance" view with monthly/yearly % change
- Bar chart showing month-over-month changes
- Summary stats: best month, worst month, average growth

### 16. Currency Exposure Chart
Multi-currency holdings supported but allocation chart only groups by category, not currency.

- Add a "Currency Exposure" pie/donut chart on the dashboard
- Shows what % of net worth is in each currency

### 17. Dividend / Income Tracking
Many stock/ETF holders care about dividend income, not just price appreciation.

- Add a `DIVIDEND` transaction type
- Track dividend income per holding and aggregate monthly/yearly
- Display on dashboard as a separate income chart
