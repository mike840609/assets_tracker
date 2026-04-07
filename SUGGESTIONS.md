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
