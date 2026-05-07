# Assets Tracker — Performance

This file consolidates three former docs: `BUNDLE_ANALYSIS.md` (B1–B15), `RENDERING_ANALYSIS.md` (S/P/I/X items), and `PERFORMANCE_ENHANCEMENT_PLAN.md` (PE1–PE19).

---

## Bundle Optimization

Findings from running `@next/bundle-analyzer` locally on **2026-04-20**. Baselines: client bundle ~609 KB compiled, NodeJS bundle ~866 KB compiled, edge bundle ~290 KB compiled.

| #   | Suggestion                                                                      | Category    | Impact    | Effort | Status      |
| --- | ------------------------------------------------------------------------------- | ----------- | --------- | ------ | ----------- |
| B1  | Ensure `@prisma/client` and `@neondatabase/serverless` are strictly server-only | Bundle Size | 🔴 High   | 15 min | ❌ Not Done |
| B2  | Dynamic Import `AllocationChart` & `CurrencyExposureChart`                      | Bundle Size | 🔴 High   | 30 min | ✅ Done     |
| B3  | Inspect `date-fns` usage for tree-shaking                                       | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B4  | Audit `lucide-react` usage                                                      | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B5  | Monitor `recharts` library payload                                              | Bundle Size | 🟡 Medium | 45 min | ❌ Not Done |
| B6  | Lazy-load `sonner` Toaster                                                      | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B7  | Restrict `zod` to Server Actions/API routes                                     | Bundle Size | 🔴 High   | 1 hr   | ❌ Not Done |
| B8  | Opt-out `yahoo-finance2` from client bundle via `server-only`                   | Bundle Size | 🔴 High   | 15 min | ❌ Not Done |
| B9  | Evaluate `next-intl` dictionary loading per route                               | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B10 | Migrate `swr` fetching to RSCs (Server Components)                              | Bundle Size | 🟡 Medium | 1 hr   | ❌ Not Done |
| B11 | Lazy-load `cmdk` (Command Palette)                                              | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B12 | Audit `@base-ui/react` tree-shaking                                             | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B13 | Profile `tw-animate-css` payload                                                | Bundle Size | 🟢 Low    | 15 min | ❌ Not Done |
| B14 | Optimize Root Layout Font preloading                                            | Performance | 🟡 Medium | 15 min | ⚠️ Partial  |
| B15 | Defer Vercel Analytics/Speed Insights                                           | Performance | 🟢 Low    | 10 min | ❌ Not Done |

### B1 — Strict Server-Only Boundaries

**Observation.** Huge packages such as `@prisma/client` and other database-related dependencies (e.g., `@neondatabase/serverless` or authentication adapters) take up a massive amount of space when bundled. Wait for client payloads to include them inadvertently if they leak into `use client` components.

**Recommendation.** Use the `server-only` package to explicitly reject imports of `prisma` utilities from client components. Create a hard barrier to ensure these never slip into the `.next/analyze/client.html` bundle.

**Critical files:** `src/lib/prisma.ts`, missing `npm i server-only`

---

### B2 — Dynamic-import Sibling Dashboard Charts

**Observation.** While `TrendChart` is dynamically imported in `src/components/dashboard/lazy-charts.tsx`, the `AllocationChart` and `CurrencyExposureChart` widgets might be eagerly loaded into the initial dashboard payload. This drags down FCP / LCP for the dashboard.

**Recommendation.** Convert static imports to `next/dynamic` ones with suspense fallbacks, avoiding loading `recharts` overhead before it's needed or while off-screen.

**Critical files:** `src/components/dashboard/dashboard-content.tsx`, `src/components/dashboard/lazy-charts.tsx`

---

### B3 — Inspect `date-fns` Usage

**Observation.** Currently `date-fns` is optimized via `optimizePackageImports` in `next.config.ts`, but it's important to verify inside the analyzer HTML trace whether it's compiling precisely only the utilized functions (`format`, `subDays`, etc.) and not bundling unused locales.

**Recommendation.** Review all date manipulations. Next.js 16 should resolve this out of the box with `optimizePackageImports`, but verifying the emitted node limits is recommended. Replace with lighter alternatives like `Intl.DateTimeFormat` natively if the load remains significant.

