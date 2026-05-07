# Performance Enhancement Plan — Asset Tracker

Status: proposed
Owner: chuntsai
Last updated: 2026-05-07

This plan continues from VERCEL_ANALYSIS V1–V33, RENDERING_ANALYSIS, and RELEASE_READINESS R1–R26. New items use the **PE#** prefix to avoid clashing with existing V/R/B/S series. Items are sequenced by dependency, not raw impact: Phase 0 instrumentation lands first because every later phase needs measurement to validate.

Evidence collected before drafting:

- Existing-doc audit across `BUNDLE_ANALYSIS.md`, `RENDERING_ANALYSIS.md`, `VERCEL_ANALYSIS.md`, `RELEASE_READINESS.md`, `DOCS_REVIEW_SUGGESTIONS.md`, `LOG.md`, `SUGGESTIONS.md` — confirmed shipped vs open.
- Codebase survey of `"use cache"` adoption (5 services), heavy client islands, image footprint, query patterns, RSC waterfalls, bundle config, `vercel.json`, middleware.
- Vercel API (live): last 20 deployments, latest production build logs, runtime logs.
  - Build duration: 53s end-to-end (compile 27.5s + TS 10.5s + page gen 0.6s + deploy 12s) + cache upload 31s. Build cache 297 MB.
  - **Zero runtime logs in production for the past 7 days at any level** — confirms a critical observability gap.
  - `Detected .env file` warning on every Vercel build.
  - Build region `iad1`, function pinned `sin1`, Neon DB `ap-southeast-1`.

---

## Phase 0 — Observability foundation (must land first)

Without this phase, every later impact claim is a guess. Vercel runtime logs have been empty for 7 days; Speed Insights has no budgets; there is no DB or upstream timing.

### PE1 — Structured server logger
- **Problem:** 22 raw `console.{log,error,warn}` calls across `src/`; no severity, no correlation. Production runtime logs silent for 7 days.
- **Approach:** `src/lib/logger.ts` exporting `log = { info, warn, error, debug }` emitting one JSON line per call (`ts, level, msg, requestId, route, userId?, durationMs?, ...meta`). Replace the 22 raw call sites; add ESLint `no-console` rule outside `lib/logger.ts`.
- **Files:** `src/lib/logger.ts` (new), `src/app/api/**/route.ts`, `src/lib/services/*.ts`, `eslint.config.mjs`.
- **Effort:** S. **Impact:** unblocks all of Phase 1+; produces queryable JSON logs.
- **Validation:** `vercel logs --json | jq '.level'` returns counts.
- **Cross-refs:** closes R17, R18; supersedes V12.

### PE2 — `instrumentation.ts` with DB + upstream timing
- **Problem:** no `src/instrumentation.ts`. Cannot answer "is Yahoo slow today" or "is `getCachedNetWorthSummary` cache-missing every render."
- **Approach:** `register()` wraps Prisma client in `src/lib/prisma.ts` with `$extends` middleware logging `{model, action, durationMs}` for queries >100ms. Add `withTiming(label, fn)` helper; wrap Yahoo and CoinGecko calls in `price-service.ts` and `exchange-rate-service.ts`.
- **Files:** `src/instrumentation.ts` (new), `src/lib/prisma.ts`, `src/lib/services/price-service.ts`, `src/lib/services/exchange-rate-service.ts`.
- **Effort:** M. **Impact:** identifies real bottleneck; makes Phase 1 select-clause work evidence-driven.
- **Validation:** log search `durationMs > 200` returns a non-empty list of slow queries.

### PE3 — Web Vitals budgets in code
- **Problem:** Speed Insights mounted but no budget enforcement; CWV regressions ship silently.
- **Approach:** extend `src/components/layout/speed-insights.tsx` to import `web-vitals` and POST exceedances (LCP > 2500ms, CLS > 0.1, INP > 200ms) to `/api/_metrics/vitals` → `logger.warn`. Document budgets in `docs/PERFORMANCE_BUDGETS.md`.
- **Files:** `src/components/layout/speed-insights.tsx`, `src/app/api/_metrics/vitals/route.ts` (new), `docs/PERFORMANCE_BUDGETS.md` (new).
- **Effort:** S. **Impact:** any CWV regression now logs a structured warning we can alert on.
- **Validation:** throttle network in DevTools, observe the warning line in Vercel logs.

