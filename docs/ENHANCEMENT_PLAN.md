# Assets Tracker — Enhancement Plan (2026-06-12)

A consolidated, **code-verified** forward roadmap. Unlike the per-lens trackers
(`BUGS.md`, `ROADMAP.md`, `PERFORMANCE.md`, `PLATFORM.md`, `DATABASE.md`,
`CODE_QUALITY.md`, `UI_UX.md`), every item here was re-checked against the
actual code on 2026-06-12 — stale ✅/❌ statuses from those docs are corrected
here, and false alarms found during the audit are recorded so they don't get
re-flagged. Use this file as the "what to do next" view; when you ship an item,
tick it here **and** in the source tracker.

**Codebase state at audit time.** Master includes PRs #403–#417 (perf rounds,
cache unification, unified `/api/refresh`); #418 (cron revalidation gating) and
#419 (bundle CI gate, splash cache headers, cash-flow date floor) are open and
assumed to merge. Bundle, rendering/PPR, service-layer caching, and page
waterfalls are in good shape — the remaining work clusters around
**data integrity, security hardening, observability, unit testing, schema
evolution, and product features**.

Legend — Effort: XS ≤30 min · S ≤2 h · M ½–1 day · L 1–3 days · XL >3 days.
Impact: 🔴 data risk / security / launch blocker · 🟡 meaningful · 🟢 polish.

---

## Tier 0 — Data integrity & correctness (do first)

Small fixes; every one is a verified live bug with user-visible consequences.

| ID  | Item                                                                         | Effort | Impact | Source            |
| --- | ---------------------------------------------------------------------------- | ------ | ------ | ----------------- |
| E1  | ✅ UTC-floor the snapshot date                                               | XS     | 🔴     | BUGS Critical     |
| E2  | ✅ History dedupe tie-break by `max(createdAt)`                              | XS     | 🔴     | BUGS High         |
| E3  | ✅ Guard `token.sub` in auth callbacks                                       | XS     | 🔴     | BUGS High         |
| E4  | FX: persist inverse rates + surface a stale flag                             | S      | 🔴     | BUGS High ×2      |
| E5  | Stop defaulting null `contractMultiplier` to 100                             | S      | 🟡     | BUGS High         |
| E6  | Tighten validators (qty>0, immutable assetType, tx unions, datetime)         | S      | 🟡     | BUGS High ×3      |
| E7  | ✅ Decimal-safe `cashBalance` diff in account PATCH                          | XS     | 🟡     | BUGS Medium       |
| E8  | Zod-validate holdings DELETE body; scope deletes/updates in the write itself | XS     | 🟡     | BUGS Medium + new |
| E9  | ✅ Goal import: fail loudly when `scopeRefId` remap misses                   | XS     | 🟡     | new (audit)       |

- **E1** — `src/lib/services/snapshot-service.ts:8-9` still floors "today" with
  local-time `setHours(0,0,0,0)`. The upsert key `userId_date_baseCurrency`
  drifts a day depending on function region → duplicate/merged daily snapshots.
  Fix: `new Date(Date.UTC(y, m, d))`. The last remaining Critical in BUGS.md.
- **E2** — `src/lib/services/history-service.ts` `normalizeSnapshots()`
  tie-breaks same-day snapshots by base-currency match, not greatest
  `createdAt`; manual + cron snapshots on one day render non-deterministically.
- **E3** — `src/auth.ts:55-59` assigns `session.user.id = token.sub!` —
  if a provider ever omits `sub`, every request 401s with no log. Throw loudly.
- **E4** — `exchange-rate-service.ts`: timeout returns `{}` and `resolveRate`
  silently falls back to `1` (values render wrong with no signal); inverse
  rates are derived `1/rate` on the fly (float drift on chained conversions).
  Persist both directions on write; return a `stale` flag the UI can badge.
- **E5** — `net-worth-service.ts:97` `?? 100` silently misprices non-standard
  option contracts 10×. Require at the validator layer; `log.warn` when defaulting.
- **E6** — `src/lib/validators.ts`: `updateHoldingSchema.quantity` accepts `0`
  (zombie holdings hidden only by read-time filters); `assetType` is mutable
  (STOCK→OPTION without OCC fields = unrepresentable row); transaction update
  schemas lack a discriminated union on `type` and accept non-datetime
  `createdAt`. One PR across the schema file + the routes that consume it.