**Critical files:** Files under `src/components/**` importing `date-fns`.

---

### B4 — Audit `lucide-react` Usage

**Observation.** Like `date-fns` and `recharts`, `lucide-react` is placed in `next.config.ts`'s experimental `optimizePackageImports`. The bundle analyzer can verify if only the specific SVG icons used are injected into the client bundle payload instead of the full library index.

**Recommendation.** Double check the `.next/analyze/client.html` bundle tree visually to confirm `lucide-react` leaf nodes are the only things being compiled into the Webpack chunks.

**Critical files:** `next.config.ts`

---

### B5 — Recharts Payload Overhead

**Observation.** Recharts generally adds a large (~120-150KB) chunk size to whatever client-side boundary involves it. By making it dynamically imported (B2), this chunk should sit separately. However, its presence still affects TTI (Time to Interactive).

**Recommendation.** Verify whether the charts are strictly necessary on mobile breakpoints or if they can be conditionally loaded/rendered based on viewport.

**Critical files:** `src/components/dashboard/lazy-charts.tsx`

---

### B6 — Lazy-load `sonner` Toaster

**Observation.** Global toast libraries like `sonner` are often loaded at the root `<html />` layout level, pushing its bundle size unconditionally to all pages even if no toast is triggered on the initial load.

**Recommendation.** Use Next.js `next/dynamic` to dynamically import the `<Toaster />` component so it does not block the main thread and is only fetched when the client-side app eventually needs to use it.

**Critical files:** `src/app/layout.tsx`

---

### B7 — Restrict `zod` to Server boundaries

**Observation.** `zod` is a fantastic schema validation library, but its bundle size is around ~15KB (min+gzip). Having it ship to the client for form validations introduces noticeable overhead.

**Recommendation.** Shift all form validation and schema parsing to Next.js Server Actions using `zod`, completely dropping the library from the client-side chunk. If client validation is absolutely required to prevent network trips, consider evaluating leaner libraries (e.g. `valibot`).

**Critical files:** `src/components/**/holding-form.tsx` (and other forms), `package.json`

---

### B8 — Opt-out `yahoo-finance2` via `server-only`

**Observation.** Similar to the `@prisma/client` issue, `yahoo-finance2` handles financial requests heavily and has dependencies. It is meant to be Server-Only.

**Recommendation.** Verify that the `price-service.ts` or components leveraging `yahoo-finance2` are strictly marked with `'server-only'` to guarantee that no Next.js boundary leaks this entire SDK and its node-fetch fallbacks into the client chunk.

**Critical files:** `src/lib/services/price-service.ts`

---

### B9 — Evaluate `next-intl` dictionary loading

**Observation.** `next-intl` can bloat the client payload if the whole `en-US.json` or other active locales are loaded en-masse into the page props, regardless of how much text is actually needed by the rendered view.

**Recommendation.** Ensure the setup uses Server Components to parse and pass only the needed translation chunks to Client Components, rather than wrapping the entire app in `NextIntlClientProvider` with the complete JSON object loaded in the namespace.

**Critical files:** `src/app/layout.tsx`, `src/i18n/request.ts`

---

### B10 — Migrate `swr` to RSC

**Observation.** The `swr` library provides client-side data fetching but requires bundling the fetching logic, state management, and the `swr` engine itself.

**Recommendation.** Take advantage of Next.js 16 Server Components and `use cache`. Moving data-fetching from the client (`useSWR`) to a server `await fetch(...)` natively eliminates the client-side library chunk completely while providing faster TTFB and SEO tracking natively.

**Critical files:** Client components currently using SWR Hooks.

---

### B11 — Lazy-load `cmdk` (Command Palette)

**Observation.** Command menus (`cmdk`) are extremely useful but often include a significant chunk of logic and styles that are only needed when the user explicitly triggers the shortcut (e.g., `Cmd+K`).

**Recommendation.** Use a dynamic import for the Command Palette component. Only load the `cmdk` library when the user performs the trigger or hovers over a search UI element.

**Critical files:** Search or Shortcut handler components.

---

### B12 — Audit `@base-ui/react` Tree-shaking

