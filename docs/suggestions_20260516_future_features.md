# Future Feature Ideas — 2026-05-16

> Forward-looking feature backlog. Distinct from the S-series digest
> (`suggestions_20260515.md`) and the SUGGESTIONS.md fix-it list — those track
> work the app already implies but hasn't finished. This file is for
> **capabilities the app doesn't have yet** and could grow into. Picked to be
> coherent with the existing data model (Account / Holding / Transaction /
> Snapshot) rather than a wishlist of unrelated apps.
>
> Status legend matches `suggestions_20260515.md`: ❌ Not started · ⚠️ Partial · ✅ Done.
> Effort: XS (≤30 min) · S (≤2 h) · M (½–1 day) · L (1–3 days) · XL (>3 days).
> Impact: 🔴 Killer feature · 🟡 Meaningful · 🟢 Nice-to-have.

---

## Quick-Reference Table

| ID  | Title                                              | Theme           | Effort | Impact | Status |
| --- | -------------------------------------------------- | --------------- | ------ | ------ | ------ |
| F1  | Net-worth goals & milestones                       | Projections     | M      | 🔴     | ✅     |
| F2  | FIRE / retirement projection page                  | Projections     | L      | 🔴     | ✅     |
| F3  | Cost basis + realized/unrealized P&L on holdings   | P&L & Tax       | L      | 🔴     | ❌     |
| F4  | Tax-lot tracking (FIFO / specific-lot)             | P&L & Tax       | XL     | 🟡     | ❌     |
| F5  | Year-end tax summary export (realized gains CSV)   | P&L & Tax       | M      | 🟡     | ❌     |
| F6  | Recurring / scheduled cash transactions            | Cashflow        | M      | 🔴     | ❌     |
| F7  | Cashflow calendar view                             | Cashflow        | M      | 🟡     | ❌     |
| F8  | Cash transaction categories + spending insights    | Cashflow        | L      | 🟡     | ❌     |
| F9  | Target asset allocation + rebalance alerts         | Portfolio       | L      | 🔴     | ❌     |
| F10 | Benchmark overlay on net-worth + holding charts    | Portfolio       | M      | 🟡     | ❌     |
| F11 | Performance attribution ("which holding moved NW") | Portfolio       | M      | 🟡     | ✅     |
| F12 | Watchlist (symbols you track but don't own)        | Discoverability | S      | 🟡     | ❌     |
| F13 | Tags on accounts and holdings                      | Discoverability | M      | 🟡     | ❌     |
| F14 | Holding journal / notes (per-symbol thesis log)    | Discoverability | S      | 🟢     | ❌     |
| F15 | Real-estate composite (property value − mortgage)  | Custom assets   | M      | 🟡     | ❌     |
| F16 | Manual / illiquid asset price overrides            | Custom assets   | S      | 🟡     | ❌     |
| F17 | Forward 12-month dividend / yield projection       | Income          | M      | 🟡     | ❌     |
| F18 | Net-worth profiles ("excl. crypto", "liquid only") | Insights        | M      | 🟡     | ❌     |
| F19 | What-if scenario planner                           | Insights        | L      | 🟢     | ❌     |
| F20 | Inflation-adjusted net-worth overlay               | Insights        | S      | 🟢     | ❌     |
| F21 | Labelled manual snapshots ("Wedding day")          | UX              | S      | 🟢     | ❌     |
| F22 | iOS lock-screen / home-screen widget (PWA)         | Platform        | L      | 🟡     | ❌     |
| F23 | Multi-broker CSV importer with format detection    | Data            | L      | 🟡     | ❌     |
| F24 | Attach documents to transactions / holdings        | Data            | M      | 🟢     | ❌     |
| F25 | Household / shared-account mode                    | Multi-user      | XL     | 🟡     | ❌     |

---

## Theme 1 — Projections & Goals

The app shows where you _are_ (dashboard) and where you've _been_ (history,
analysis). It does not yet show where you're _heading_. This theme is the
single biggest gap a personal-finance tracker can fill, and most of it is
pure math over data you already store.