### PE4 — Bundle analyzer baseline + `npm run analyze`
- **Problem:** `next.config.ts` already wires `@next/bundle-analyzer`, but `package.json` has no `analyze` script. V22/V33 open.
- **Approach:** add `"analyze": "ANALYZE=true next build"` to `package.json`. Run once and commit `docs/bundle-baseline-2026-05.md` with the route-by-route JS/CSS sizes. Add CI step that uploads `.next/analyze/*.html` as a PR artifact when `src/components/**` or `next.config.ts` change.
- **Files:** `package.json`, `docs/bundle-baseline-2026-05.md` (new), `.github/workflows/ci.yml`.
- **Effort:** S. **Impact:** every later Phase-1 dynamic-import claim is verifiable against the baseline.
- **Cross-refs:** closes V22, V33; extends `BUNDLE_ANALYSIS.md`.

---

## Phase 1 — Quick wins backed by evidence

All items here are S/M effort and target verified gaps.

### PE5 — Cache `/api/exchange-rates` and `/api/search` upstream calls
- **Problem:** `src/app/api/exchange-rates/route.ts:9` does `prisma.exchangeRate.findMany()` on every miss of the 1h CDN cache. `src/app/api/search/route.ts:64` calls Yahoo on every miss. CDN `s-maxage` helps but in-region cold starts and `Vary` mismatches still hit the DB/upstream. V17/V20 open.
- **Approach:** wrap the DB read in `unstable_cache` with `tags: ["exchange-rates"]` (already revalidated by `/api/exchange-rates/refresh`). For `/api/search`, wrap the Yahoo call with `unstable_cache` keyed by the normalized query string, `revalidate: 3600`, `tags: ["search"]`. Existing `Cache-Control` headers layer cleanly.
- **Files:** `src/app/api/exchange-rates/route.ts`, `src/app/api/search/route.ts`.
- **Effort:** S. **Impact:** TTFB on cached search ~40ms (in-region Postgres) vs ~400ms (Yahoo round-trip US-east). Reduces upstream Yahoo QPS by ~10x.
- **Validation:** PE2 timing logs show Yahoo call count drops; Speed Insights TTFB on `/accounts/[id]` improves.
- **Cross-refs:** closes V17, V20.

### PE6 — Dynamic-import three heavy client islands
- **Problem:** `transaction-history.tsx` (528 LoC + Framer Motion + SWRInfinite), `holding-form.tsx`, and `option-builder.tsx` (already lazy via `quick-add-holding.tsx:30`) ship in `/accounts/[id]` initial bundle even though gated by tab/dialog clicks.
- **Approach:** `dynamic(() => import(...).then(m => m.TransactionHistory), { ssr: false, loading: () => <TransactionHistorySkeleton /> })` for `TransactionHistory` and `HoldingForm` in `account-detail.tsx`.
- **Files:** `src/components/accounts/account-detail.tsx`, `src/components/accounts/transaction-history.tsx` (export skeleton), `src/components/accounts/holding-form.tsx`.
- **Effort:** S. **Impact:** estimated `/accounts/[id]` initial JS −60 to −90 KB gz (Framer Motion alone is ~30 KB gz). Verify against PE4 baseline.
- **Validation:** PE4 analyzer diff before/after; `transaction-history` chunk should appear as a separate async chunk.