**Observation.** The project uses `@base-ui/react` (the successor to Radix/headless UI). While it is designed to be tree-shakeable, certain patterns of exporting components in a shared `ui` folder can occasionally pull in more primitives than necessary.

**Recommendation.** Inspect the client bundle to ensure only the primitives actually used (Select, Dialog, Popover) appear in the output. If a single `index.ts` in a UI folder is re-exporting everything, it may defeat tree-shaking in some build configurations.

**Critical files:** `src/components/ui/*`

---

### B13 — Profile `tw-animate-css` Payload

**Observation.** Animation libraries can sometimes inject a large block of global CSS or JS-based animation logic.

**Recommendation.** Verify if `tw-animate-css` is strictly generating Tailwind utility classes at build time or if it's shipping a runtime animation engine. If it's the latter, evaluate if native Tailwind/CSS transitions are sufficient for the desired "rich aesthetics".

---

### B14 — Optimize Root Layout Font Preloading

**Observation.** Next.js Font optimization is present, but if the bundle analyzer shows the font files being fetched with high priority before the main JS chunks, it could compete for bandwidth during the critical FCP window.

**Recommendation.** Ensure Geist or other custom fonts are subsetted to only the characters needed for the initial render and that only the `400/700` weights are preloaded.

**Critical files:** `src/app/layout.tsx`

---

### B15 — Defer Vercel Analytics/Speed Insights

**Observation.** While tiny, these scripts still execute on every page load.

**Recommendation.** While the Vercel components handle this well, verify that they aren't executing before the main application logic becomes interactive. Using `next/script` with `strategy="afterInteractive"` or `lazyOnload` for non-critical telemetry can help clear the thread for the initial render.

**Critical files:** `src/app/layout.tsx`

---

## Rendering Strategy (SSG → PPR → ISR)

Findings sourced on **2026-04-21**. The correct Next.js 16 answer is to walk the rendering ladder SSG → PPR → ISR and only use ISR where the first two don't apply. Items here are additive to V17, V18, V20, V21, V26, V27 (in the Infrastructure section — not duplicates).

| #   | Suggestion                                                                                                     | Category              | Impact    | Effort | Status                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| S1  | `/login` → SSG (`force-static`)                                                                                | SSG · Public page     | 🟡 Medium | 10 min | 🚫 Blocked — `force-static` incompatible with `nextConfig.cacheComponents`; PPR shell serves as fallback     |
| S2  | `/privacy` → SSG (`force-static`)                                                                              | SSG · Public page     | 🟡 Medium | 10 min | 🚫 Blocked — same constraint as S1                                                                           |
| P1  | Verify build output classifies `/`, `/accounts`, `/accounts/[id]`, `/history`, `/analysis`, `/settings` as `◐` | PPR · Verification    | 🟡 Medium | 20 min | ✅ Done                                                                                                      |
| P2  | Move `/accounts` list reads into the cached `fetchUserAccountsWithHoldings` helper                             | PPR · Route coverage  | 🟡 Medium | 45 min | ✅ Done                                                                                                      |
| I1  | ISR on `GET /api/exchange-rates` (`revalidate` + `Cache-Control`)                                              | ISR · Route handler   | 🔴 High   | 15 min | 🚫 Blocked — route-segment `revalidate` conflicts with `nextConfig.cacheComponents`; `Cache-Control` shipped |
| I2  | ISR on `GET /api/search` (`revalidate` + `Cache-Control`)                                                      | ISR · Route handler   | 🔴 High   | 15 min | 🚫 Blocked — same constraint as I1; `Cache-Control` shipped                                                  |
| I3  | `fetch({ next: { revalidate, tags } })` on CoinGecko fallback                                                  | ISR · Upstream fetch  | 🟡 Medium | 15 min | ✅ Done (PR 4)                                                                                               |
| I4  | Route-segment `revalidate` backstop on PPR routes                                                              | ISR · Backstop        | 🟢 Low    | 15 min | 🚫 Blocked — route-segment `revalidate` is incompatible with `nextConfig.cacheComponents`                    |
| I5  | Document the `fetch({ next: { revalidate } })` pattern on upstream FX APIs                                     | ISR · Reference       | 🟢 Low    | 10 min | ✅ Done (PR 4)                                                                                               |
| X1  | Verify / trim `revalidateTag(tag, "max")` second argument                                                      | Prereq · Correctness  | 🔴 High   | 15 min | ✅ Done                                                                                                      |
| X2  | Add `revalidateTag("snapshots")` after cron snapshot creation                                                  | Prereq · Invalidation | 🔴 High   | 10 min | ✅ Done                                                                                                      |
| X3  | Commit the `next build` classification snippet to this doc                                                     | Verification          | 🟢 Low    | 10 min | ❌ Not Done                                                                                                  |

