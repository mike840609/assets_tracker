# Enhancement Suggestions — 2026-05-15

> **Companion:** [`suggestions_20260515_vercel_mcp.md`](./suggestions_20260515_vercel_mcp.md) — Vercel MCP findings (F1–F8, captured 2026-05-14) re-prioritize S4 / S5 / S6 / S8 / S20 below. Read it alongside this file.

## Context

The existing `docs/` folder has six trackers (PERFORMANCE, INFRASTRUCTURE, UI*UX, CODE_QUALITY, SUGGESTIONS, LOG) catalogueing ~370 items by lens. This file is a **prioritized digest** across all of them: the highest-impact open work, plus fresh items not yet tracked, ranked crucial-first. Use it as a single "what to do next" roadmap. Each item cross-references the source tracker ID (e.g. \_closes R11*) so nothing fragments — if you ship one of these, mark it ✅ both here and in the source doc.

**Codebase state at this date.** Bundle work is largely closed (B1–B15 ✅), rendering/PPR is shipped (P1–P2, X1–X3 ✅), UI polish is mostly done (13/15 ✅), Analysis Phase 1+2 is live. The remaining gaps cluster around **observability, error handling, security/launch-readiness, test coverage, and Phase 3 analysis features** — not bundle/render tuning.

## Legend

| Field      | Values                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **Effort** | XS (≤30 min) · S (≤2 h) · M (½–1 day) · L (1–3 days) · XL (>3 days)                                 |
| **Impact** | 🔴 High (launch blocker / data risk / major UX) · 🟡 Medium (meaningful win) · 🟢 Low (polish / DX) |
| **Status** | ❌ Not started · ⚠️ Partial · ✅ Done                                                               |

## Quick-Reference Table

| ID                                 | Title                                                                  | Effort | Impact | Status | Source                 |
| ---------------------------------- | ---------------------------------------------------------------------- | ------ | ------ | ------ | ---------------------- |
| **Tier 1 — Crucial**               |                                                                        |        |        |        |
| S1                                 | Route error boundaries (error.tsx / not-found / global-error)          | S      | 🔴     | ❌     | R11                    |
| S2                                 | Timing-safe `CRON_SECRET` comparison                                   | XS     | 🔴     | ❌     | R4                     |
| S3                                 | Ownership-check audit on `[id]` mutations                              | S      | 🔴     | ✅     | R5 / D1                |
| S4                                 | Structured logger + Sentry across services (**do first** — F1)         | M      | 🔴     | ❌     | Q5 / R17               |
| S5                                 | `/api/health` endpoint (DB ping + freshness) (**do first** — F1)       | XS     | 🔴     | ❌     | V12 / R12              |
| S6                                 | Cron-run audit table + freshness alert (**do first** — F1)             | M      | 🔴     | ❌     | V11 / R13              |
| S7                                 | Vitest + service-layer test suite                                      | M      | 🔴     | ❌     | Q1–Q4                  |
| S8                                 | CSP header (Report-Only → enforce) (report endpoint scaffolded — F4)   | M      | 🔴     | ⚠️     | V14 / R2               |
| S9                                 | GDPR data export + account deletion                                    | L      | 🔴     | ❌     | R7 / R8                |
| S10                                | Middleware returns JSON 401 for `/api/*`                               | XS     | 🔴     | ❌     | SUGGESTIONS 2026-05-11 |
| **Tier 2 — High-Value**            |                                                                        |        |        |        |
| S11                                | Color-blind safe asset/liability cues                                  | S      | 🟡     | ❌     | fresh                  |
| S12                                | Mobile polish backlog M1–M3, M5–M9                                     | M      | 🟡     | ❌     | UI_UX M-series         |
| S13                                | Analysis Phase 3 (date picker, YoY, export, benchmark, vol)            | L      | 🟡     | ❌     | UI_UX Phase 3          |
| S14                                | Custom account ordering (drag-reorder + `sortOrder`)                   | M      | 🟡     | ❌     | fresh                  |
| S15                                | Dividend / income tracking (`IncomeEvent` model)                       | L      | 🟡     | ❌     | fresh                  |
| S16                                | Expand crypto symbol coverage beyond ~20 CoinGecko entries             | S      | 🟡     | ❌     | fresh                  |
| S17                                | `Cache-Control` on `/api/snapshots`, `/api/exchange-rates`             | S      | 🟡     | ❌     | V17 / V18              |
| S18                                | Bundle-size CI gate (PR-fail if main grows >5%)                        | S      | 🟡     | ❌     | V22 / V33              |
| S19                                | Preconnect to `va.vercel-scripts.com`                                  | XS     | 🟡     | ❌     | V28                    |
| S20                                | Vercel Skew Protection on (**promote to Tier 1** — bundle with F6)     | XS     | 🟡     | ❌     | V35                    |
| S21                                | Chart CLS reserve (explicit `min-height` on lazy charts)               | XS     | 🟡     | ❌     | V23                    |
| S22                                | Holding price-alert thresholds (email / web push)                      | L      | 🟡     | ❌     | fresh                  |
| S23                                | Tax-lot tracking (FIFO / specific-lot cost basis)                      | L      | 🟡     | ❌     | fresh                  |
| **Tier 3 — Polish & DX**           |                                                                        |        |        |        |
| S24                                | Critical docs (SECURITY / OBSERVABILITY / TESTING / DISASTER_RECOVERY) | M      | 🟢     | ❌     | C1–C4                  |
| S25                                | Enable `noUncheckedIndexedAccess` in tsconfig                          | M      | 🟢     | ❌     | Q10                    |
| S26                                | `lint-staged` pre-commit (format only staged files)                    | XS     | 🟢     | ❌     | Q15                    |
| S27                                | OpenAPI spec for `/api/*` (zod-to-openapi)                             | M      | 🟢     | ❌     | fresh                  |
| S28                                | Snapshot reconciliation utility (drift >0.5% alert)                    | S      | 🟢     | ❌     | fresh                  |
| **Tier 4 — Future / Aspirational** |                                                                        |        |        |        |
| S29                                | AI portfolio insights via Vercel AI Gateway                            | L      | 🟢     | ❌     | fresh                  |
| S30                                | Plaid / SnapTrade read-only brokerage sync                             | XL     | 🟢     | ❌     | fresh                  |
| S31                                | Multi-user / household read-only sharing                               | XL     | 🟢     | ❌     | fresh                  |
| S32                                | Net-worth forecast + goal tracking                                     | L      | 🟢     | ❌     | UI_UX Phase 4          |