### PE7 — Compress OG and Twitter card images
- **Problem:** `public/opengraph-image.png` and `public/twitter-image.png` are 567 KB each (~1.1 MB combined). They are 1200×630 PNGs that should be < 100 KB.
- **Approach:** re-export both as WebP@80 (`opengraph-image.webp`, `twitter-image.webp`) — Next.js Metadata routes serve whichever extension is present. If WebP is undesired for OG-scraper compatibility, recompress as PNG via `pngquant --quality=70-85` (typical 5–8x reduction).
- **Files:** `public/opengraph-image.png`, `public/twitter-image.png` (replace).
- **Effort:** S. **Impact:** −1 MB from public assets footprint; faster preview rendering on Slack/Twitter.

### PE8 — Resolve `.env` warning during Vercel build
- **Problem:** every Vercel build prints `Detected .env file, it is strongly recommended to use Vercel's env handling.` `.env` is gitignored — investigate the upload path.
- **Approach:** add `.vercelignore` with `.env\n.env.*\n!.env.example`. Confirm Vercel project env settings are complete. If the warning persists, audit the build cache content.
- **Files:** `.vercelignore` (new).
- **Effort:** S. **Impact:** removes the warning + small upload cost; defensive against shipping secrets in the build artifact.
- **Validation:** next deploy log shows no `.env` warning.

### PE9 — Stable currency/number formatters
- **Problem:** `src/lib/currencies.ts:37` and `:51` create a new `Intl.NumberFormat` on every call. `formatCurrency` is invoked from Recharts tooltips that re-render on hover (8 chart components in `src/components/analysis/`). S#91 open.
- **Approach:** memoise per-(currency, compact, decimals) tuple inside `currencies.ts`:
  ```ts
  const cache = new Map<string, Intl.NumberFormat>();
  function getFormatter(key, opts) { ... }
  ```
  Same treatment for `formatNumber`. Replace 5 ad-hoc client `new Intl.NumberFormat(...)` sites in form blur handlers with a shared `formatQuantityInput(parsed, decimals)` helper from `currencies.ts`.
- **Files:** `src/lib/currencies.ts`, `src/components/accounts/quick-add-holding.tsx`, `src/components/accounts/holding-form.tsx`, `src/components/accounts/option-builder.tsx`, `src/components/accounts/account-form.tsx`, `src/components/accounts/inline-balance-editor.tsx`.
- **Effort:** S. **Impact:** each chart hover re-render saves ~5 `Intl.NumberFormat` constructions; INP on `/analysis`.
- **Validation:** Performance recorder shows no `Intl.NumberFormat` constructor calls during chart hover.
- **Cross-refs:** closes S#91.

### PE10 — Tighten settings-service cache scope
- **Problem:** `src/lib/services/settings-service.ts:17` is cached via `findSettings`, but `cacheLife("minutes")` is conservative for a setting that only changes via explicit POST. Also, the create-fallback path inside `getOrCreateSettingsInner` runs on every render for users who somehow lack a row.
- **Approach:** change to `cacheLife("hours")` (mutation route already calls `revalidateTag(\`settings:${userId}\`)`). Move the create fallback to a dedicated server action `ensureSettings(userId)` that runs once at signup time (`auth.ts` `events.signIn`) instead of on every dashboard render.
- **Files:** `src/lib/services/settings-service.ts`, `src/auth.ts`.
- **Effort:** S. **Impact:** removes 1 DB round-trip per render for new users; lengthens cache-hit window for everyone.
- **Validation:** PE2 logs show `setting.findUnique` calls drop materially after warm-up.

---

## Phase 2 — Structural

These need PE2 timing data to prioritise within the phase.

### PE11 — `revalidateTag` audit
- **Problem:** 5 cached services × 9 mutation routes = a matrix where one missed tag means stale dashboards. V21 open. **Verified gap:** POST `/api/accounts/[id]/transactions` does not call `revalidateTag(\`net-worth:${userId}\`)` even though it shifts cash balance and snapshot inputs.
- **Approach:** build `docs/CACHE_INVALIDATION_MATRIX.md` listing each tag × route. Patch:
  - POST `/api/accounts/[id]/transactions` → `revalidateTag(\`accounts:${userId}\`, "max")`, `revalidateTag(\`net-worth:${userId}\`, "max")`, `revalidateTag(\`history:${userId}\`, "max")`.
  - DELETE/PATCH `/api/accounts/[id]/transactions/[transactionId]` → same set.
  - POST `/api/accounts/[id]/cash-transactions` → same set.
