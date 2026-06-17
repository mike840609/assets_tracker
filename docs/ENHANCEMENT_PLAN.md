# Assets Tracker — Enhancement Plan (2026-06-12)

A consolidated, **code-verified** forward roadmap. Unlike the per-lens trackers
(`BUGS.md`, `ROADMAP.md`, `PERFORMANCE.md`, `PLATFORM.md`, `DATABASE.md`,
`CODE_QUALITY.md`, `UI_UX.md`), every item here was re-checked against the
actual code on 2026-06-12 — stale ✅/❌ statuses from those docs are corrected
here, and false alarms found during the audit are recorded so they don't get
re-flagged. Use this file as the "what to do next" view; when you ship an item,
tick it here **and** in the source tracker.

**Codebase state at audit time.** Current code includes the perf rounds, cache
unification, unified `/api/refresh`, cron cache revalidation, bundle-size CI,
splash cache headers, and the Tier 0 correctness sweep. Bundle,
rendering/PPR, service-layer caching, and page waterfalls are in good shape —
the remaining work clusters around **security hardening, observability, unit
testing, schema evolution, and product features**.

Legend — Effort: XS ≤30 min · S ≤2 h · M ½–1 day · L 1–3 days · XL >3 days.
Impact: 🔴 data risk / security / launch blocker · 🟡 meaningful · 🟢 polish.

---

## 2026-06-17 module audit addendum

Fresh module-by-module audit: [`MODULE_ENHANCEMENT_AUDIT_2026-06-17.md`](./MODULE_ENHANCEMENT_AUDIT_2026-06-17.md).

Automated baseline is clean (`format:check`, `lint`, `typecheck`,
`test:unit`, and `build` all pass), but the audit found live issues that should
take priority over the older "completed" Tier 0 wording below:

1. ✅ P0 ledger atomicity implemented in this PR: cash transaction create,
   account balance edit, and holding transaction edit/delete now use stronger
   transaction/delta write contracts.
2. ✅ P0 cron cache consistency implemented in this PR: expired option sweeps
   now invalidate net-worth before same-run snapshots.
3. P1 validation/dedupe gaps: transaction pagination, snapshot range params,
   goal scope references, and projection same-day snapshot dedupe need focused
   fixes.
4. P1/P2 client/tooling hardening: undo-delete can double-commit, option-chain
   fetches need cancellation, Sentry config emits a deprecation warning, and
   the vitals endpoint needs a body cap.

Use the addendum as the current next-work queue, then reconcile stale statuses
in `BUGS.md`, `CODE_QUALITY.md`, and `ROADMAP.md` as fixes land.

---

## Tier 0 — Data integrity & correctness (completed; keep as regression log)

Small fixes; every one was a verified live bug with user-visible consequences.
Current code shows the Tier 0 sweep is now shipped; keep the evidence here so
the same issues do not get re-opened from older trackers.

| ID  | Item                                                                            | Effort | Impact | Source            |
| --- | ------------------------------------------------------------------------------- | ------ | ------ | ----------------- |
| E1  | ✅ UTC-floor the snapshot date                                                  | XS     | 🔴     | BUGS Critical     |
| E2  | ✅ History dedupe tie-break by `max(createdAt)`                                 | XS     | 🔴     | BUGS High         |
| E3  | ✅ Guard `token.sub` in auth callbacks                                          | XS     | 🔴     | BUGS High         |
| E4  | ✅ FX: persist inverse rates + surface a stale flag                             | S      | 🔴     | BUGS High ×2      |
| E5  | ✅ Stop defaulting null `contractMultiplier` to 100                             | S      | 🟡     | BUGS High         |
| E6  | ✅ Tighten validators (qty>0, immutable assetType, tx unions, datetime)         | S      | 🟡     | BUGS High ×3      |
| E7  | ✅ Decimal-safe `cashBalance` diff in account PATCH                             | XS     | 🟡     | BUGS Medium       |
| E8  | ✅ Zod-validate holdings DELETE body; scope deletes/updates in the write itself | XS     | 🟡     | BUGS Medium + new |
| E9  | ✅ Goal import: fail loudly when `scopeRefId` remap misses                      | XS     | 🟡     | new (audit)       |