### F1 — Net-worth goals & milestones · M · 🔴

Let the user set discrete goals like "$500k net worth by 2030-01-01" or
"$100k in BANK accounts by 2027-06-01". Render progress on the dashboard
hero and project an arrival date from the user's trailing growth rate.

**Schema sketch:**

```prisma
model Goal {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String          // "FIRE", "House down payment"
  targetAmount Decimal  @db.Decimal(18, 8)
  targetCurrency String        @default("USD")
  targetDate   DateTime?       // optional; null = open-ended
  scope        GoalScope       // NET_WORTH | ASSETS_ONLY | CATEGORY | ACCOUNT
  scopeRefId   String?         // accountId or category enum, depending on scope
  createdAt    DateTime @default(now())
}
```

**UI surfaces:** new `(main)/goals/` route + a compact "Next milestone" card
on the dashboard. Reuse `NetWorthSnapshot.totalNetWorth` history to compute
trailing growth rate; project as both linear and CAGR.

**Why this first:** zero external dependencies, uses existing snapshot
table, immediately useful, and unlocks F2.

### F2 — FIRE / retirement projection page · L · 🔴 · ✅ **Shipped** (2026-05-16, PR #275)

A dedicated `/projections` tab was added in commit `5f9fa83`. It uses:

- Current net worth (from latest snapshot).
- Trailing 12-mo realized savings (derived from `CashTransaction` deltas).
- Per-projection-type growth assumptions.

Renders projected net worth curves and estimated FIRE date. Tick formatter refactored into `src/lib/chart-formatters.tsx` in follow-up commit `f882179`.

~~A dedicated `/projections` (or `/analysis/projections`) tab that runs a
Monte-Carlo or deterministic projection using:~~

- Current net worth (from latest snapshot).
- Trailing 12-mo realized savings rate (derived from `CashTransaction`
  deltas — pairs with F8).
- User-set assumptions: expected real return, inflation, withdrawal rate.

Outputs the classic FIRE number (`annual_expenses × 25`), an
expected-arrival-date band, and a chart that plots projected net worth
forward against the user's actual history.

**Builds on:** F1 (goals), F8 (categorized spending).
**Open question:** keep the math deterministic on first cut — Monte-Carlo
is much more code and not obviously more useful at this fidelity.

---

## Theme 2 — Cost Basis, P&L, and Tax

`HoldingTransaction` currently stores only `{ type, quantity, note }` —
no price, no fees, no currency-at-time. This makes any concept of "what
did you pay for this and what's it worth now" structurally impossible.
That's why SUGGESTIONS #7 (cost basis) and S23 (tax lots) keep showing
up. Bundling them under a single theme so the schema migration is done
once.

### F3 — Cost basis + realized / unrealized P&L · L · 🔴

Add `priceAtTransaction` and `feeAmount` to `HoldingTransaction`. From
that, compute weighted-average cost basis per holding and derive:

- Unrealized P&L per holding (current value − cost basis × current qty).
- Realized P&L per holding (sum of SELL proceeds − basis released).
- Aggregate unrealized/realized per account and globally.

**Schema migration:**

```prisma
model HoldingTransaction {
  // ... existing fields
  priceAtTransaction Decimal? @db.Decimal(18, 8) // null for legacy rows
  feeAmount          Decimal? @db.Decimal(18, 8)
  feeCurrency        String?
}
```

**Backfill strategy:** leave existing rows null. UI must tolerate "no
basis available" (show a small "?" tooltip and grey-out gain/loss). New
transactions require price; expose a "Lookup historical price" button
that hits Yahoo Finance for the row's `createdAt` date.

**Closes:** SUGGESTIONS #7.

### F4 — Tax-lot tracking (FIFO / specific-lot) · XL · 🟡