### The Rendering Ladder

For each surface, pick the highest rung that applies:

1. **SSG** — content has no per-user data and changes only on deploy. Mark the segment `export const dynamic = "force-static"` (+ `revalidate = false`). Infinite TTL. Served from the CDN; zero function invocations on repeat visits.
2. **PPR** — the page has a static shell plus user-specific islands. Move structural reads into a `"use cache"`-wrapped service helper with `cacheTag("x:${userId}")` and `cacheLife("minutes")`. Mutations call `revalidateTag`. With `cacheComponents: true` set in `next.config.ts`, build output flips from `ƒ (Dynamic)` to `◐ (Partial Prerender)`.
3. **ISR** — a route handler returns shared data that can safely be stale for a bounded window. Add `export const revalidate = N` or `fetch(url, { next: { revalidate: N, tags: [...] } })`; layer `Cache-Control: public, s-maxage=N, stale-while-revalidate=M` so Vercel's edge cache short-circuits the function call entirely.

Only fall back to the next rung when the current one can't apply.

### Detailed Write-ups (S/P/I/X items)

**S1 — `/login` → SSG.** `src/app/login/page.tsx` renders a Google OAuth button, i18n copy, and a `VERCEL_ENV === "preview"` conditional. No per-user data. Currently blocked by `force-static` incompatibility with `nextConfig.cacheComponents`. Now shows `◐` in PPR mode which is functionally equivalent.

**S2 — `/privacy` → SSG.** `src/app/privacy/page.tsx` is legal copy from `getTranslations("privacy")`. No Prisma, no session. Same constraint as S1; PPR shell serves as fallback.

**P1 — Verify PPR classification.** Run `npm run build` locally and paste the routes table below. After PR 3: `/`, `/_not-found`, `/accounts`, `/accounts/[id]`, `/analysis`, `/history`, `/login`, `/privacy`, `/settings` all show `◐ (Partial Prerender)`.

**P2 — Move `/accounts` list reads into cached helper.** Replaced inline `prisma.account.findMany(…)` with `fetchUserAccountsWithHoldings(userId)` (existing `"use cache"` helper from `net-worth-service.ts`) and added a symmetrical `getCachedPricesForSymbols` helper in `price-service.ts`. Critical files: `src/app/(main)/accounts/page.tsx`, `src/lib/services/net-worth-service.ts`, `src/lib/services/price-service.ts`.

**I1 — ISR on `/api/exchange-rates`.** Add `export const revalidate = 3600` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Blocked by `cacheComponents: true` constraint — `Cache-Control` header shipped as workaround. Cross-ref: V17.

**I2 — ISR on `/api/search`.** Key the cache on the query string via `revalidate: 86400`. Blocked by same constraint as I1. Cross-ref: V8.

**I3 — CoinGecko `fetch` revalidation.** Replace `cache: "no-store"` with `{ next: { revalidate: 60, tags: ["prices:crypto"] } }`. Call `revalidateTag("prices:crypto")` from the cron after the upsert loop. Critical files: `src/lib/services/price-service.ts`, `src/app/api/cron/snapshot/route.ts`.

**I4 — Route-segment `revalidate` backstop.** Belt-and-suspenders `export const revalidate = 900` on PPR routes. Blocked: `Route segment config "revalidate" is not compatible with nextConfig.cacheComponents`.

**I5 — Document `fetch` revalidation pattern.** Canonical pattern for upstream fetches: `fetch(url, { next: { revalidate: N, tags: [...] } })`. Reference: `src/lib/services/exchange-rate-service.ts:74-77`.