- **E1** — Done in `snapshot-service.ts`: `createSnapshot()` now derives the
  upsert date with `Date.UTC(getUTCFullYear(), getUTCMonth(), getUTCDate())`,
  while `createdAt` preserves the exact snapshot timestamp.
- **E2** — Done in `history-service.ts`: normalized history and raw breakdown
  dedupe share the same tie-break, preferring target-base-currency snapshots
  and then greatest `createdAt`.
- **E3** — Done in `auth.ts`: the session callback throws loudly when
  `token.sub` is missing before assigning `session.user.id`.
- **E4** — Done in `exchange-rate-service.ts` + refresh UI: refresh responses
  distinguish `fetchFailed`, inverse rows are persisted on refresh, and
  `getExchangeRatesFreshness()` feeds the stale-FX warning badge. `resolveRate`
  keeps inverse/USD-cross fallback support for legacy or missing rows.
- **E5** — Done/guarded: option creation is OCC-derived with
  `contractMultiplier: 100`; net-worth only defaults legacy null multipliers
  to 100 and logs `option.multiplier.defaulted`.
- **E6** — Done with route nuance: create schemas require positive quantities;
  non-option PATCH quantity `0` is rejected in the holdings route, while option
  quantity `0` remains allowed to close a position without deleting its audit
  trail. `assetType: OPTION` cannot be introduced by PATCH, existing options
  cannot be converted away, and transaction update timestamps use
  `z.iso.datetime()` with per-type `superRefine` rules.
- **E7** — Done in `accounts/[id]/route.ts`: cash-balance edit diffs use
  Prisma `Decimal` math instead of number subtraction.
- **E8** — Done in `accounts/[id]/holdings/route.ts` and
  `stocks/[id]/route.ts`: holdings DELETE validates with `deleteHoldingSchema`,
  and ownership is folded into `deleteMany`/`updateMany` writes to remove the
  check-then-write TOCTOU window.
- **E9** — Done in `settings/data/route.ts`: account-scoped import goals are
  pre-validated, remapped through `accountIdMap`, and fail with a 400 instead
  of silently writing a dangling/null `scopeRefId`.

## Tier 1 — Security hardening

| ID  | Item                                                                | Effort | Impact | Source              |
| --- | ------------------------------------------------------------------- | ------ | ------ | ------------------- |
| E10 | ✅ Timing-safe `CRON_SECRET` comparison                             | XS     | 🔴     | ROADMAP S2          |
| E11 | ✅ Rate-limit coverage on all mutation routes                       | S      | 🔴     | BUGS High (partial) |
| E12 | ✅ `getClientIp` fallback chain (`cf-connecting-ip`, `x-real-ip`)   | XS     | 🟡     | BUGS High           |
| E13 | ✅ Import hardening: body-size cap + Zod array `.max()`             | S      | 🟡     | new (audit)         |
| E14 | ✅ Validate `/api/options/chain` symbol shape before upstream fetch | XS     | 🟡     | BUGS Medium         |
| E15 | ✅ CSP header enforced + public report endpoint                     | M      | 🔴     | ROADMAP S8          |
| E16 | GDPR completion: true account deletion (`user.delete` cascade)      | M      | 🔴     | ROADMAP S9 ⚠️       |

- **E10** — Done in `cron/snapshot/route.ts`: the bearer token compare now uses
  `crypto.timingSafeEqual` over equal-length buffers.
- **E11** — Done in `api-handler.ts`: authenticated `POST`/`PUT`/`PATCH`/`DELETE`
  handlers wrapped with `withAuth` now inherit a per-user `rateLimitCheckWithPrune`
  budget of 60/min. Existing expensive refresh endpoints keep their tighter
  route-specific caps.
- **E12** — Done in `rate-limit.ts` + `proxy.ts`: `getClientIp()` now prefers the
  first `x-forwarded-for` IP, then falls back to `cf-connecting-ip`, then
  `x-real-ip`, before using `"unknown"`. The auth proxy limiter reuses the same
  helper.