---

## Tier 1 — Crucial (🔴)

Release blockers, security, and correctness gaps. **Do these first.**

### S1 — Route error boundaries

**S | 🔴 | ❌ — closes R11**

Add `src/app/(main)/error.tsx`, `src/app/(main)/not-found.tsx`, and `src/app/global-error.tsx`. Today a service failure (price fetch, FX rate miss, snapshot read) surfaces as a hard 500. Boundaries let the rest of the shell stay usable and unblock graceful recovery + retry CTAs. Wire each boundary to the new logger (S4) so soft-failures show up in telemetry.

### S2 — Timing-safe CRON_SECRET comparison

**XS | 🔴 | ❌ — closes R4**

`src/app/api/cron/snapshot/route.ts` currently `===`-compares the bearer token. Switch to `crypto.timingSafeEqual` against equal-length buffers. One-line fix; closes a side-channel that's free to exploit on a known-length secret.

### S3 — Ownership-check audit on `[id]` mutations

**S | 🔴 | ✅ Done (2026-05-16) — closes R5 / D1 and items 136-138**

Audited every `src/app/api/accounts/[id]/...` route. Two real gaps were closed: `transactions/[transactionId]/route.ts` PATCH/DELETE were unwrapped (no `withAuth`) and only compared `tx.accountId` to the URL — now wrapped with an upfront `Account.findUnique({ id, userId })` guard. `holdings/route.ts` POST never verified the parent account belonged to `userId`, and PATCH/DELETE updated/deleted by holding id with no user scoping at all; both now use `findFirst({ id, account: { userId } })`. `route.ts`, `cash-transactions/route.ts`, and `transactions/route.ts` GET were already correctly scoped. `/api/options/chain` is read-only public market data — out of scope. Follow-up: extract a shared `assertOwnedAccount(prisma, userId, id)` helper now that there are 3+ callsites.

### S4 — Structured logger + Sentry

**M | 🔴 | ❌ — closes Q5 / R17 / PE1 follow-up — _MCP F1: do first_**

