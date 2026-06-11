# Performance Enhancements — Next Round (3 PRs)

## Context

Audit of `docs/` trackers + fresh code scan (2026-06-11) to find remaining performance work. Key conclusions from verification:

- **Already shipped, docs stale:** S19 preconnect (`src/app/layout.tsx:288`), P8 Yahoo singleton (`src/lib/services/yahoo-client.ts`), S21/V23 chart height reserves (skeletons + `initialDimension`), V22/V33 analyzer wiring.
- **False alarms from code scan (do NOT implement):** "settings waterfalls" in analysis/goals pages are the intentional dependency-depth pattern (PR #408); CoinGecko "sequential retries" is a parallel `allSettled` fallback that only runs on batch failure; `/accounts` summary dedupe works via React `cache()`; `fetchAllCachedPrices` full-table read is a deliberate single-cache-entry design (49 rows).
- **Genuinely open + chosen by user:** quick wins (S18, V20, PE29, TopMoversList memo) + Fluid-CPU mediums (P5, P6).

Per user preference: copy this plan into repo `docs/` as the first implementation step. Per memory: perf findings were double-checked (Fable Plan agent + manual verification) before this plan.

**PR ordering constraint:** PR #414 (open, mergeable) touches `src/app/api/prices/refresh/route.ts`, which PR 2 deletes. **Merge #414 (and #416) before starting PR 2.**

---

## PR 1 — Quick wins (Workstream A)

### A0. Plan doc

Copy this plan to `docs/PERF_ROUND3_PLAN.md` (user preference: plans live in repo docs/).

### A1. S18 — Bundle-size CI gate

**Approach:** one build per PR + baseline saved on master pushes, exchanged via `actions/cache`. Metric: total gzipped bytes of `.js`+`.css` under `.next/static` (per-file diffs unreliable — content-hashed names). CI facts: PRs run lint+typecheck only; `build` job runs on master push with placeholder env (no DB needed); deps cache includes `src/generated/prisma`.

- **New `scripts/ci/bundle-size.mjs`** (zero deps; `node:zlib.gzipSync`):
  - `--write <out.json>`: walk `.next/static`, write `{ totalGzipBytes, jsGzipBytes, cssGzipBytes, fileCount, sha }`.
  - `--compare <baseline> --against <head> --max-growth 0.05`: missing baseline → `::warning::` + exit 0 (self-heals on next master push); writes markdown table to `$GITHUB_STEP_SUMMARY`; exit 1 with `::error::` if growth >5%.
- **`.github/workflows/ci.yml`:**
  - Master `build` job: append `Measure bundle baseline` (`--write bundle-baseline.json`) + `actions/cache/save@v4` with key `bundle-baseline-${{ github.sha }}`.
  - New PR-only `bundle-size` job (copy `[skip ci]` guard + deps-cache + `.next/cache` restore boilerplate from existing jobs): `npm run build` → `--write bundle-head.json` → `actions/cache/restore@v4` with `restore-keys: bundle-baseline-` → compare.
- Edge cases: cache eviction → soft-pass warning; deliberate growth merges via baseline bump (note in script header).

### A2. V20 — Cache-Control for /public assets

**`next.config.ts`** — append to existing `headers()` array:

- `source: "/splash/:path*"` → `public, max-age=31536000, immutable` (iOS PWA splash, only producer is `scripts/generate-splash-screens.mjs`; comment: rename file if design changes).
- `source: "/sw.js"` → `public, max-age=0, must-revalidate` (pin explicitly so future patterns can't long-cache the service worker).
- Deliberately NOT cached: og/twitter images, robots.txt (Vercel default ETag/304 is correct). Root SVGs (`file/globe/next/vercel/window.svg`) are unreferenced starter leftovers — delete-candidate note, not cache target.

### A3. PE29 — Date-floor `getAccountMonthlyCashFlow`

`src/lib/services/history-service.ts:280-310`. Safe despite the "All" range: analysis buckets + attribution are anchored to the first snapshot's month, so older transactions are unreachable by any range.

- Add `netWorthSnapshot.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } })` to the existing `Promise.all`.
- Floor = first day of first snapshot's month (UTC); add `createdAt: { gte: floor }` to the `cashTransaction.findMany` where (no floor if no snapshots).
- Comment the invariant. Cache tags already correct (`history:${userId}` fires on snapshot writes → floor refreshes).

### A4. TopMoversList memo

`src/components/analysis/top-movers-list.tsx`: wrap component in `React.memo` (consistent with the 5 charts memoized in PR #403; `AnalysisView` re-renders on sticky-sentinel `isStuck` flips while `movers`/`baseCurrency` are stable). Skip per-row memo (capped at 10 rows).

### A5. Doc updates (same PR)

- `docs/ROADMAP.md`: S18 ✅ (this PR), S19 ✅ (layout.tsx:288), S21 ✅ (skeletons + `initialDimension` — cite `lazy-analysis-charts.tsx`, `trend-chart-skeleton.tsx`, `src/components/ui/chart.tsx`). Quick-ref rows + detail blocks.
- `docs/PLATFORM.md`: V20 ✅ (this PR), V22/V33 ⚠️→✅, V23 ✅, P8 ✅ (verify `search/route.ts` + `options/chain/route.ts` import yahoo-client first).
- `docs/PERFORMANCE.md`: PE29 ✅ with chosen approach.

### Verification (PR 1)

`npm run format:check && npm run lint && npm run typecheck && npm run build`. Headers: `npm run start` + `curl -sI localhost:3000/splash/<file> | grep -i cache-control` (immutable) and `/sw.js` (must-revalidate); authoritative re-check on Vercel preview. PE29: `/analysis` "All" range renders identical charts before/after (preview login per memory). CI gate: job soft-passes on this PR (no baseline); after merge, open a throwaway PR with a fat client import → job fails.

---

## PR 2 — P5: single user-scoped `POST /api/refresh` (after #414 + #416 merge)

**New `src/app/api/refresh/route.ts`** (withAuth + `rateLimitCheckWithPrune({ limit: 5, prefix: "market-refresh", key: userId })`):

1. Read user's `baseCurrency` + distinct account currencies (verbatim from old exchange-rates/refresh route).
2. `Promise.all([refreshPricesForUser(userId), Promise.all(currencies.map(c => refreshExchangeRates(c)))])` — `refreshExchangeRates` already per-base-currency with 1h freshness gate; no service change needed.
3. ONE revalidation block (convention: per-user `{ expire: 0 }`, global `"max"`):
   - prices dirty → `prices`, `prices:crypto` ("max")
   - rates dirty → `exchange-rates` ("max"), `history:${userId}` ({ expire: 0 })
   - either dirty → `net-worth` ("max"), `net-worth:${userId}` ({ expire: 0 }), **`accounts:${userId}` ({ expire: 0 }) — carries forward PR #414's fix; must not be lost when the old route is deleted**
4. Response: `ok({ prices: { updated, skippedFresh, retryAfterSeconds }, rates: { ... } })` (aggregate as old route did).

**Delete** `src/app/api/prices/refresh/route.ts` + `src/app/api/exchange-rates/refresh/route.ts` (verified sole caller: `src/lib/refresh-client.ts`). **`vercel.json`:** swap the two `functions` entries for `"src/app/api/refresh/route.ts": { "maxDuration": 60 }`.

**Client:** only `src/lib/refresh-client.ts` changes — replace two-fetch `Promise.all` (lines 58-74) with one `fetch("/api/refresh", { method: "POST" })`; keep `RefreshOutcome` union, cooldown/429/`Retry-After` handling, `prices:refreshed` event unchanged → zero edits in `dashboard-actions.tsx`, `dashboard-pull-refresh.tsx`, `settings-form.tsx`, `use-refresh-cooldown.ts`.

**Docs:** P5 ✅ in `docs/PLATFORM.md` (section + critical-files table); note the `{ expire: 0 }` semantic upgrade in PR body.

### Verification (PR 2)

`npm run check`; locally (preview login + seed): Refresh button → exactly ONE `POST /api/refresh` in network tab; prices update after `router.refresh()`; pull-to-refresh + Settings refresh still work; 6th click in a minute → 429 cooldown toast; re-click within TTL → "already fresh" toast.

---

## PR 3 — P6: gate cron revalidations on actual change

**Key insight:** `updated`-count gating is insufficient — cron forces refreshes and upserts rewrite rows even when values are identical, so `updated > 0` ~every night. ε net-worth comparison also unnecessary. **Chosen: `changed`-count** — pre-write SELECT of existing rows, exact value comparison normalized to 8 dp (column is `Decimal(18,8)` — round-trip exact, no epsilon).

1. `src/lib/services/price-service.ts`: add `changed: number` to `RefreshPricesResult` (early returns get 0). In `refreshPricesForHoldings` before upsert (~line 350): fetch prev prices by symbol, count `prev.get(sym) !== Number(price.toFixed(8))` (missing = changed). Do NOT add `IS DISTINCT FROM` to the upsert — `updatedAt` must keep bumping (freshness gate + FreshnessBadge depend on it).
2. `src/lib/services/exchange-rate-service.ts`: same pattern — `changed` on `RefreshRatesResult`, pre-read before the `$executeRawUnsafe` upsert (~line 193).
3. `src/app/api/cron/snapshot/route.ts` (lines 65-93): capture results; `log.info("cron.revalidate.gate", { ratesChanged, pricesChanged })`; revalidate `exchange-rates` only if ratesChanged, `prices`/`prices:crypto` only if pricesChanged, `net-worth` if either; ALWAYS `snapshots` + per-user `history:${id}` (snapshot rows always written). Keep option-expiry `accounts` revalidation as-is. All cron calls stay `"max"`.
4. Leave PR 2's `/api/refresh` gating on `updated` (its non-forced freshness gate makes that meaningful); optional follow-up to use `changed`.

**Docs:** P6 ✅ in `docs/PLATFORM.md`, noting changed-count over ε-comparison and why.

### Verification (PR 3)

Hit `GET /api/cron/snapshot` with `Bearer $CRON_SECRET` twice locally: 1st run logs `pricesChanged > 0`; 2nd logs 0 and skips prices/net-worth revalidations while history still shows the new snapshot. After deploy: confirm `cron.revalidate.gate` in Vercel runtime logs.

---

## Risks

- A1: +1 `next build` (~2-4 min warm) per PR — inherent to any gate.
- A2: splash stale up to 1y if changed without rename (comment + regeneration script makes rename cheap).
- B (P6): a missed invalidation bounded by `cacheLife("hours")`; gate is exact value comparison, not heuristic.
- PR 2 deletes a route #414 just fixed — the `accounts:${userId}` invalidation is explicitly carried into the new route (step 3).