- **E13** — Done in `settings/data/route.ts` + `validators.ts`: import POST now
  rejects bodies over 4 MB before JSON parse, returns a clear 400 for invalid
  JSON, applies a 5/min per-user import cap, and bounds import arrays with Zod
  `.max()` limits for accounts, holdings, transactions, snapshots, and goals.
- **E14** — Done in `options/chain/route.ts`: symbols must match
  `^[A-Z][A-Z0-9.-]{0,9}$` before any Yahoo options-chain fetch.
- **E15** — Done in `next.config.ts` + `api/csp/report/route.ts`: responses now
  ship an enforced `Content-Security-Policy` with explicit `connect-src`
  allowlists for Vercel Analytics/Speed Insights, FX providers, CoinGecko, and
  Yahoo Finance, plus a public `/api/csp/report` collector. A nonce-only
  `script-src` was not used because it blocked Next.js 16 Cache Components/PPR
  chunk scripts during runtime smoke testing; the enforced policy keeps
  framework-compatible `'unsafe-inline'` while still locking down object/base/
  frame/form/worker/manifest sources.
- **E16** — Export (`GET /api/settings/data`) and replace-import already exist;
  what's missing for GDPR is **deleting the User row itself** (cascades to
  auth accounts/sessions/settings/snapshots/goals per schema). Add
  `DELETE /api/account` + a confirm flow in Settings. Add the missing FK
  indexes on `AuthAccount.userId` / `Session.userId` in the same PR — Postgres
  needs them for efficient cascade (DATABASE.md follow-up).
  - **Partial (2026-06-13):** the FK-index half shipped with E18 — migration
    `20260613000000_add_cron_run_and_fk_indexes` adds `@@index([userId])` to
    `auth_accounts` and `Session` so cascade deletes are index-backed. The
    account-deletion endpoint + confirm flow remain pending.

## Tier 2 — Observability (the "blind cron" cluster)

Production runtime logs were empty over a 7-day MCP window; if the nightly
snapshot stops, nothing tells you. PLATFORM F1 flags this trio as "do first".

| ID  | Item                                                     | Effort | Impact | Source      |
| --- | -------------------------------------------------------- | ------ | ------ | ----------- |
| E17 | ✅ `/api/health` — DB ping + latest-snapshot freshness   | XS     | 🔴     | ROADMAP S5  |
| E18 | ✅ `CronRun` audit table + >36 h freshness alarm         | M      | 🔴     | ROADMAP S6  |
| E19 | ✅ Sentry wired through `src/lib/logger.ts`              | M      | 🔴     | ROADMAP S4  |
| E20 | Request-context correlation (requestId/userId) in logger | S      | 🟢     | new (audit) |
| E21 | Snapshot reconciliation side-job (drift >0.5% alert)     | S      | 🟢     | ROADMAP S28 |

- **E17** — Done in `app/api/health/route.ts`: unauthenticated `GET /api/health`
  pings the DB with a `SELECT 1` and reads the most recent `NetWorthSnapshot`
  `createdAt` in one parallel round. Returns only `{ status, db, latestSnapshotAt,
snapshotAgeMs, timestamp }` — no user data. `status` is `"ok"` (HTTP 200) when
  the DB is reachable and a snapshot exists within 36 h; `"degraded"` (HTTP 503)
  when the DB is up but the latest snapshot is stale/absent; `"unhealthy"`
  (HTTP 503) when the DB is unreachable. The endpoint is wrapped with
  `rateLimitCheckWithPrune` (30/min per IP). The 36 h threshold is the same one
  E18's `CronRun` alarm will build on, so E17 unblocks E18.