Once F3 lands, the natural next step is per-lot accounting. Each BUY
becomes a `TaxLot` row; each SELL consumes lots either FIFO (default) or
by user-selected lot ID (specific identification). Required for accurate
short-vs-long-term capital gains in most jurisdictions.

**Schema sketch:** `TaxLot { id, holdingId, quantityRemaining, costBasis,
acquiredAt, originatingTransactionId }` + `LotConsumption { sellTxId, lotId,
quantityConsumed, basisConsumed }`.

**Defer until:** F3 has been live for one tax year of real user data —
designing tax lots speculatively is expensive and rarely matches the
edge cases that actually appear.

**Closes:** S23.

### F5 — Year-end tax summary export · M · 🟡

Annual CSV download with realized gain/loss rows: `symbol, acquired,
sold, proceeds, cost_basis, gain_loss, term (short/long)`. Depends on F3
(or F4 for accurate lot terms). Add a button to Settings → Data export.

---

## Theme 3 — Cashflow & Automation

`CashTransaction` is currently a pure ledger — no recurrence, no
categories, no schedule. Adding these unlocks budget-tracking-style
features without breaking what's already there.

### F6 — Recurring / scheduled cash transactions · M · 🔴

"I deposit $1000 into Fidelity Brokerage on the 1st of every month." Let
the user define a `RecurringTransaction` template; a daily cron expands
due templates into real `CashTransaction` rows.

**Schema:**

```prisma
model RecurringTransaction {
  id          String   @id @default(cuid())
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  type        CashTransactionType
  amount      Decimal  @db.Decimal(18, 8)
  cadence     RecurrenceCadence    // DAILY | WEEKLY | MONTHLY | YEARLY | CRON
  cronExpr    String?              // when cadence = CRON
  nextRunAt   DateTime
  lastRunAt   DateTime?
  isActive    Boolean  @default(true)
  note        String?
}
```

**Cron:** extend `/api/cron/snapshot` (or add `/api/cron/recurring`) to
run before the snapshot pass so any DEPOSIT created today is reflected
in tonight's snapshot.

### F7 — Cashflow calendar view · M · 🟡

A calendar grid (`/analysis/calendar` or a tab inside `/analysis`)
showing expected inflows/outflows by day: F6 recurrences, manually
scheduled future transactions, and (later) expected dividend payouts
(F17). Highlights "you'll be in the red on the 25th" type signals.

### F8 — Cash transaction categories + spending insights · L · 🟡

Add a `category` field to `CashTransaction` (`FOOD | RENT | TRAVEL |
SAVINGS | OTHER` — user-extensible). The Analysis tab gains a "Spending
by category" donut for OUTFLOW rows, mirroring the existing currency
exposure chart. Enables F2 to derive a real savings rate.

**Trade-off:** turns the app from a pure net-worth tracker into a budgeting
tool. Some users won't want that. Make it opt-in via a Settings toggle so
the UI doesn't grow categories controls for people who don't categorize.

---

## Theme 4 — Portfolio Intelligence

You can already _see_ the portfolio. The next step is the app telling
you something about it.

### F9 — Target allocation + rebalance alerts · L · 🔴

Let the user define a target allocation (e.g., 70% stocks / 20% bonds /
10% crypto). Compute current allocation from holdings, surface drift
("crypto is 16% — 6 pts over target"), and emit a Sonner toast on the
dashboard when drift exceeds a configurable threshold.

**Schema:** `AllocationTarget { userId, scope (ASSET_TYPE | CURRENCY |
ACCOUNT_CATEGORY), key, targetPercent }`.

**UI:** Settings tab "Allocation Targets" + a new card in `/analysis`
showing actual vs. target as a stacked bar.

### F10 — Benchmark overlay on charts · M · 🟡