- **Files:** `src/app/api/accounts/[id]/transactions/route.ts`, `.../[transactionId]/route.ts`, `.../cash-transactions/route.ts`, `docs/CACHE_INVALIDATION_MATRIX.md` (new).
- **Effort:** M. **Impact:** correctness — unblocks more aggressive cache TTLs in PE10/PE15.
- **Cross-refs:** closes V21.

### PE12 — Add `select` clauses to over-fetching reads
- **Problem:** verified at `net-worth-service.ts:24` (`include: { holdings }` returns every column), `:47` (`priceCache.findMany` returns full row including unused metadata JSON), and the cash-transaction read in `history-service.ts:249`.
- **Approach:** explicit `select` clauses returning only consumed fields. Accounts: `id, name, type, category, currency, cashBalance, isActive`. Holdings (within `include`): `id, symbol, name, quantity, currency, assetType, contractMultiplier`. PriceCache: `symbol, price, currency`. CashTransaction: `amount, type, createdAt, account: { select: { currency: true } }` (already partial).
- **Files:** `src/lib/services/net-worth-service.ts`, `src/lib/services/history-service.ts`, `src/app/(main)/accounts/[id]/page.tsx`.
- **Effort:** M. **Impact:** wire-bytes from Neon −30–60% for the dashboard query; per-row decode time on the function. PE2 timings will quantify.
- **Validation:** PE2 `durationMs` for `account.findMany` drops; payload bytes (Neon logs) drop.

### PE13 — Cursor pagination for transactions
- **Problem:** `src/app/api/accounts/[id]/transactions/route.ts:23` uses `OFFSET ${offset}` over a UNION ALL. Postgres still scans rows up to the offset, so page 50 of a long-history account is 50× slower than page 1. S#106 open.
- **Approach:** replace `page/limit` with `cursor` (opaque base64 of `{createdAt, id}`); raw SQL `WHERE (createdAt, id) < (cursor.createdAt, cursor.id)`. Switch the `transaction-history.tsx` SWRInfinite key generator from `?page=N&limit=20` to `?cursor=X&limit=20`.
- **Files:** route handler + `transaction-history.tsx`.
- **Effort:** M. **Impact:** O(1) page latency regardless of history depth. Page-50 load drops from ~600 ms to ~50 ms.
- **Validation:** PE2 timing log; Playwright test that paginates to page 20 in `tests/e2e/`.
- **Cross-refs:** closes S#106.

### PE14 — Dedupe `/accounts/[id]` reads with the dashboard cache
- **Problem:** `src/app/(main)/accounts/[id]/page.tsx:21` does its own `prisma.account.findUnique({ include: { holdings } })`, completely bypassing the cached `fetchUserAccountsWithHoldings(userId)` from `net-worth-service.ts:19`. Same for `prisma.priceCache.findMany` at `:33`. V16 open.
- **Approach:** refactor `AccountDetailContent` to call `fetchUserAccountsWithHoldings(session.user.id)` and `.find(a => a.id === id)` — the cached read is per-user, hitting the dashboard's warm cache on most navigations. For prices, expose a cached `getPricesForSymbols(symbols)` from `price-service.ts` wrapping `findMany` in `unstable_cache` with `tags: ["prices"]`.
- **Files:** `src/app/(main)/accounts/[id]/page.tsx`, `src/lib/services/price-service.ts`, `src/lib/services/net-worth-service.ts`.
- **Effort:** M. **Impact:** account-detail TTFB on warm cache drops from ~250 ms to ~10 ms.
- **Validation:** PE2 logs; Speed Insights TTFB for `/accounts/[id]`.
- **Cross-refs:** closes V16.