Today services swallow errors into Result shapes. Add a thin logger (pino or just a typed wrapper) emitting JSON `{level, service, userId, requestId, msg}`, route it to Sentry server-side and Vercel logs. Instrument: price-service retries, exchange-rate-service lazy fetches, snapshot cron, net-worth two-pass rate resolution. Unblocks the entire observability story — every other Tier 1 item benefits.

> **MCP context (F1):** `get_runtime_logs` against production returned `No logs found` over a 7-day window. Without S4 there is literally no signal that the daily cron snapshot is healthy.

### S5 — `/api/health` endpoint

**XS | 🔴 | ❌ — closes V12 / R12 — _MCP F1: do first, alongside S4 + S6_**

`GET /api/health` returns `{db: ok|fail, latestSnapshotAt, missingEnv: []}`. Used for uptime checks and the dashboard widget in S6. Keep it auth-free; do NOT leak userIds or secret presence — only booleans.

### S6 — Cron-run audit table + freshness alert

**M | 🔴 | ❌ — closes V11 / R13 — _MCP F1: do first, alongside S4 + S5_**

Add `CronRun { id, name, startedAt, finishedAt, ok, error, durationMs }` to Prisma. Snapshot cron writes a row on every invocation. Tiny `/api/cron/heartbeat` job (or part of `/api/health`) flags red if no successful row in >36 h. Today there is no signal that the daily snapshot job stopped firing — silent data loss risk.

### S7 — Vitest + service-layer test suite

**M | 🔴 | ❌ — closes Q1–Q4**

Add Vitest config + first wave of unit tests:

- `src/lib/services/net-worth-service.ts` — two-pass rate resolution, missing-rate path, mixed-currency totals
- `src/lib/services/exchange-rate-service.ts` — identity, inverse, missing-pair lazy fetch
- `src/lib/types.ts` — `serialize{Account,Holding,AccountWithHoldings}` Decimal/Date stripping
- `src/lib/services/balance.ts` — account-value math

Today only the Playwright smoke test exists. A regression in net-worth math would only surface in E2E — too late.

### S8 — CSP header

**M | 🔴 | ⚠️ — closes V14 / R2 — _MCP F4: report endpoint scaffolded_**

Ship `Content-Security-Policy-Report-Only` with a strict policy (`script-src 'self' 'nonce-…'`, `connect-src` allowlist for `api.coingecko.com`, `query1.finance.yahoo.com`, `va.vercel-scripts.com`). Watch reports for one week, then flip to enforce. Tracks alongside S19 (preconnect targets).

> **MCP context (F4):** `src/app/api/_csp/report/route.ts` is already scaffolded (private folder — not yet routed). Header + nonce pipeline still missing. Promote the route under a public path once the header lands.

### S9 — GDPR data export + account deletion

**L | 🔴 | ❌ — closes R7 / R8**

`POST /api/account/export` returns a ZIP of all user data (accounts, holdings, transactions, snapshots, settings) as JSON. `DELETE /api/account` cascades the user delete via Prisma. Settings page exposes both. Legal must-have before any public/EU launch and unblocks deactivation flows.

### S10 — Middleware JSON 401 for `/api/*`

**XS | 🔴 | ❌ — SUGGESTIONS 2026-05-11**

`src/middleware.ts` currently redirects unauthenticated requests to `/login`, which breaks `fetch()` callers (they see HTML, not 401). Split logic: API paths → `new NextResponse(JSON.stringify({error: 'unauthorized'}), {status: 401})`; page paths → existing redirect.

---

## Tier 2 — High-Value (🟡)

Meaningful wins that aren't strictly blockers.

### S11 — Color-blind safe asset/liability cues

**S | 🟡 | ❌ — fresh**

Today red/green is the only signal for asset vs liability across `accounts-list.tsx` and `accounts-summary.tsx`. Add an icon prefix (↑/↓ or +/−) and a text label in the row, not just color. ~8% of male users (deuteranopia) currently can't read the page.

### S12 — Mobile polish backlog

**M | 🟡 | ❌ — closes UI_UX M1–M3, M5–M9**

Bundle of independent CSS-only fixes:

- **M1** Holdings table: hide Symbol/Qty at `md`, show on `lg+`
- **M2** Analysis sub-tabs: bound scroll height + scroll-snap on horizontal nav
- **M3** Touch-target audit (≥44 px) across icon buttons
- **M5** Login card: bump horizontal padding on small screens
- **M6** Holdings form: stack grid below `sm`
- **M7** `<select>` width: `w-full` everywhere
- **M8** Empty states: lift illustrations + CTAs
- **M9** Mobile holdings pagination (currently unbounded)