Add an optional second series to `TrendChart` and per-holding charts
showing a benchmark (S&P 500, BTC, gold) normalized to the same starting
value. Users compare their growth to "if I'd just held SPY". Requires
backfilling benchmark price history into `PriceCache` or a sibling table.

**Cross-reference:** suggested in S13 (Analysis Phase 3 — benchmark).
This expands on it with explicit schema/UI direction.

### F11 — Performance attribution · M · 🟡

"Your net worth grew $X this month. NVDA contributed $A, BTC contributed
$B, your salary deposit was $C." Per-month attribution table or a
horizontal-bar chart inside `/analysis`. Math is straightforward from
two snapshots + transactions in between.

---

## Theme 5 — Discoverability & Organization

As the number of accounts and holdings grows, the app needs better ways
to navigate and annotate.

### F12 — Watchlist · S · 🟡

A symbol can be on your radar without being owned. Add a `Watchlist`
model (`{ userId, symbol, assetType, addedAt, note }`) and a small
"Watchlist" card on the dashboard showing current price + daily change.
Reuses the existing `/api/search` and `price-service`. No effect on
net-worth math.

### F13 — Tags on accounts and holdings · M · 🟡

Free-form tags like "tax-advantaged", "emergency fund", "speculative".
`Tag { id, userId, name, color }` plus join tables. Adds tag filters to
the accounts list and the analysis charts ("show me allocation for
'tax-advantaged' only").

### F14 — Holding journal / notes · S · 🟢

A scrollable note thread per holding — "bought NVDA 2024-Q1, thesis:
AI training capex". Each entry is `{ holdingId, body, createdAt }`.
Tiny on its own, but combined with F11 it lets the user revisit why
they made past decisions.

---

## Theme 6 — Custom & Illiquid Assets

The current schema assumes every asset has a fetchable market price.
That's not true for real estate, vehicles, collectibles, or private
equity. Two related features address this:

### F15 — Real-estate composite (property − mortgage) · M · 🟡

Today a user models a house as one ASSET (property value) and one
LIABILITY (mortgage), with no link between them. Add an optional
`linkedAccountId` on `Account` so a `MORTGAGE` row points back to its
`PROPERTY`. UI shows them as a single "Home equity" card on the
dashboard with the breakdown collapsible.

### F16 — Manual / illiquid price overrides · S · 🟡

Let the user attach a manual price + as-of date to a holding (or to a
non-financial asset modelled as a `PROPERTY`/`VEHICLE` account). The
price service skips network calls when an unexpired manual override is
set. Useful for art, private shares, watches, etc.

**Schema:** add `manualPrice`, `manualPriceCurrency`, `manualPriceAsOf`
to `Holding` (or a sibling `ManualPrice` table if multi-history is
wanted).

---

## Theme 7 — Income & Cash Generation

### F17 — Forward 12-month dividend / yield projection · M · 🟡

For each holding, fetch dividend history + yield from Yahoo Finance and
project the next 12 months of income. Aggregate across the portfolio
("expected annual income: $4,820"). Pair with F7 (calendar) to place
payouts on specific dates.

**Closes:** SUGGESTIONS #17, S15.

---

## Theme 8 — Insights, Scenarios & Framing

### F18 — Net-worth profiles · M · 🟡

A user-defined filter that excludes selected accounts from the net-worth
calculation. Quick toggles: "Excl. crypto", "Liquid only" (excludes
real estate + vehicles), "Excl. retirement". Render the chosen profile
as a secondary pill next to the dashboard hero number.

### F19 — What-if scenario planner · L · 🟢

"If I sell all my crypto and put it into VTI, what does my net worth
look like? What's the projection?" An interactive form on
`/analysis/scenarios` that mutates a copy of the portfolio in-memory
and recomputes everything. Nothing persists.

### F20 — Inflation-adjusted net-worth overlay · S · 🟢

Toggle on the trend chart that re-bases the historical series in
today's dollars using a public CPI series (US BLS or equivalent for
the user's locale). The 2020 line on an unadjusted chart looks great;
in real terms it's flatter. Cheap to implement, and a good
conversation-piece feature.

### F21 — Labelled manual snapshots · S · 🟢

Today snapshots are anonymous daily rows. Let the user trigger one with
a label: "House purchase", "Wedding day", "Started new job". They show
as annotated dots on the trend chart and as bookmarks in the history
view.

**Schema:** add `label TEXT NULL` to `NetWorthSnapshot`.

---

## Theme 9 — Platform Integration

### F22 — iOS lock-screen / home-screen widget (PWA) · L · 🟡

The app is already PWA-shaped (iOS splash, manifest, viewport-fit,
theme-color). The next-native step is a widget — current net worth +
24h delta — using the Web Widgets API or a paired iOS Shortcuts
recipe. Privacy mode must auto-engage on the widget.

**Investigation needed:** Web Widgets is still uneven across iOS
versions. A Shortcuts-based fallback ("Hey Siri, what's my net worth")
is lower-effort and works today.

---

## Theme 10 — Data Portability & Extensibility

### F23 — Multi-broker CSV importer with format detection · L · 🟡

Today's data import is a single internal JSON schema. Power users have
CSVs from Fidelity, Schwab, IBKR, Coinbase, etc. Add a CSV ingestion
endpoint that sniffs headers, maps them to `Account`/`Holding`/
`HoldingTransaction`, and shows a preview the user can edit before
commit. Saved mappings are reusable per broker.

**Defer Plaid (SUGGESTIONS #24):** real broker API sync is 10× the
effort and the user can self-import a CSV in seconds. F23 is the 80/20.

### F24 — Attach documents to transactions / holdings · M · 🟢

Trade confirmations, deeds, valuation letters. Use Vercel Blob (already
on platform) for storage; metadata in a `Document { id, ownerId,
attachedTo: 'transaction'|'holding'|'account', refId, url, mimeType,
sizeBytes }` table. Show as a paperclip icon in transaction rows.

---

## Theme 11 — Multi-User Modes

### F25 — Household / shared-account mode · XL · 🟡

A meaningful chunk of users want to track joint finances with a partner
while keeping individual accounts private. Introduce a `Household` that
contains multiple `User`s, plus a per-account `sharing: PRIVATE |
HOUSEHOLD` flag. The household-level dashboard sums only the shared
accounts; each user's personal dashboard sums their own.

**Large project.** Note ownership-check audit (S3, SUGGESTIONS #28/50/109/110)
should land first — this feature adds an entire new axis to auth.

---

## Out of Scope (Intentionally)

Listed here so future-me knows these were considered and skipped, not
overlooked.

- **Crypto wallet auto-sync via on-chain addresses.** Possible (Etherscan,
  blockchain.info), but the asset model is the same as F23 imports and
  the maintenance load on per-chain integrations is high.
- **AI-generated portfolio advice.** Easy to add (`vercel:ai-gateway`),
  but legal exposure for a personal-finance app is significant. Defer
  until there's a clear product story around it.
- **Public sharing / social feed.** Net-worth apps that turn into social
  apps inevitably re-derive Twitter. Skipped on principle.
- **Mobile app (React Native).** PWA + F22 widget covers 90% of the
  iOS-native ask at ~5% of the maintenance cost.

---

## Suggested Implementation Order

If picking up this list cold, a reasonable sequence:

1. **F3** (cost basis) — unblocks F4, F5, F11; touches the most-edited
   table once instead of N times.
2. **F1** + **F2** — first user-visible "this is more than a tracker"
   feature; entirely self-contained.
3. **F6** + **F8** — both small individually, and together they enable
   F2's savings-rate math to be real instead of a slider.
4. **F9** — first piece of "the app tells me something" intelligence.
5. **F12** + **F13** — small wins that make the app feel more lived-in.
6. Everything else as the mood takes you.