### PE15 — Mobile CWV verification pass
- **Problem:** recently shipped iOS bottom-sheet modals, swipe-to-edit gestures, and pull-to-refresh have no measured CWV impact. `pull-to-refresh.tsx` and `mobile-main-shell.tsx` exist but have no INP/CLS data on mobile viewport. V23 chart-card height reservation also open.
- **Approach:**
  1. Add a Playwright project in `playwright.config.ts` for the iPhone-15 viewport that runs the existing flows and reports CWV via the `web-vitals` script injected in PE3.
  2. Reserve heights on chart cards in `lazy-charts.tsx` with `min-h-[280px]` so SSR shells match client-rendered height.
  3. Audit `mobile-header.tsx` and `pull-to-refresh.tsx` for layout shifts via `Performance.observe('layout-shift')`.
- **Files:** `playwright.config.ts`, `src/components/dashboard/lazy-charts.tsx`, `src/components/dashboard/*chart*.tsx`, `src/components/layout/mobile-header.tsx`, `src/components/layout/pull-to-refresh.tsx`.
- **Effort:** M. **Impact:** mobile CLS target < 0.05; INP < 200 ms on swipe.
- **Validation:** Playwright CWV report; Speed Insights mobile slice.
- **Cross-refs:** closes V23.

---

## Phase 3 — Stretch / nice-to-have

High effort or uncertain payoff; revisit after Phase 2 telemetry lands.

### PE16 — Build cache audit (297 MB → target < 150 MB)
- **Problem:** `cache upload 31s` of the 53s build is uploading 297 MB. V15 open. Likely culprits: `.next/cache/webpack/`, `node_modules/.prisma/`, Playwright browsers in `node_modules`.
- **Approach:** run `du -sh .next/cache/* node_modules/.cache/*` locally after a build; identify entries > 50 MB. Consider moving Playwright to a separate npm workspace; exclude inactive `@next/swc-*` platforms via `.vercelignore`.
- **Effort:** L (investigative). **Impact:** −5–10 s deploy time. Diminishing returns vs Phase 0–2.

### PE17 — ISR for `/privacy` and `/terms`
- **Problem:** static legal pages currently render on every request (no caching directive verified).
- **Approach:** `export const revalidate = 86400` in `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`. They are pure markdown — no dynamic data.
- **Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`.
- **Effort:** S. **Impact:** TTFB ~5 ms on warm cache. Tiny but free.

### PE18 — Edge-runtime evaluation for `/api/search` and `/api/exchange-rates`
- **Problem:** both routes are pure-read after PE5 caching lands. They would benefit from edge runtime — but `prisma.exchangeRate.findMany()` keeps Node runtime required.
- **Approach:** after PE5, the cached path doesn't touch Prisma. If the cached function is extracted so the handler can short-circuit on cache hit before importing Prisma, the route can switch to `runtime: "edge"`. Worth measuring before committing.
- **Effort:** L (uncertain payoff). **Impact:** 50–150 ms TTFB win for non-AP users; risk: bundle bloat from Prisma fallback.

### PE19 — Migrate-region note (informational, no code change)
- **Problem:** build runs in `iad1` but `prisma migrate deploy` connects to Neon in `ap-southeast-1` — cross-region round-trip on every migration.
- **Approach:** document the trade-off in `docs/DEPLOYMENT_NOTES.md`. Investigate moving builds to `sin1` only if migration latency exceeds 30 s (today it does not).
- **Effort:** S (doc only).

---

## Verification end-to-end

After Phase 0 lands, every later item is verified the same way:

1. **Speed Insights** (`https://vercel.com/<team>/asset-tracker/speed-insights`) — track LCP, CLS, INP per route weekly. Trend lines should not regress.
2. **Bundle baseline diff** — `npm run analyze` before and after each Phase 1/2 PR. Attach `.next/analyze/client.html` artifact to the PR.
3. **Vercel runtime log queries** (after PE1–PE2):
   - Slow queries: `level:warn AND durationMs:>200`
   - Cache misses: `msg:"cache miss" AND tag:"net-worth"`
   - Upstream failures: `msg:/yahoo|coingecko/ AND level:error`