Can ship as one PR — none touch business logic.

### S13 — Analysis Phase 3

**L | 🟡 | ❌ — closes UI_UX Phase 3**

- Custom date-range picker (replaces preset ranges)
- YoY toggle on monthly-trend + cashflow
- CSV export of trend / by-account / cashflow tables
- PDF export of the current Analysis view
- Benchmark overlay (S&P 500 / TWII / user-pickable) on the trend chart
- Volatility KPIs (σ, max drawdown) in the KPI row

Build CSV/PDF as a single shared `exportTable(rows, format)` helper used by all three sub-tabs.

### S14 — Custom account ordering

**M | 🟡 | ❌ — fresh**

Add `sortOrder Int @default(0)` to `Account`. Long-press / drag handle on mobile, drag-handle on desktop. PATCH `/api/accounts/reorder` takes `[{id, sortOrder}]`. Reuse `dnd-kit` if not already in the bundle.

### S15 — Dividend / income tracking

**L | 🟡 | ❌ — fresh**

New `IncomeEvent { id, holdingId, type: DIVIDEND|COUPON|INTEREST, amount, currency, exDate, payDate, source }`. New analysis card: trailing-12-month income + yield-on-cost per holding. Optional: auto-fetch ex-dividend dates from Yahoo Finance for known symbols.

### S16 — Expand crypto symbol coverage

**S | 🟡 | ❌ — fresh**

`price-service.ts` falls back to CoinGecko via a hard-coded ~20-symbol `COINGECKO_IDS` map. Long-tail coins silently return null and disappear from net worth. Either expand the map by pulling CoinGecko's `/coins/list` once at build (cached JSON) or swap to a paid provider with broader coverage.

### S17 — API caching headers

**S | 🟡 | ❌ — closes V17 / V18**

`GET /api/snapshots` and `GET /api/exchange-rates` are pure reads. Add `Cache-Control: private, max-age=60, stale-while-revalidate=300`. Pairs with the existing `revalidateTag` invalidation — clients get instant repeat reads, mutations still bust.

### S18 — Bundle-size CI gate

**S | 🟡 | ❌ — closes V22 / V33**

`@next/bundle-analyzer` already runs locally. Wire a GitHub Action that compares main-chunk size against the base branch and fails the PR if growth >5%. Prevents bundle regressions from creeping back after B1–B15 closure.

### S19 — Preconnect to `va.vercel-scripts.com`

**XS | 🟡 | ❌ — closes V28**

Add `<link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin>` to root layout `<head>`. Web Vitals beacon currently does a cold DNS+TLS handshake on every fresh session.

### S20 — Vercel Skew Protection

**XS | 🟡 → 🔴 | ❌ — closes V35 — _MCP F6: bundle with Rolling Releases_**

Enable in Vercel project settings + read `x-deployment-id` header in client. Prevents users from getting half-old / half-new JS during a deploy.

> **MCP context (F6):** Pair this XS dashboard toggle with **Rolling Releases** (also a dashboard toggle, no code change). Both meaningfully shrink deploy blast radius given the daily-deploy cadence (5+ prod deploys per day observed). Logical to ship in the same dashboard session.

### S21 — Chart CLS reserve

**XS | 🟡 | ❌ — closes V23**

Dynamic-imported charts (`AllocationChart`, `CurrencyExposureChart`, `TrendChart`) currently shift layout when they hydrate. Add explicit `min-height` to their wrappers matching the rendered height. Pure CSS, no behavior change.

### S22 — Holding price-alert thresholds

**L | 🟡 | ❌ — fresh**

New `PriceAlert { id, userId, symbol, kind: PCT_UP|PCT_DOWN|ABOVE|BELOW, value, channel: EMAIL|PUSH, lastFiredAt }`. Daily cron compares current vs threshold and dispatches via Resend / Web Push. Pairs naturally with S6 (cron audit) since they share the runtime.

### S23 — Tax-lot tracking

**L | 🟡 | ❌ — fresh**

Today partial sales subtract from a flat quantity field; cost basis is averaged and tax reports are inaccurate. Introduce immutable `Lot { id, holdingId, openTxnId, qty, costPerShare, openedAt, closedAt? }` records. Sells consume lots FIFO by default with a "specific lot" override. Foundational for any future tax-export feature.