**X1 — Trim `revalidateTag(tag, "max")`.** In Next.js 16.2.2, the second argument is not a valid parameter. Dropped from `src/app/api/cron/snapshot/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`, `src/app/api/prices/refresh/route.ts`.

**X2 — Add `revalidateTag("snapshots")` after cron.** After snapshot `Promise.all`, add `revalidateTag("snapshots")` + per-user `revalidateTag(\`history:${user.id}\`)`. Critical files: `src/app/api/cron/snapshot/route.ts`.

**X3 — Commit build classification snippet.** Pending: paste `npm run build` route table here after S1–I4 land.

### Items Explicitly Excluded

- `generateStaticParams` for `/accounts/[id]` — per-user private data; PPR is correct.
- `generateStaticParams` for locales — cookie-based i18n, not `[locale]`-segmented.
- Edge runtime on `/api/exchange-rates` / `/api/search` — blocked by `cacheComponents: true`.
- Long-cache headers on `/public/*` — owned by V20 in Infrastructure section.

### Build Output Verification (PR 3 — 2026-04-21)

```
Route (app)
┌ ◐ /
├ ◐ /_not-found
├ ◐ /accounts
├ ◐ /accounts/[id]
├ ◐ /analysis
├ ƒ /api/accounts
├ ƒ /api/accounts/[id]
├ ƒ /api/accounts/[id]/cash-transactions
├ ƒ /api/accounts/[id]/holdings
├ ƒ /api/accounts/[id]/transactions
├ ƒ /api/accounts/[id]/transactions/[transactionId]
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/cron/snapshot
├ ƒ /api/exchange-rates
├ ƒ /api/exchange-rates/refresh
├ ƒ /api/prices/refresh
├ ƒ /api/search
├ ƒ /api/settings
├ ƒ /api/settings/data
├ ƒ /api/snapshots
├ ƒ /apple-icon
├ ◐ /history
├ ○ /icon.svg
├ ◐ /login
├ ◐ /privacy
└ ◐ /settings

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

**Note on S1/S2:** `/login` and `/privacy` show `◐` (not `○ Static`) because they are inside `LocaleProviders` (async, reads locale cookie). This is functionally equivalent.

---

## Enhancement Roadmap (PE1–PE19)

Status: proposed · Owner: chuntsai · Last updated: 2026-05-07

This plan continues from the Rendering Strategy items, VERCEL_ANALYSIS V1–V33 (in Infrastructure section), and RELEASE_READINESS R1–R26. New items use the **PE#** prefix. Items are sequenced by dependency, not raw impact: Phase 0 instrumentation lands first because every later phase needs measurement to validate.

**Evidence collected:**
- Build duration: 53s end-to-end (compile 27.5s + TS 10.5s + page gen 0.6s + deploy 12s) + cache upload 31s. Build cache 297 MB.
- **Zero runtime logs in production for the past 7 days at any level** — confirms a critical observability gap.
- `Detected .env file` warning on every Vercel build.
- Build region `iad1`, function pinned `sin1`, Neon DB `ap-southeast-1`.

### Phase 0 — Observability foundation (must land first)

Without this phase, every later impact claim is a guess. Vercel runtime logs have been empty for 7 days; Speed Insights has no budgets; there is no DB or upstream timing.

#### PE1 — Structured server logger
- **Problem:** 22 raw `console.{log,error,warn}` calls across `src/`; no severity, no correlation. Production runtime logs silent for 7 days.
- **Approach:** `src/lib/logger.ts` exporting `log = { info, warn, error, debug }` emitting one JSON line per call (`ts, level, msg, requestId, route, userId?, durationMs?, ...meta`). Replace the 22 raw call sites; add ESLint `no-console` rule outside `lib/logger.ts`.
- **Files:** `src/lib/logger.ts` (new), `src/app/api/**/route.ts`, `src/lib/services/*.ts`, `eslint.config.mjs`.
- **Effort:** S. **Impact:** unblocks all of Phase 1+; produces queryable JSON logs.
- **Validation:** `vercel logs --json | jq '.level'` returns counts.
- **Cross-refs:** closes R17, R18; supersedes V12.

#### PE2 — `instrumentation.ts` with DB + upstream timing
- **Problem:** no `src/instrumentation.ts`. Cannot answer "is Yahoo slow today" or "is `getCachedNetWorthSummary` cache-missing every render."
- **Approach:** `register()` wraps Prisma client with `$extends` middleware logging `{model, action, durationMs}` for queries >100ms. Add `withTiming(label, fn)` helper; wrap Yahoo and CoinGecko calls.
- **Files:** `src/instrumentation.ts` (new), `src/lib/prisma.ts`, `src/lib/services/price-service.ts`, `src/lib/services/exchange-rate-service.ts`.
- **Effort:** M. **Impact:** identifies real bottleneck; makes Phase 1 select-clause work evidence-driven.
- **Validation:** log search `durationMs > 200` returns a non-empty list of slow queries.

#### PE3 — Web Vitals budgets in code
- **Problem:** Speed Insights mounted but no budget enforcement; CWV regressions ship silently.
- **Approach:** extend `src/components/layout/speed-insights.tsx` to import `web-vitals` and POST exceedances (LCP > 2500ms, CLS > 0.1, INP > 200ms) to `/api/_metrics/vitals` → `logger.warn`.
- **Files:** `src/components/layout/speed-insights.tsx`, `src/app/api/_metrics/vitals/route.ts` (new), `docs/PERFORMANCE_BUDGETS.md` (new).
- **Effort:** S. **Impact:** any CWV regression now logs a structured warning.

#### PE4 — Bundle analyzer baseline + `npm run analyze`
- **Problem:** `next.config.ts` already wires `@next/bundle-analyzer`, but `package.json` has no `analyze` script. V22/V33 open.
- **Approach:** add `"analyze": "ANALYZE=true next build"` to `package.json`. Run once and commit `docs/bundle-baseline-2026-05.md`.
- **Files:** `package.json`, `docs/bundle-baseline-2026-05.md` (new), `.github/workflows/ci.yml`.
- **Effort:** S. **Impact:** every later Phase-1 dynamic-import claim is verifiable.
- **Cross-refs:** closes V22, V33.

---

### Phase 1 — Quick wins backed by evidence

#### PE5 — Cache `/api/exchange-rates` and `/api/search` upstream calls
- **Problem:** `src/app/api/exchange-rates/route.ts` does `prisma.exchangeRate.findMany()` on every miss; `/api/search/route.ts` calls Yahoo on every miss. V17/V20 open.
- **Approach:** wrap DB read in `unstable_cache` with `tags: ["exchange-rates"]`. For `/api/search`, wrap Yahoo call with `unstable_cache` keyed by normalized query string, `revalidate: 3600`, `tags: ["search"]`.
- **Files:** `src/app/api/exchange-rates/route.ts`, `src/app/api/search/route.ts`.
- **Effort:** S. **Impact:** TTFB on cached search ~40ms vs ~400ms (Yahoo round-trip). Reduces Yahoo QPS by ~10x.
- **Cross-refs:** closes V17, V20.

#### PE6 — Dynamic-import three heavy client islands
- **Problem:** `transaction-history.tsx` (528 LoC + Framer Motion + SWRInfinite), `holding-form.tsx` ship in `/accounts/[id]` initial bundle even though gated by tab/dialog clicks.
- **Approach:** `dynamic(() => import(...).then(m => m.TransactionHistory), { ssr: false, loading: () => <TransactionHistorySkeleton /> })` for `TransactionHistory` and `HoldingForm` in `account-detail.tsx`.
- **Files:** `src/components/accounts/account-detail.tsx`, `src/components/accounts/transaction-history.tsx`, `src/components/accounts/holding-form.tsx`.
- **Effort:** S. **Impact:** estimated `/accounts/[id]` initial JS −60 to −90 KB gz.

#### PE7 — Compress OG and Twitter card images
- **Problem:** `public/opengraph-image.png` and `public/twitter-image.png` are 567 KB each (~1.1 MB combined). Should be < 100 KB.
- **Approach:** re-export as WebP@80 or recompress as PNG via `pngquant --quality=70-85`.
- **Files:** `public/opengraph-image.png`, `public/twitter-image.png` (replace).
- **Effort:** S. **Impact:** −1 MB from public assets footprint.

#### PE8 — Resolve `.env` warning during Vercel build
- **Problem:** every Vercel build prints `Detected .env file, it is strongly recommended to use Vercel's env handling.`
- **Approach:** add `.vercelignore` with `.env\n.env.*\n!.env.example`.
- **Files:** `.vercelignore` (new).
- **Effort:** S. **Impact:** removes warning + defensive against shipping secrets.

#### PE9 — Stable currency/number formatters
- **Problem:** `src/lib/currencies.ts:37` and `:51` create a new `Intl.NumberFormat` on every call. Called from Recharts tooltips that re-render on hover.
- **Approach:** memoise per-(currency, compact, decimals) tuple inside `currencies.ts`.
- **Files:** `src/lib/currencies.ts`, `src/components/accounts/quick-add-holding.tsx`, `src/components/accounts/holding-form.tsx`, `src/components/accounts/option-builder.tsx`, `src/components/accounts/account-form.tsx`, `src/components/accounts/inline-balance-editor.tsx`.
- **Effort:** S. **Impact:** each chart hover re-render saves ~5 `Intl.NumberFormat` constructions; INP on `/analysis`.
- **Cross-refs:** closes S#91.

#### PE10 — Tighten settings-service cache scope
- **Problem:** `src/lib/services/settings-service.ts:17` uses conservative `cacheLife("minutes")` for a setting that only changes via explicit POST.
- **Approach:** change to `cacheLife("hours")`. Move the create fallback to a dedicated server action `ensureSettings(userId)` that runs once at signup time.
- **Files:** `src/lib/services/settings-service.ts`, `src/auth.ts`.
- **Effort:** S. **Impact:** removes 1 DB round-trip per render for new users; lengthens cache-hit window.

---

### Phase 2 — Structural

These need PE2 timing data to prioritise within the phase.

#### PE11 — `revalidateTag` audit
- **Problem:** POST `/api/accounts/[id]/transactions` does not call `revalidateTag(\`net-worth:${userId}\`)`. V21 open.
- **Approach:** build `docs/CACHE_INVALIDATION_MATRIX.md`. Patch all missing tag calls on transaction and cash-transaction routes.
- **Files:** `src/app/api/accounts/[id]/transactions/route.ts`, `.../[transactionId]/route.ts`, `.../cash-transactions/route.ts`, `docs/CACHE_INVALIDATION_MATRIX.md` (new).
- **Effort:** M. **Impact:** correctness — unblocks more aggressive cache TTLs.
- **Cross-refs:** closes V21.

#### PE12 — Add `select` clauses to over-fetching reads
- **Problem:** `net-worth-service.ts:24` (`include: { holdings }` returns every column), `:47` (`priceCache.findMany` returns full row), and cash-transaction read in `history-service.ts:249`.
- **Approach:** explicit `select` clauses returning only consumed fields.
- **Files:** `src/lib/services/net-worth-service.ts`, `src/lib/services/history-service.ts`, `src/app/(main)/accounts/[id]/page.tsx`.
- **Effort:** M. **Impact:** wire-bytes from Neon −30–60% for the dashboard query.

#### PE13 — Cursor pagination for transactions
- **Problem:** `src/app/api/accounts/[id]/transactions/route.ts:23` uses `OFFSET`. Postgres scans rows up to the offset, so page 50 is 50× slower than page 1. S#106 open.
- **Approach:** replace `page/limit` with `cursor` (opaque base64 of `{createdAt, id}`); raw SQL `WHERE (createdAt, id) < (cursor.createdAt, cursor.id)`.
- **Files:** route handler + `transaction-history.tsx`.
- **Effort:** M. **Impact:** O(1) page latency. Page-50 load drops from ~600 ms to ~50 ms.
- **Cross-refs:** closes S#106.

#### PE14 — Dedupe `/accounts/[id]` reads with the dashboard cache
- **Problem:** `src/app/(main)/accounts/[id]/page.tsx:21` does its own `prisma.account.findUnique`, bypassing the cached `fetchUserAccountsWithHoldings(userId)`. V16 open.
- **Approach:** refactor `AccountDetailContent` to call `fetchUserAccountsWithHoldings(session.user.id)` and `.find(a => a.id === id)`.
- **Files:** `src/app/(main)/accounts/[id]/page.tsx`, `src/lib/services/price-service.ts`, `src/lib/services/net-worth-service.ts`.
- **Effort:** M. **Impact:** account-detail TTFB on warm cache drops from ~250 ms to ~10 ms.
- **Cross-refs:** closes V16.

#### PE15 — Mobile CWV verification pass
- **Problem:** recently shipped iOS bottom-sheet modals, swipe-to-edit gestures, and pull-to-refresh have no measured CWV impact. V23 chart-card height reservation also open.
- **Approach:** Add Playwright iPhone-15 viewport project. Reserve heights on chart cards. Audit `mobile-header.tsx` and `pull-to-refresh.tsx` for layout shifts.
- **Files:** `playwright.config.ts`, `src/components/dashboard/lazy-charts.tsx`, `src/components/layout/mobile-header.tsx`, `src/components/layout/pull-to-refresh.tsx`.
- **Effort:** M. **Impact:** mobile CLS target < 0.05; INP < 200 ms on swipe.
- **Cross-refs:** closes V23.

---

### Phase 3 — Stretch / nice-to-have

#### PE16 — Build cache audit (297 MB → target < 150 MB)
- **Problem:** `cache upload 31s` of the 53s build. V15 open. Likely culprits: `.next/cache/webpack/`, `node_modules/.prisma/`, Playwright browsers.
- **Effort:** L (investigative). **Impact:** −5–10 s deploy time.

#### PE17 — ISR for `/privacy` and `/terms`
- **Problem:** static legal pages currently render on every request.
- **Approach:** `export const revalidate = 86400` in both pages.
- **Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`.
- **Effort:** S. **Impact:** TTFB ~5 ms on warm cache.

#### PE18 — Edge-runtime evaluation for `/api/search` and `/api/exchange-rates`
- **Problem:** both routes are pure-read after PE5 caching lands. Blocked by `cacheComponents: true` constraint.
- **Effort:** L (uncertain payoff). **Impact:** 50–150 ms TTFB win for non-AP users.

#### PE19 — Migrate-region note (informational, no code change)
- **Problem:** build runs in `iad1` but `prisma migrate deploy` connects to Neon in `ap-southeast-1` — cross-region round-trip on every migration.
- **Approach:** document the trade-off in `docs/DEPLOYMENT_NOTES.md`.
- **Effort:** S (doc only).

---

## Verification

After Phase 0 lands, every later item is verified the same way:

1. **Speed Insights** — track LCP, CLS, INP per route weekly. Trend lines should not regress.
2. **Bundle baseline diff** — `npm run analyze` before and after each Phase 1/2 PR.
3. **Vercel runtime log queries** (after PE1–PE2):
   - Slow queries: `level:warn AND durationMs:>200`
   - Cache misses: `msg:"cache miss" AND tag:"net-worth"`
   - Upstream failures: `msg:/yahoo|coingecko/ AND level:error`
4. **Playwright CWV project** (PE15) — run on PRs touching `src/components/**`; fail if mobile LCP > 2500 ms or CLS > 0.05.
5. **Build duration** — target < 45 s end-to-end after PE16.

A single PR for Phase 0 must ship before any other PE# is merged.

## Critical Files (PE plan)

- `src/lib/logger.ts` (new — PE1)
- `src/instrumentation.ts` (new — PE2)
- `src/lib/prisma.ts` (PE2)
- `src/lib/services/price-service.ts` (PE2, PE14)
- `src/lib/services/exchange-rate-service.ts` (PE2)
- `src/lib/services/settings-service.ts` (PE10)
- `src/lib/services/net-worth-service.ts` (PE12, PE14)
- `src/lib/services/history-service.ts` (PE12)
- `src/lib/currencies.ts` (PE9)
- `src/app/api/exchange-rates/route.ts` (PE5)
- `src/app/api/search/route.ts` (PE5)
- `src/app/(main)/accounts/[id]/page.tsx` (PE12, PE14)
- `src/components/accounts/account-detail.tsx` (PE6)
- `src/components/accounts/transaction-history.tsx` (PE6, PE13)
- `package.json` (PE4)
- `.vercelignore` (new — PE8)