4. **Playwright CWV project** (PE15) — run on PRs touching `src/components/**`; fail if mobile LCP > 2500 ms or CLS > 0.05.
5. **Build duration** — Vercel build view; target < 45 s end-to-end after PE16.

A single PR for Phase 0 must ship before any other PE# is merged.

---

## What this plan deliberately does NOT cover

Tracked elsewhere — out-of-scope here:

- PPR / Cache Components per-route rollout — V26, V27 (`RENDERING_ANALYSIS.md`).
- Security headers, rate limiting, OAuth verification — R1, R3, R9.
- CI E2E / Playwright auth setup — R20, R21.
- Avatar image optimisation — V31. Font preload + content-visibility — V24. `startTransition` migrations — V25, V30.
- CoinGecko revalidation pattern — `RENDERING_ANALYSIS.md` I3. Prisma client dedup — V2.
- Single-region Vercel function pinning — V5. Hover prefetch — V6.
- DB schema redesign / partitioning — out of v1 scope; net-worth snapshot table is small enough.
- A/B framework, feature flags — product concern, not perf.
- Service worker / PWA install — already addressed by `install-app-card.tsx`; no perf gap identified.

---

## Critical Files

Complete de-duped list of every path the plan touches (PE# in parens):

- `src/lib/logger.ts` (new — PE1)
- `src/instrumentation.ts` (new — PE2)
- `src/lib/prisma.ts` (PE2)
- `src/lib/services/price-service.ts` (PE2, PE14)
- `src/lib/services/exchange-rate-service.ts` (PE2)
- `src/lib/services/settings-service.ts` (PE10)
- `src/lib/services/net-worth-service.ts` (PE12, PE14)
- `src/lib/services/history-service.ts` (PE12)
- `src/lib/currencies.ts` (PE9)
- `src/components/layout/speed-insights.tsx` (PE3)
- `src/app/api/_metrics/vitals/route.ts` (new — PE3)
- `src/app/api/exchange-rates/route.ts` (PE5)
- `src/app/api/search/route.ts` (PE5)
- `src/app/api/accounts/[id]/transactions/route.ts` (PE11, PE13)
- `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts` (PE11)
- `src/app/api/accounts/[id]/cash-transactions/route.ts` (PE11)
- `src/app/(main)/accounts/[id]/page.tsx` (PE12, PE14)
- `src/app/privacy/page.tsx` (PE17)
- `src/app/terms/page.tsx` (PE17)
- `src/auth.ts` (PE10)
- `src/components/accounts/account-detail.tsx` (PE6)
- `src/components/accounts/transaction-history.tsx` (PE6, PE13)
- `src/components/accounts/holding-form.tsx` (PE6, PE9)
- `src/components/accounts/quick-add-holding.tsx` (PE9)
- `src/components/accounts/option-builder.tsx` (PE9)
- `src/components/accounts/account-form.tsx` (PE9)
- `src/components/accounts/inline-balance-editor.tsx` (PE9)
- `src/components/dashboard/lazy-charts.tsx` (PE15)
- `src/components/layout/mobile-header.tsx` (PE15)
- `src/components/layout/pull-to-refresh.tsx` (PE15)
- `eslint.config.mjs` (PE1)
- `package.json` (PE4)
- `playwright.config.ts` (PE15)
- `.vercelignore` (new — PE8)
- `public/opengraph-image.png` (PE7)
- `public/twitter-image.png` (PE7)
- `docs/PERFORMANCE_BUDGETS.md` (new — PE3)
- `docs/bundle-baseline-2026-05.md` (new — PE4)
- `docs/CACHE_INVALIDATION_MATRIX.md` (new — PE11)
- `docs/DEPLOYMENT_NOTES.md` (new — PE19)