- **E8** — `accounts/[id]/holdings/route.ts:182-196`: `const { id } = body`
  un-validated (400 vs 404 confusion), and the delete/update statements are
  check-then-write on bare `id` — fold ownership into the write
  (`deleteMany({ where: { id, account: { userId } } })`) to remove the TOCTOU
  window. Same pattern in `stocks/[id]/route.ts` PATCH/DELETE.
- **E9** — `settings/data/route.ts:~387`: imported ACCOUNT-scoped goals whose
  old account id isn't in the remap silently get a dangling/null `scopeRefId`.

## Tier 1 — Security hardening

| ID  | Item                                                             | Effort | Impact | Source              |
| --- | ---------------------------------------------------------------- | ------ | ------ | ------------------- |
| E10 | Timing-safe `CRON_SECRET` comparison                             | XS     | 🔴     | ROADMAP S2          |
| E11 | Rate-limit coverage on all mutation routes                       | S      | 🔴     | BUGS High (partial) |
| E12 | `getClientIp` fallback chain (`cf-connecting-ip`, `x-real-ip`)   | XS     | 🟡     | BUGS High           |
| E13 | Import hardening: body-size cap + Zod array `.max()`             | S      | 🟡     | new (audit)         |
| E14 | Validate `/api/options/chain` symbol shape before upstream fetch | XS     | 🟡     | BUGS Medium         |
| E15 | CSP header: Report-Only → enforce (report endpoint scaffolded)   | M      | 🔴     | ROADMAP S8          |
| E16 | GDPR completion: true account deletion (`user.delete` cascade)   | M      | 🔴     | ROADMAP S9 ⚠️       |

- **E10** — `cron/snapshot/route.ts:12` still `===`-compares the bearer token.
  `crypto.timingSafeEqual` over equal-length buffers; one line.
- **E11** — Verified unthrottled: `/api/accounts` POST/DELETE, `reorder`,
  `[id]` PATCH, holdings POST/PATCH, `goals` POST, `stocks` POST,
  `settings/data` POST (import!). All auth-gated but spammable. Wrap each with
  `rateLimitCheckWithPrune` (per-user key; generous caps, e.g. 60/min edits,
  5/min imports). `/api/refresh` and search are already covered.
- **E13** — Vercel caps request bodies (~4.5 MB) so this is hardening, not an
  open DoS: still add a `Content-Length` check and `.max()` caps on the import
  schema's accounts/holdings/transactions arrays so a pathological import
  fails fast with a clear error instead of an OOM-ish parse.
- **E15** — `next.config.ts` has the R1 security headers but no CSP. Ship
  `Content-Security-Policy-Report-Only` (script-src nonce, connect-src
  allowlist for Yahoo/CoinGecko/Vercel), watch a week, flip to enforce.
- **E16** — Export (`GET /api/settings/data`) and replace-import already exist;
  what's missing for GDPR is **deleting the User row itself** (cascades to
  auth accounts/sessions/settings/snapshots/goals per schema). Add
  `DELETE /api/account` + a confirm flow in Settings. Add the missing FK
  indexes on `AuthAccount.userId` / `Session.userId` in the same PR — Postgres
  needs them for efficient cascade (DATABASE.md follow-up).

## Tier 2 — Observability (the "blind cron" cluster)

Production runtime logs were empty over a 7-day MCP window; if the nightly
snapshot stops, nothing tells you. PLATFORM F1 flags this trio as "do first".

| ID  | Item                                                     | Effort | Impact | Source        |
| --- | -------------------------------------------------------- | ------ | ------ | ------------- |
| E17 | `/api/health` — DB ping + latest-snapshot freshness      | XS     | 🔴     | ROADMAP S5    |
| E18 | `CronRun` audit table + >36 h freshness alarm            | M      | 🔴     | ROADMAP S6    |
| E19 | Sentry (or equivalent) wired through `src/lib/logger.ts` | M      | 🔴     | ROADMAP S4 ⚠️ |
| E20 | Request-context correlation (requestId/userId) in logger | S      | 🟢     | new (audit)   |
| E21 | Snapshot reconciliation side-job (drift >0.5% alert)     | S      | 🟢     | ROADMAP S28   |