---

## Tier 3 — Polish & DX (🟢)

### S24 — Critical docs

**M | 🟢 | ❌ — closes C1–C4**

Write four short docs and link from `README.md`:

- `docs/SECURITY.md` — threat model, ownership-check pattern, secret rotation
- `docs/OBSERVABILITY.md` — logger usage, Sentry tags, dashboards
- `docs/TESTING.md` — Vitest layout, Playwright invariants, where to mock
- `docs/DISASTER_RECOVERY.md` — Neon branch restore, snapshot replay, RTO/RPO

Each ≤200 lines. Half is just codifying what's already true; the other half forces the team to decide.

### S25 — `noUncheckedIndexedAccess`

**M | 🟢 | ❌ — closes Q10**

Flip the tsconfig flag, fix the resulting ~50–100 errors (mostly `arr[0]` access). Catches a class of nullable-index bugs at compile time. Do as a single dedicated PR.

### S26 — `lint-staged`

**XS | 🟢 | ❌ — closes Q15**

Add `lint-staged` + wire Husky `pre-commit` to run Prettier on staged files only. Pre-push already runs the full check suite; this just shortens the inner loop.

### S27 — OpenAPI spec

**M | 🟢 | ❌ — fresh**

`zod-to-openapi` over the existing `src/lib/validators.ts` schemas → emit `openapi.json` at build time. Serve at `/api/openapi`. Enables external clients (mobile app, Zapier-style integrations) and gives Swagger UI for free.

### S28 — Snapshot reconciliation utility

**S | 🟢 | ❌ — fresh**

Daily side-job: re-compute today's net-worth via the live service, compare against the snapshot just written, log if drift >0.5%. Catches subtle FX-rate / pricing bugs that don't show up in unit tests. Cheap once S4 logger exists.

---

## Tier 4 — Future / Aspirational

Larger bets — only after Tier 1–3 are mostly closed.

### S29 — AI portfolio insights

**L | 🟢 | ❌ — fresh**

Use Vercel AI Gateway with model-agnostic provider strings (e.g. `"anthropic/claude-sonnet-4-6"`) to generate a weekly "What changed in your portfolio" summary. Stream into a Settings → Insights tab. Stay model-agnostic so we can swap providers without code change.

### S30 — Plaid / SnapTrade brokerage sync

**XL | 🟢 | ❌ — fresh**

Read-only OAuth integration with one of the two providers to auto-import transactions. Eliminates the biggest manual-entry pain point. Major scoping work — pricing, regional coverage, security review, OAuth flows.

### S31 — Multi-user / household

**XL | 🟢 | ❌ — fresh**

New `Household` model; existing `Account.userId` becomes `Account.householdId` + a `Membership { userId, householdId, role: OWNER|READER }` join. Most queries need a one-line scope change. Requires careful permission-test coverage before shipping.

### S32 — Net-worth forecast + goals

**L | 🟢 | ❌ — closes UI_UX Phase 4**

Monte-Carlo simulation: take last 12 months of monthly cashflow + a configurable return assumption, project N years forward, render a fan chart. Goals: name + target amount + target date, show progress vs trajectory.

---

## Cross-References

Mapping back to existing tracker IDs so source docs stay the system of record.

| Tracker                             | IDs referenced here                              |
| ----------------------------------- | ------------------------------------------------ |
| `docs/INFRASTRUCTURE.md` (R-series) | R2, R4, R5, R7, R8, R11, R12, R13, R17           |
| `docs/INFRASTRUCTURE.md` (V-series) | V11, V12, V14, V17, V18, V22, V23, V28, V33, V35 |
| `docs/CODE_QUALITY.md` (Q-series)   | Q1, Q2, Q3, Q4, Q5, Q10, Q15                     |
| `docs/CODE_QUALITY.md` (C-series)   | C1, C2, C3, C4                                   |
| `docs/CODE_QUALITY.md` (D-series)   | D1                                               |
| `docs/UI_UX.md` (M-series)          | M1, M2, M3, M5, M6, M7, M8, M9                   |
| `docs/UI_UX.md` (Phases)            | Phase 3, Phase 4                                 |
| `docs/SUGGESTIONS.md`               | 2026-05-11 entry on middleware JSON 401          |

When closing an item: update the status icon here **and** in the source tracker so both views stay aligned.