- **E19** — Done. `@sentry/nextjs` (v10.57, peer-dep `^16.0.0-0` → Next 16 +
  Turbopack supported) wired through the existing structured logger. Init runs
  via the instrumentation hooks: `src/instrumentation.ts` (server + edge in
  `register()`, plus `onRequestError = Sentry.captureRequestError`) and
  `src/instrumentation-client.ts` (browser init + `onRouterTransitionStart`).
  All init is guarded on a DSN — with no `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`
  the SDK never initializes, so every capture is a complete no-op (local dev /
  CI / `next build` need no Sentry account). `logger.ts` `log.error` →
  `captureException` (full stack via a stripped `__error` meta key) and
  `log.warn` → `captureMessage` (level `warning`), both best-effort and
  guarded so they never throw or alter the JSON log line. DSN/auth-token env
  added as optional to `src/lib/env.ts`; `next.config.ts` is wrapped with
  `withSentryConfig` (source-map upload gated on `SENTRY_AUTH_TOKEN` so
  token-less builds succeed) and its CSP `connect-src` now allowlists the
  Sentry ingest hosts (`https://*.ingest.sentry.io` + `us`/`de` regional
  variants) so browser reporting isn't blocked by E15's CSP. This completes
  the **observability trio** (E17 health + E18 CronRun + E19 Sentry).