- **E19** — The structured logger half of S4 is done (`logger.ts`, ~30 call
  sites, JSON output, `withTiming`); what's missing is shipping errors
  somewhere that alerts. `src/instrumentation.ts` exists as the hook point.
- **E18** — Cron writes a `CronRun { name, startedAt, finishedAt, ok, error,
durationMs }` row each run; `/api/health` (E17) goes red when no successful
  row in 36 h. #418's `cron.revalidate.gate` log line gives partial signal
  but only when logs are being watched — the table makes it queryable.

## Tier 3 — Testing

| ID  | Item                                                                | Effort | Impact | Source      |
| --- | ------------------------------------------------------------------- | ------ | ------ | ----------- |
| E22 | Vitest + first service-layer suite                                  | M      | 🔴     | ROADMAP S7  |
| E23 | E2E gaps: /projections, /history, settings import/export round-trip | M      | 🟡     | new (audit) |
| E24 | Run `format:check`/`lint` in PR CI (not just pre-push hook)         | XS     | 🟢     | new (audit) |

- **E22** — Zero unit tests exist. First wave, all pure functions:
  `net-worth-service` two-pass + missing-rate path · `exchange-rate-service`
  `resolveRate` identity/inverse/cross · `history-service` normalize + dedupe
  (locks in E2's fix) · `analysis-service` bucket aggregations ·
  `types.ts` serializers (Decimal/Date stripping) · `validators.ts` edge cases
  (locks in E6). A regression in net-worth math currently only surfaces in E2E.
- **E23** — Playwright covers smoke/accounts/analysis/stocks/mobile; the
  pages with the most math (projections, history) and the riskiest mutation
  (data import) have no coverage. An import→export round-trip equality test
  doubles as a backup-integrity guarantee.

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
2. **F6 — Recurring cash transactions** (M · 🔴) + **F8 — categories /
   spending insights** (L · 🟡, opt-in toggle) — makes the projections page's
   savings-rate real instead of assumed; cron already has the daily hook.
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

- Mobile/UX companions when touching these surfaces: S11 color-blind-safe
  asset/liability cues (icon + label, not color alone) and the remaining
  UI_UX M-series CSS fixes (S12).

## Tier 6 — Performance & platform (what's actually left)

The June audit closed most of this. Remaining, in order:

| ID  | Item                                                            | Effort     | Impact | Source      |
| --- | --------------------------------------------------------------- | ---------- | ------ | ----------- |
| E30 | Vercel dashboard toggles: Skew Protection + Rolling Releases    | XS         | 🟡     | ROADMAP S20 |
| E31 | P3 — exclude `/login`/`/privacy`/`/terms` from proxy matcher    | M          | 🟡     | PLATFORM P3 |
| E32 | PE16/V15 — build-cache audit (297 MB → <150 MB)                 | L          | 🟢     | PERFORMANCE |
| E33 | P7 — trusted `x-user-id` header to remove RSC double-decode     | L          | 🟢     | PLATFORM P7 |
| E34 | Re-test `cacheComponents`-blocked items on each Next.js upgrade | XS/upgrade | 🟢     | PERFORMANCE |

- **E30** is a no-code pair of dashboard switches — do it in one session.
- **E33** is security-sensitive (header spoofing if misconfigured) — needs a
  careful review; only worth it if Fluid CPU numbers say JWT decode matters.
- **E34** — S1/S2(SSG), I1/I2/I4(ISR), V8/PE18(edge) are all blocked by
  `cacheComponents: true`, not by our code. Re-check the constraint in each
  Next.js release note; don't re-implement around it.

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

1. **Week 1 — correctness sweep:** E1–E9 + E10 + E12 + E14 (one or two PRs;
   all XS/S). Highest risk-reduction per hour in the repo.
2. **Week 2 — eyes and ears:** E17 + E18 + E19 (+E24). After this, failures
   page you instead of hiding.
3. **Week 3 — lock it in:** E22 unit suite (+E23 E2E gaps), then E11 + E13 +
   E15 hardening.
4. **Then the keystone:** E25 schema migration → F3 cost basis → F6/F8
   cashflow. From here the F-series order above takes over.
5. **Continuous:** E30 toggles now (5 min); E34 on every Next upgrade;
   Tier 7 as filler between feature work.