- **E18** — Done in `prisma/schema.prisma` + `cron/snapshot/route.ts` +
  `app/api/health/route.ts` (migration
  `20260613000000_add_cron_run_and_fk_indexes`). The cron writes a
  `CronRun { name: "snapshot", startedAt, finishedAt, ok, error, durationMs }`
  row each invocation — an `ok: false` row is created up front so a crash
  mid-flight still leaves a failure record, then closed out as `ok: true` on
  success or `ok: false` + `error` on failure (the failure-audit write is
  best-effort and can't mask the original error). `CronRun` is indexed on
  `(name, ok, startedAt DESC)` so "latest successful run" is a single
  index seek. `/api/health` now reports **both** signals independently:
  `cron` (latest successful `CronRun` within 36 h) and `snapshot` (existing
  `NetWorthSnapshot` freshness), with overall `status` = worst of
  {db, cron, snapshot} — `degraded` (503) if either cron or snapshot is
  stale/absent, `ok` (200) only when all three are healthy. The 36 h window is
  shared with E17. This is **Free-plan compatible**: no new cron is added — the
  alarm is pull-based via `/api/health`. #418's `cron.revalidate.gate` log line
  gave partial signal but only when logs were watched; the table makes it
  queryable.

## Tier 3 — Testing

| ID  | Item                                                                | Effort | Impact | Source      |
| --- | ------------------------------------------------------------------- | ------ | ------ | ----------- |
| E22 | ✅ Vitest + first service-layer suite                               | M      | 🔴     | ROADMAP S7  |
| E23 | E2E gaps: /projections, /history, settings import/export round-trip | M      | 🟡     | new (audit) |
| E24 | ✅ Run `format:check` in PR CI; lint/typecheck are already gated    | XS     | 🟢     | new (audit) |

- **E22** — Done. Vitest 4 added (`npm run test:unit` / `:watch`; config in
  `vitest.config.ts` with an `@/*` alias and a `server-only` stub at
  `tests/stubs/server-only.ts` so server-only service modules import cleanly in
  the Node test env). First wave landed under `tests/unit/` (56 tests, 6 files):
  `net-worth-service` two-pass valuation + missing-rate fallback (real
  `resolveRate`, mocked Prisma/rates, neutralized cache wrappers) ·
  `exchange-rate-service` `resolveRate` identity/direct/inverse/USD-cross ·
  `history-service` normalize + dedupe via `getFullNormalizedHistory` (locks in
  E2's same-day tie-break) · `analysis-service` bucket/KPI/attribution/mover
  aggregations · `types.ts` serializers (Decimal→number, Date→ISO) ·
  `validators.ts` edge cases (locks in E6). CI runs them in a new `unit` job in
  `.github/workflows/ci.yml`, mirroring the lint/typecheck jobs. Next:
  E23 (E2E gaps).
- **E23** — Playwright covers smoke/accounts/analysis/stocks/mobile; the
  pages with the most math (projections, history) and the riskiest mutation
  (data import) have no coverage. An import→export round-trip equality test
  doubles as a backup-integrity guarantee.
- **E24** — Done in `.github/workflows/ci.yml`: a `format` job runs
  `npm run format:check` on PRs, mirroring the `lint`/`typecheck` jobs (same
  checkout/setup/deps-cache pattern, same `[skip ci]` guard, `needs: install`).
  Prettier drift is now caught in CI instead of relying solely on the
  local/pre-push hook and lint-staged.

## Tier 4 — Database & schema evolution

| ID  | Item                                                               | Effort | Impact | Source            |
| --- | ------------------------------------------------------------------ | ------ | ------ | ----------------- |
| E25 | `price`/`fee` on `HoldingTransaction` (cost-basis enabler)         | M      | 🔴     | DATABASE DB3 / F3 |
| E26 | Explicit backdatable `date` on both transaction tables (+ indexes) | S      | 🟡     | DATABASE DB4      |
| E27 | Sync `colorSchema`/`density` to `Setting` (cross-device)           | S      | 🟡     | DATABASE DB6      |
| E28 | `timestamptz` migration + ExchangeRate composite PK                | M      | 🟢     | DATABASE DB8/DB9  |
| E29 | `source` field on `PriceCache` (provenance)                        | XS     | 🟢     | DATABASE DB7      |

- **E25 is the keystone schema change** — it unblocks F3 (cost basis / P&L),
  then F4 (tax lots), F5 (tax export), and richer F11 attribution. Nullable
  for legacy rows; the UI shows "no basis" gracefully. Do it before the
  transaction table grows further.
- **E27** — both prefs are currently localStorage-only (memory:
  density modes note); second-device logins get defaults.

## Tier 5 — Product features (curated from ROADMAP F-series)

Shipped already: F1 goals, F2 projections, F9 allocation targets, F11
attribution, F12 watchlist (`StockWatchItem`). Recommended order for the rest —
rationale: one schema migration unblocks three features; small wins between
large ones.

1. **F3 — Cost basis + realized/unrealized P&L** (L · 🔴) — directly on E25.
   The single biggest "this is more than a tracker" capability still missing.
2. **F6 — Recurring cash transactions** (M · 🔴) ✅ **shipped 2026-06-14** +
   **F8 — categories / spending insights** (L · 🟡, opt-in toggle) — makes the
   projections page's savings-rate real instead of assumed; cron already has the
   daily hook.
3. **F16 — Manual price overrides** (S · 🟡) and **F21 — labelled snapshots**
   (S · 🟢) — small, self-contained, high perceived value.
4. **F10 — Benchmark overlay** (M · 🟡) — needs a benchmark price-history
   sibling of `PriceCache`; pairs with Analysis Phase 3 (S13: date picker,
   YoY, CSV/PDF export, volatility KPIs).
5. **F23 — Multi-broker CSV importer** (L · 🟡) — the 80/20 of brokerage sync;
   defer Plaid (S30) indefinitely.
6. **F5 — year-end tax export** (M, after F3) · **F13 tags** · **F14 holding
   journal** · **F15 real-estate composite** · **F18 net-worth profiles** —
   pick by mood; all independent.

- **F6 (shipped 2026-06-14) — no new cron.** `RecurringCashTransaction` model
  (migration `20260614000000_add_recurring_cash_transactions`) + a
  materialization step folded into the existing `/api/cron/snapshot` run, so the
  Free-plan one-cron limit is respected. `materializeDueRecurringTransactions()`
  (`src/lib/services/recurring-cash-service.ts`) runs a catch-up loop driven by
  each rule's `nextRunDate`, posting every occurrence due since the last run —
  so a skipped/failed cron day self-heals on the next run rather than needing a
  tighter schedule. Idempotency: a `(recurringId, occurrenceDate)` unique index
  - balance incremented by `createMany().count` (not occurrence count), all in
    one interactive `$transaction`. UI: a Recurring card on the account detail
    page (`recurring-cash-transactions.tsx`); rules support pause/resume + end
    dates; deleting a rule keeps already-posted ledger rows (FK `SetNull`). Unit
    tests cover the date math + catch-up + idempotent-skip paths
    (`tests/unit/recurring-cash-service.test.ts`). The generated rows are ordinary
    `CashTransaction`s, so they flow into history/snapshots with no extra wiring.
    Next: F8 categories builds on this for real savings-rate inputs.
- **F6b (shipped 2026-06-14) — recurring investments (DCA), also no new cron.**
  `RecurringInvestment` model (migration
  `20260614010000_add_recurring_investments`) + `materializeDueInvestments()`
  (`src/lib/services/recurring-investment-service.ts`) folded into the same cron
  step (runs after the cash sweep so deposits land before buys spend them). Each
  rule invests a fixed `amount` (account currency) into a `symbol`: shares =
  amount→price-currency ÷ run-time price, posts a BUY `HoldingTransaction`,
  increments the holding (auto-creating it on first run), and debits cash —
  modeling a real brokerage purchase (net worth unchanged at buy time). Reuses
  the cash service's date helpers and the same `(recurringId, occurrenceDate)`
  idempotency on `HoldingTransaction`. UI: `recurring-investments.tsx` card on
  non-bank account detail, using `HoldingSearch` for symbol resolution. Known
  limitation: catch-up after a cron outage prices missed days at the current
  price, not the historical price. Tests:
  `tests/unit/recurring-investment-service.test.ts`.
- Mobile/UX companions when touching these surfaces: S11 color-blind-safe
  asset/liability cues (icon + label, not color alone) and the remaining
  UI_UX M-series CSS fixes (S12).

## Tier 6 — Performance & platform (what's actually left)

The June audit closed most of this. Remaining, in order:

| ID  | Item                                                               | Effort     | Impact | Source      |
| --- | ------------------------------------------------------------------ | ---------- | ------ | ----------- |
| E30 | 🚫 Free-plan blocked: Skew Protection + Rolling Releases           | XS         | 🟡     | ROADMAP S20 |
| E31 | ✅ P3 — resolve `/login` proxy; legal pages already excluded       | M          | 🟡     | PLATFORM P3 |
| E32 | ⚠️ PE16/V15 — build-cache audit (297 MB → <150 MB)                 | L          | 🟢     | PERFORMANCE |
| E33 | ⏸️ P7 — trusted `x-user-id` header to remove RSC double-decode     | L          | 🟢     | PLATFORM P7 |
| E34 | ✅ Re-test `cacheComponents`-blocked items on each Next.js upgrade | XS/upgrade | 🟢     | PERFORMANCE |

- **E30** — Deferred 2026-06-12: this project is on the Vercel Free plan, while
  Skew Protection and Rolling Releases are Pro-plan platform controls. Do not
  keep re-opening this as local code work; revisit only if the project upgrades
  to Pro or Vercel makes these controls available on Free.
- **E31** — Done 2026-06-12. `src/proxy.ts` now excludes `/login` in the
  matcher, and the signed-in redirect moved into `src/app/login/page.tsx`. The
  page preserves the `?stale-session` recovery escape hatch and checks for a
  NextAuth session cookie before paying the JWT decode.
- **E32** — Partial/process done 2026-06-12. Added
  `npm run audit:build-cache` to report `.next/cache` contributors and the
  150 MB target. A post-build local audit measured `.next/cache` at ~407 KB,
  so no generated cache deletion or cache-policy change was warranted locally.
- **E33** is security-sensitive (header spoofing if misconfigured) — needs a
  careful review; only worth it if Fluid CPU numbers say JWT decode matters.
  Deferred 2026-06-12: the installed Next docs warn to forward request headers
  with an allow-list and the repo has no current CPU evidence that the second
  JWT decode is material.
- **E34** — Process note added 2026-06-12. S1/S2(SSG), I1/I2/I4(ISR), and
  V8/PE18(edge) remain blocked by `cacheComponents: true`; re-check the
  installed `node_modules/next/dist/docs` release/change guides on each Next.js
  upgrade before proposing route-segment config or Edge runtime workarounds.

## Tier 7 — DX & docs

| ID  | Item                                                          | Effort | Impact | Source      |
| --- | ------------------------------------------------------------- | ------ | ------ | ----------- |
| E35 | `noUncheckedIndexedAccess` (single dedicated PR)              | M      | 🟢     | ROADMAP S25 |
| E36 | Consolidate per-route invalidation helpers into one module    | S      | 🟢     | new (audit) |
| E37 | SECURITY / OBSERVABILITY / TESTING / DISASTER_RECOVERY docs   | M      | 🟢     | ROADMAP S24 |
| E38 | OpenAPI spec from validators (`zod-to-openapi`)               | M      | 🟢     | ROADMAP S27 |
| E39 | Cleanup: unreferenced root SVGs in /public, unused deps audit | XS     | 🟢     | new (audit) |

- **E36** — `invalidateUserCaches`-style helpers are re-declared per route
  file (~64 `revalidateTag` calls). One `src/lib/cache-invalidation.ts` with
  the `{ expire: 0 }`/`"max"` convention doc moved there; prevents the E-class
  of "route forgot a tag" bugs (cf. #414).

---

## Corrections to existing trackers (verified 2026-06-12)

Mark these when convenient — the source docs are stale:

- `BUGS.md` Critical 1–3 (transaction races) — **fixed** (`$transaction` +
  increment/decrement everywhere in `transactions/[transactionId]/route.ts`).
- `BUGS.md` High "prices/refresh missing accounts tag" + Medium
  "revalidateTag style mixed" — **fixed** (#414/#415/#417).
- `ROADMAP.md` S1 error boundaries — **shipped** (`(main)/error.tsx`,
  `global-error.tsx` exist); S3 ✅ already correct; S9 — **half-shipped**
  (export + import exist; only true user deletion remains → E16);
  S10 middleware JSON-401 — **obsolete** (proxy matcher excludes `/api/*`).
- `ROADMAP.md` S26 lint-staged — **shipped** (husky pre-commit + lint-staged
  in package.json).
- i18n parity — verified clean (en-US and zh-TW key sets match).

## False alarms — investigated, do NOT re-flag

Recorded so future audits don't waste a cycle:

- Holdings DELETE / stocks PATCH "cross-user scope escape" — **false**: both
  routes pre-check `findFirst({ id, …userId })`. Residual nit is only the
  check-then-write shape (folded into E8).
- "CashTransaction DELETE desync if second statement fails" — **false**:
  it's a `$transaction([...])` array; atomic.
- Page-level "settings waterfalls" (analysis/goals) — **intentional**
  dependency-depth pattern from #408; optimal.
- CoinGecko/Yahoo "sequential per-symbol retries" — **false**: parallel
  `allSettled`, only on batch failure, deliberately isolates bad tickers.
- `fetchAllCachedPrices` full-table read — **deliberate** single-cache-entry
  design; revisit only past ~500 PriceCache rows.
- Missing DB indexes — **none needed at current scale** (DATABASE DB14);
  only the FK indexes bundled into E16 matter, and only at delete time.

## Suggested sequencing

1. **Week 1 — security quick wins:** E10–E15 are shipped, and E24 (the
   `format:check` CI gate) is now done too.
2. **Week 2 — eyes and ears:** the observability trio is complete — E17
   (shipped — `/api/health`) + E18 (CronRun audit) + E19 (Sentry via logger).
   Failures now page you instead of hiding. E18's freshness alarm reuses the
   36 h window E17 already enforces; E19 only activates once a DSN is set.
3. **Week 3 — lock it in:** E22 unit suite is shipped (Vitest service-layer
   tests in CI); E23 E2E gaps are next, then revisit CSP reports only if
   `/api/csp/report` surfaces real production violations.
4. **Then the keystone:** E25 schema migration → F3 cost basis → F6/F8
   cashflow. From here the F-series order above takes over.
5. **Continuous:** E34 on every Next upgrade; revisit E30 only after a Vercel
   Pro upgrade or plan availability change;
   Tier 7 as filler between feature work.
