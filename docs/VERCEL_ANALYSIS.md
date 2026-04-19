# Asset Tracker — Vercel Deploy Analysis

## Overview

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| V1 | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16 convention) | Deprecation | 🟢 Low | 10 min | ❌ Not Done |
| V2 | Remove duplicate `prisma generate` (postinstall + build) | Build Perf | 🟢 Low | 5 min | ✅ Done |
| V3 | Upgrade `prisma` + `@prisma/client` 7.6.0 → 7.7.0 | Maintenance | 🟢 Low | 10 min | ❌ Not Done |
| V4 | Set `maxDuration: 60` for `/api/cron/snapshot` in `vercel.json` | Reliability | 🔴 High | 10 min | ✅ Done |
| V5 | Pin `regions` in `vercel.json` to match Neon region (`sin1`) | Performance | 🟡 Medium | 15 min | ✅ Done |
| V6 | Hover/viewport prefetch in sidebar (replace eager all-routes prefetch) | Performance | 🟡 Medium | 30 min | ✅ Done |
| V7 | Suppress yahoo-finance2 consent notices in `price-service.ts` | Observability | 🟢 Low | 15 min | ❌ Not Done |
| V8 | Evaluate edge runtime for `/api/search` + `/api/exchange-rates` | Performance | 🟡 Medium | 1-2 hrs | ⚠️ Blocked (see notes) |
| V9 | Verify `@vercel/speed-insights` + `@vercel/analytics` are mounted | Observability | 🟢 Low | 15 min | ✅ Done |
| V10 | Add `/api/health` endpoint | Observability | 🟡 Medium | 30 min | ❌ Not Done |
| V11 | Verify Vercel Cron `/api/cron/snapshot` is firing daily | Reliability | 🔴 High | 15 min | ❌ Not Done |
| V12 | Structured error logging in `price-service.ts` | Observability | 🟡 Medium | 1 hr | ❌ Not Done |
| V13 | Add baseline security headers (HSTS, X-CTO, XFO, Referrer-Policy, Permissions-Policy) | Security | 🔴 High | 1 hr | ❌ Not Done |
| V14 | Add CSP (Report-Only first, then enforce) | Security | 🔴 High | 2-3 hrs | ❌ Not Done |
| V15 | Audit & shrink `.next/cache` (currently 292 MB) | Build Perf | 🟢 Low | 1 hr | ❌ Not Done |
| V16 | React `cache()` wrap for `/accounts/[id]` reads + audit `<Link prefetch>` to stop 5–8× burst | Performance | 🔴 High | 45 min | ❌ Not Done |
| V17 | `Cache-Control` + `"use cache"` / `cacheTag("exchange-rates")` on `/api/exchange-rates` | Performance | 🟡 Medium | 20 min | ❌ Not Done |
| V18 | Opt `/analysis` and `/history` into PPR with `"use cache"` + `cacheTag` | Performance | 🟡 Medium | 1 hr | ❌ Not Done |
| V19 | Dynamic-import `AllocationChart` + `CurrencyExposureChart` like `TrendChart` | Bundle | 🟡 Medium | 30 min | ❌ Not Done |
| V20 | `Cache-Control: public, max-age=31536000, immutable` for `/public/*` | Performance | 🟢 Low | 15 min | ❌ Not Done |
| V21 | Audit `revalidateTag` after `POST /accounts`, `/holdings`, `/transactions` | Performance | 🟡 Medium | 1–2 hrs | ❌ Not Done |
| V22 | Add `@next/bundle-analyzer` + baseline dashboard RSC payload | Observability | 🟢 Low | 30 min | ❌ Not Done |
| V23 | Reserve `min-h` / `aspect-ratio` on chart cards (CLS fix) | Speed Insights · CLS | 🔴 High | 30 min | ✅ Done |
| V24 | Preload Geist Sans `.woff2` + `content-visibility: auto` on below-fold cards | Speed Insights · LCP/FCP | 🟡 Medium | 45 min | ✅ Done |
| V25 | `startTransition` + memoize privacy/theme-toggle consumers | Speed Insights · INP | 🟡 Medium | 1 hr | ✅ Done |
| V26 | Extend V18's PPR pattern to `/settings` and `/` (per-user cache key) | Speed Insights · TTFB | 🟡 Medium | 1–2 hrs | ✅ Done |
| V27 | Convert `/`, `/accounts`, `/analysis`, `/history`, `/settings` from `ƒ` → `◐` by adding the Next.js 16 `"use cache"` directive to service-layer reads (executes what V18+V26 proposed but didn't land in the route classifier) | Speed Insights · TTFB | 🔴 High | 1–2 hrs | ✅ Done |
| V28 | `<link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin="anonymous">` for Analytics + Speed Insights | Speed Insights · LCP/FCP | 🟢 Low | 5 min | ✅ Done |
| V29 | Re-enable SSR for `AllocationChart` + `CurrencyExposureChart` (drop `ssr: false`) so the chart card shell + localized title ship in server HTML instead of waiting for hydration | Speed Insights · LCP | 🟡 Medium | 30 min | ✅ Done |
| V30 | Wrap `router.refresh()` + inline-edit state setters in `startTransition` across `transaction-history.tsx`, `edit-holding-dialog.tsx`, `quick-add-holding.tsx`, `holding-form.tsx` (extend V25 beyond privacy/theme toggles) | Speed Insights · INP | 🟡 Medium | 45 min | ✅ Done |
| V31 | Add `next.config.ts` `images.formats = ["image/avif", "image/webp"]` + `remotePatterns` for `lh3.googleusercontent.com` so any avatar render is optimized | Speed Insights · LCP | 🟢 Low | 15 min | ✅ Done |
| V32 | Configure `<SpeedInsights beforeSend={…}>` to drop `/login` + `/privacy` from telemetry (score quality + cost) | Observability | 🟢 Low | 15 min | ✅ Done |
| V33 | Ship `@next/bundle-analyzer` (supersedes V22) — prerequisite for measuring any further client-JS Speed Insights wins | Observability | 🟢 Low | 30 min | ❌ Not Done |

## Methodology

Findings sourced from the Vercel MCP connector against project
`prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team
`team_ImEsp9hzYaqzaPz5VmE6LTiW`) on **2026-04-17**:

- `list_deployments` — last 20 deployments across `master` + preview branches
- `get_deployment_build_logs` on latest production deployment
  `dpl_3KqPj4qBr3ZojdDaSxtKvo8iNhC2` (commit `089bdb6`)
- `get_runtime_logs` — production environment, 7-day window, filtered by
  level, HTTP status, and keyword queries (`api`, `cron`, `snapshot`,
  `Please consider`)

No error-level or 5xx logs were found in the sampled window — the app is
healthy. The suggestions below target deprecations, redundant work, log
hygiene, and platform-configuration gaps.

## Findings

### Build-log observations

Deployment `dpl_3KqPj4qBr3ZojdDaSxtKvo8iNhC2` (44s total, 292 MB build cache):

1. **Deprecated middleware convention.** Next.js 16.2.2 emits:
   `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
   The repo still has `src/middleware.ts`.
2. **Prisma minor out of date.** Every build prints a 7.6.0 → 7.7.0 upgrade
   banner.
3. **Duplicate `prisma generate`.** Runs once via the `postinstall` npm
   script, then again via Vercel's build command
   `npx prisma generate && next build`. Each run is ~200ms (~400ms total
   wasted per build).
4. **Only 1 worker for page-data collection and static generation** (21
   pages). Runs on a 2-core builder — under-utilized.
5. **Large build cache (292 MB).** Upload takes ~4s; `.next/cache` likely
   contains Turbopack incremental artifacts that don't need to survive
   across deploys.

### Runtime-log observations (production, 7d)

1. **Zero error/fatal/5xx/404 logs** in the sampled window.
2. **Sidebar prefetch storm.** On every navigation (and after
   `POST /settings`), the sidebar fires RSC prefetches to `/`, `/accounts`,
   `/analysis`, `/history`, `/settings` — each with 3–5 duplicate hits in
   the same second. This appears to be unbounded eager prefetch (from
   `SUGGESTIONS.md` #127) running on every mount.
3. **Account detail fired 3× per navigation.** `/accounts/[id]` hit three
   times for the same ID within one second. Likely RSC payload + prefetch +
   initial render — worth profiling to confirm no redundant in-page fetch.
4. **Yahoo Finance consent notice** leaks into logs on every
   `POST /api/prices/refresh`:
   `Please consider completing…` — emitted by `yahoo-finance2` hitting the
   EU consent interstitial. Noise in production logs.
5. **No `/api/cron/snapshot` hits in log window.** Either the Vercel Cron
   (scheduled `30 21 * * *` UTC in `vercel.json`) isn't firing, runtime logs
   filter it, or runs land outside the sampled window. Worth confirming in
   the Vercel dashboard → Cron Jobs tab.
6. **No `/api/health` endpoint exists** (confirmed via
   `ls src/app/api/`). Aligns with `SUGGESTIONS.md` #119 still being open.

### Platform/config observations

- `next.config.ts` sets only `X-DNS-Prefetch-Control`. Missing HSTS, CSP,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Content-Type-Options`.
- `vercel.json` contains only the cron entry — no per-function
  `maxDuration`, no `regions` pin. Default Hobby timeout (10s) may clip the
  snapshot job as data grows.
- `@vercel/analytics` and `@vercel/speed-insights` are in `package.json` —
  mount points in `src/app/layout.tsx` need verification.

## Detailed Enhancement Write-ups

### V1 — Rename `src/middleware.ts` → `src/proxy.ts`

**Observation.** Next.js 16.2.2 deprecation warning on every build.

**Recommendation.** Rename the file to `src/proxy.ts`. The file convention
is registered by filename — no import or config changes needed elsewhere.
Keep the existing `auth.config.ts` import and matcher config intact.

**Critical files.** `src/middleware.ts`

---

### V2 — Remove duplicate `prisma generate`

**Observation.** `package.json` runs `prisma generate` in `postinstall`,
AND Vercel's detected build command also runs `npx prisma generate && next build`.

**Recommendation.** Keep `postinstall` (so `npm install` locally also
regenerates), and remove the `npx prisma generate &&` prefix from the
Vercel build command — or vice versa. Either direction saves ~200ms +
output noise per build.

**Critical files.** `package.json`, Vercel project → Build & Development
Settings.

---

### V3 — Upgrade Prisma 7.6.0 → 7.7.0

**Observation.** Every build prints the upgrade banner for `prisma` and
`@prisma/client`.

**Recommendation.** `npm i -D prisma@7.7.0 && npm i @prisma/client@7.7.0`.
Verify `@prisma/adapter-neon` and `@prisma/adapter-pg` stay compatible
(both are currently `^7.6.0`). Run `npx prisma generate` and a build locally.

**Critical files.** `package.json`, `package-lock.json`

---

### V4 — Set `maxDuration: 60` for cron snapshot

**Observation.** `/api/cron/snapshot` refreshes all prices + writes a
`NetWorthSnapshot` row for every user. On Hobby tier functions default to
10s, which may truncate as data grows. On Pro the default is 60s.

**Recommendation.** Add explicit per-function config to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/snapshot", "schedule": "30 21 * * *" }],
  "functions": {
    "src/app/api/cron/snapshot/route.ts": { "maxDuration": 60 }
  }
}
```

**Critical files.** `vercel.json`

---

### V5 — Pin `regions` in `vercel.json` to the Neon region

**Observation.** Build log shows `Running build in Washington, D.C., USA
(East) – iad1`, but functions may route elsewhere without a pin — every
hop between serverless function and Neon costs ~10–80ms per query.

**Recommendation.** Check Neon project region in the Neon console; add
matching `regions` to `vercel.json`, e.g.:

```json
{ "regions": ["iad1"] }
```

If Neon is in `us-west`, set `sfo1` instead.

**Critical files.** `vercel.json`

---

### V6 — Hover/viewport prefetch in sidebar

**Observation.** Runtime logs show 5 sidebar routes prefetching 3–5× per
page load. The current implementation (from SUGGESTIONS #127) prefetches
all links on mount, which multiplies per Suspense-boundary re-render.

**Recommendation.** Change `<Link prefetch>` to `prefetch={false}` and call
`router.prefetch(href)` in `onMouseEnter` / `onFocus` / `IntersectionObserver`
handlers. Keeps the UX benefit (near-instant navigation) without flooding
prefetches on every render.

**Critical files.** `src/components/layout/sidebar.tsx`

---

### V7 — Suppress yahoo-finance2 consent notices

**Observation.** `Please consider completing the EU consent form…` logged
on every `/api/prices/refresh`. The yahoo-finance2 library exposes a
`suppressNotices` API for this.

**Recommendation.** In the price-service module, add near the top:

```ts
import yahooFinance from "yahoo-finance2";

yahooFinance.suppressNotices(["yahooSurvey", "ripHistorical"]);
```

If the notice persists, also set
`yahooFinance.setGlobalConfig({ validation: { logErrors: false } })` or
configure a custom cookie jar.

**Critical files.** `src/lib/services/price-service.ts`

---

### V8 — Evaluate edge runtime for read-only APIs

**Observation.** `/api/search` and `/api/exchange-rates` are read-heavy,
low-CPU, and hit Neon (which supports HTTP driver on edge).

**Recommendation.** Add `export const runtime = "edge"` to each route and
benchmark cold-start + p50/p95 latency vs. Node runtime. Only promote if
edge wins; otherwise document the benchmark. Edge compatibility requires
`@neondatabase/serverless` (already installed) and no Node-only APIs in
the import graph.

**Critical files.** `src/app/api/search/route.ts`,
`src/app/api/exchange-rates/route.ts`

**Evaluation outcome (2026-04-18): blocked by Cache Components.** Adding
`export const runtime = "edge"` to either route fails the Turbopack
build with:

> Route segment config "runtime" is not compatible with
> `nextConfig.cacheComponents`. Please remove it.

This is a documented Next.js 16 constraint. Per
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md:23`:

> Using `runtime: 'edge'` is **not supported** for Cache Components.

`next.config.ts` sets `cacheComponents: true` (the umbrella flag that
replaces `ppr` + `useCache` + `dynamicIO` in Next.js 16). Disabling it
to unlock edge on two read-only routes would give up PPR and the
`use cache` directive app-wide — a bad trade.

Additional blockers below the framework constraint (for reference if
this is revisited after `cacheComponents` evolves):

- `/api/exchange-rates` imports `@/lib/prisma`, which constructs
  `PrismaNeon` with `ws` (Node-only) at `src/lib/prisma.ts:1-7`. An
  edge variant would need `@neondatabase/serverless` HTTP driver and
  raw SQL (or a separate edge-only Prisma client).
- `/api/search` uses `yahoo-finance2`, which is Node-only. An edge
  variant would need a direct `fetch` to
  `https://query1.finance.yahoo.com/v1/finance/search` and would lose
  the library's consent/header/cookie handling.

**Recommendation.** Leave both routes on the Node runtime. Re-evaluate
when either Next.js relaxes the Cache Components + edge restriction, or
when the team decides to trade PPR / `use cache` for edge latency. No
code change lands from this evaluation.

---

### V9 — Verify `@vercel/speed-insights` + `@vercel/analytics` mounts

**Observation.** Both packages are in `dependencies`, but mount points
were not verified.

**Recommendation.** Open `src/app/layout.tsx` and confirm:

```tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// …inside <body>
<Analytics />
<SpeedInsights />
```

If missing, add them. If present, leave alone.

**Critical files.** `src/app/layout.tsx`

---

### V10 — Add `/api/health` endpoint

**Observation.** `SUGGESTIONS.md` #119 is open. No liveness endpoint
exists.

**Recommendation.** Create `src/app/api/health/route.ts` returning:

```ts
export const runtime = "nodejs";
export async function GET() {
  const [db] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
  ]);
  return Response.json(
    {
      ok: db.status === "fulfilled",
      db: db.status,
      time: new Date().toISOString(),
    },
    { status: db.status === "fulfilled" ? 200 : 503 }
  );
}
```

Hook it into Vercel Monitoring uptime checks.

**Critical files.** `src/app/api/health/route.ts` (new)

---

### V11 — Verify Vercel Cron is firing

**Observation.** No `/api/cron/snapshot` hits in the sampled runtime logs.

**Recommendation.** In the Vercel dashboard → Project → Settings → Cron
Jobs, confirm the last execution timestamp. If empty:

1. Verify `CRON_SECRET` env var is set in Production.
2. Check the handler returns 200 in `get_runtime_logs` filtered by path
   `/api/cron/snapshot`.
3. Trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET"
   https://asset-tracker-ct.vercel.app/api/cron/snapshot`.

**Critical files.** `src/app/api/cron/snapshot/route.ts` (no code change
expected; verification only)

---

### V12 — Structured error logging in price-service

**Observation.** Runtime logs for `/api/prices/refresh` are opaque —
failures don't surface symbol, provider, or userId context.

**Recommendation.** Wrap fetches with explicit logging:

```ts
try {
  const quote = await yahooFinance.quote(symbol);
} catch (err) {
  console.error(JSON.stringify({
    scope: "price-service",
    provider: "yahoo",
    symbol,
    userId,
    error: err instanceof Error ? err.message : String(err),
  }));
  throw err;
}
```

Makes `get_runtime_logs --query symbol=AAPL` actually useful. Overlaps with
SUGGESTIONS #55 (Pino) — adopt whichever lands first.

**Critical files.** `src/lib/services/price-service.ts`

---

### V13 — Add baseline security headers

**Observation.** `next.config.ts` `headers()` sets only
`X-DNS-Prefetch-Control`.

**Recommendation.** Extend to:

```ts
headers: async () => [
  {
    source: "/:path*",
    headers: [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()" },
    ],
  },
],
```

Verify with `curl -I https://asset-tracker-ct.vercel.app/`. Overlaps
`SUGGESTIONS.md` #109 — this is the deploy-level slice of the same work.

**Critical files.** `next.config.ts`

---

### V14 — Add Content-Security-Policy

**Observation.** No CSP header. App loads Google OAuth, Vercel Analytics,
Speed Insights, and fonts from Google — a well-scoped CSP is feasible.

**Recommendation.** Start with `Content-Security-Policy-Report-Only` for
one week to gather violation reports, then promote to enforcement. Build
a nonce-per-request using a proxy (`src/proxy.ts`, post-V1) or use the
Next.js 16 nonce helper. Baseline policy:

```
default-src 'self';
script-src 'self' 'nonce-<NONCE>' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://lh3.googleusercontent.com;
font-src 'self' data:;
connect-src 'self' https://*.neon.tech https://va.vercel-scripts.com;
frame-ancestors 'none';
```

**Critical files.** `next.config.ts` or `src/proxy.ts`

---

### V15 — Audit & shrink `.next/cache`

**Observation.** Build cache is 292 MB; upload cost is ~4s per deploy.

**Recommendation.** Locally run `npm run build` then inspect
`du -sh .next/cache/*`. Candidates for exclusion via Vercel project
settings or `.vercelignore` within the cache:

- `.next/cache/swc` (may not need preservation)
- `.next/cache/webpack` (not used under Turbopack)
- Turbopack-specific caches that don't survive schema/config drift cleanly

If a subdirectory is not providing measurable speedup, exclude it from
the build cache.

**Critical files.** `.vercelignore` (possibly new), Vercel project settings

---

## Addendum — 2026-04-18 Re-Pull

A second read of the Vercel MCP connector against deployment
`dpl_DWV5d3wfpoSZajQy6zyHNjhUyHFz` (commit `6c73a35`, 2026-04-17)
surfaced new signals that the 2026-04-17 pass did not catch. Items
**V16–V26** below are sourced from this second pass and from a direct
request to propose Speed-Insights-score-focused changes.

Key new observations:

1. **The prefetch storm is still present post-V6.** Runtime logs
   (7-day window ending 2026-04-18 14:17) show `/accounts/[id]` firing
   **5–8 times within the same second** for the same id (e.g.
   `cmnk06j7300030al1829iwqi6` at 14:15:28 → 5 hits, 14:15:29 → 2
   hits). V6 fixed the sidebar trigger but the accounts-list `<Link>`
   and RSC renderer still multiply the hit count.
2. **`/history`, `/settings`, `/analysis` fire 4× per second** right
   after settings clicks. Residual fan-out from unbatched RSC
   prefetches.
3. **Only one route is PPR.** Build output shows `/accounts/[id]` as
   `◐ (Partial Prerender)`; `/`, `/analysis`, `/history`, `/settings`
   are all `ƒ (Dynamic)`. `cacheComponents: true` is set but no other
   route opts into `"use cache"` — the framework's headline win is
   mostly unused.
4. **`/api/exchange-rates` ships zero cache headers** and has no
   `"use cache"` directive (`src/app/api/exchange-rates/route.ts:4`).
   Every client fetch round-trips to Neon.
5. **Static-asset caching relies entirely on Vercel defaults.**
   `next.config.ts` only sets `X-DNS-Prefetch-Control`; `/public/*`
   (favicon, icons, apple-touch) has no `immutable` cache directive.
6. **Dashboard ships all three recharts bundles eagerly.** Only
   `TrendChart` is dynamic-imported; `AllocationChart` and
   `CurrencyExposureChart` are not.

The Speed-Insights-specific items (V23–V26) each map to one Web Vital
and are grouped so the team can pick the metric they most want to
move.

## Detailed Enhancement Write-ups — V16 onward

### V16 — Dedupe `/accounts/[id]` reads with React `cache()` and tighten link prefetch

**Observation.** Runtime logs show 5–8 hits per second for the same
account id. `src/app/(main)/accounts/[id]/page.tsx:21` calls
`prisma.account.findUnique` without wrapping in React `cache()`; when
the RSC renderer re-enters `AccountDetailContent` after each `await`,
or when the accounts-list prefetches the detail `<Link>`, each pass
re-hits Neon. The repo already uses this idiom elsewhere (commit
`dc593ee7` "perf: deduplicate recentSnapshots query via React
cache()").

**Recommendation.** (1) Factor the lookup into
`src/lib/services/account-service.ts`:

```ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getAccountWithHoldings = cache(async (id: string) =>
  prisma.account.findUnique({
    where: { id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
  }),
);
```

(2) Call that from the page. (3) Audit
`src/components/accounts/accounts-list.tsx` — if each row renders
`<Link href={...} prefetch={true}>` on hover, drop to
`prefetch={false}` + `router.prefetch` on first-intent (mirrors V6).

**Critical files.** `src/app/(main)/accounts/[id]/page.tsx`,
`src/lib/services/account-service.ts` (new), `src/components/accounts/accounts-list.tsx`.

---

### V17 — Cache `/api/exchange-rates`

**Observation.** `src/app/api/exchange-rates/route.ts:4-6` returns
`findMany()` with no `Cache-Control`, no `revalidate`, no
`"use cache"`. Exchange rates update daily at cron time — client
requests should be served from the CDN.

**Recommendation.** Either (a) add a response header:

```ts
return NextResponse.json(rates, {
  headers: {
    "Cache-Control":
      "public, s-maxage=3600, stale-while-revalidate=86400",
  },
});
```

or (b) adopt the Next 16 cache directive:

```ts
"use cache";
import { cacheTag, cacheLife } from "next/cache";

export async function GET() {
  cacheTag("exchange-rates");
  cacheLife("hours");
  const rates = await prisma.exchangeRate.findMany();
  return ok(rates);
}
```

Then call `revalidateTag("exchange-rates")` inside
`POST /api/exchange-rates/refresh` and the cron snapshot job so the
edge cache invalidates on refresh.

**Critical files.** `src/app/api/exchange-rates/route.ts`,
`src/app/api/exchange-rates/refresh/route.ts`,
`src/app/api/cron/snapshot/route.ts`.

---

### V18 — Opt `/analysis` and `/history` into PPR

**Observation.** Build output lists both routes as `ƒ (Dynamic)`.
`src/app/(main)/analysis/page.tsx` and
`src/app/(main)/history/page.tsx` await services but use no
`"use cache"` directive — `cacheComponents: true` is wasted on them.

**Recommendation.** Move each route's data-fetching helper into a
cached server function:

```ts
// src/lib/services/history-service.ts
"use cache";
import { cacheTag, cacheLife } from "next/cache";

export async function getNormalizedHistory(userId: string, days = 90) {
  cacheTag(`history:${userId}`);
  cacheLife("minutes");
  // …existing logic
}
```

Trigger `revalidateTag("history:" + userId)` in the mutation handlers
(snapshot writes, account create/update) so caches stay correct.
The page's dynamic islands (user-specific chrome) remain dynamic;
the rest moves to the CDN. Expected build-output change: both routes
flip from `ƒ` to `◐`.

**Critical files.** `src/app/(main)/analysis/page.tsx`,
`src/app/(main)/history/page.tsx`,
`src/lib/services/history-service.ts`,
`src/lib/services/net-worth-service.ts`.

---

### V19 — Dynamic-import sibling dashboard charts

**Observation.** `src/components/dashboard/lazy-charts.tsx` only
dynamic-imports `TrendChart`. `AllocationChart` and
`CurrencyExposureChart` are imported statically from
`src/components/dashboard/dashboard-content.tsx`, so their recharts
subtree is in the initial dashboard RSC payload / client JS.

**Recommendation.** Extend the existing `lazy-charts` pattern:

```ts
export const LazyAllocationChart = dynamic(
  () => import("./allocation-chart").then((m) => m.AllocationChart),
);
export const LazyCurrencyExposureChart = dynamic(
  () => import("./currency-exposure-chart").then(
    (m) => m.CurrencyExposureChart,
  ),
);
```

Keep SSR enabled for these (unlike TrendChart which uses `ssr: false`
for chart-library safety) to preserve CLS — they render with data
already.

**Critical files.** `src/components/dashboard/lazy-charts.tsx`,
`src/components/dashboard/dashboard-content.tsx`.

---

### V20 — Long-cache `/public/*` static assets

**Observation.** `next.config.ts:18-28` only sets
`X-DNS-Prefetch-Control`. Vercel's default static-asset TTL is
conservative; brand assets (logo, favicon, apple-touch) can safely be
`immutable` for a year since a filename change forces a new URL.

**Recommendation.** Add a second `source: "/:all*(svg|jpg|png|webp|avif|ico)"`
entry in `next.config.ts` `headers()`:

```ts
{
  source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff2)",
  headers: [
    { key: "Cache-Control",
      value: "public, max-age=31536000, immutable" },
  ],
},
```

Verify with `curl -I https://asset-tracker-ct.vercel.app/icon.svg`.

**Critical files.** `next.config.ts`.

---

### V21 — Audit `revalidateTag` fan-out

**Observation.** Runtime logs show `POST /accounts` at 14:10:34
immediately followed by `GET /` at 14:10:36 and `GET /accounts` at
14:10:33. Expected revalidation — but if the POST handler calls
`revalidatePath("/")` or tags broadly (e.g. `"accounts"`), it can
cascade-invalidate unrelated cached reads once V18/V26 land.

**Recommendation.** Grep `src/app/api/**/route.ts` for
`revalidatePath`, `revalidateTag`, `router.refresh`. Map each mutation
to the **narrowest** tag(s) it should invalidate:

| Mutation | Correct tag(s) |
|----------|----------------|
| `POST /api/accounts` | `accounts:${userId}`, `net-worth:${userId}` |
| `POST /api/accounts/[id]/holdings` | `account:${id}`, `net-worth:${userId}` |
| `POST /api/prices/refresh` | `prices` |
| `POST /api/cron/snapshot` | `history:${userId}` (per user), `net-worth:${userId}` |

Land V18 first so there are actual tagged reads to invalidate.

**Critical files.** `src/app/api/accounts/route.ts`,
`src/app/api/accounts/[id]/holdings/route.ts`,
`src/app/api/accounts/[id]/transactions/route.ts`,
`src/app/api/prices/refresh/route.ts`,
`src/app/api/cron/snapshot/route.ts`.

---

### V22 — Bundle-analyzer baseline

**Observation.** `next.config.ts:9-15` passes the right names to
`optimizePackageImports` (recharts, lucide-react, date-fns,
next-intl, @prisma/client), but there is no way to verify
effectiveness or catch regressions. No `@next/bundle-analyzer` in
`package.json`.

**Recommendation.**

```bash
npm i -D @next/bundle-analyzer
```

Wrap the export in `next.config.ts`:

```ts
import withBundleAnalyzer from "@next/bundle-analyzer";
const analyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default analyzer(withNextIntl(nextConfig));
```

Run `ANALYZE=true npm run build` once and commit the baseline numbers
to this doc (app JS, dashboard route JS, shared chunks). Re-run before
shipping V19 to measure the savings.

**Critical files.** `next.config.ts`, `package.json`.

---

### V23 — Reserve chart card height (CLS)

**Observation.** Recharts renders client-side and has no intrinsic
height. On the dashboard, the skeleton collapses to 0 and the chart
injects its SVG, producing a layout shift as the card height grows to
~320 px. Speed Insights counts this toward CLS.

**Recommendation.** Set an explicit `min-h-[320px]` (or
`aspect-[4/3]`) on each chart card wrapper in
`src/components/dashboard/allocation-chart.tsx`,
`currency-exposure-chart.tsx`, `trend-chart.tsx`. Match the skeleton
in `src/components/dashboard/dashboard-skeleton.tsx` to the same
height. Verify in DevTools → Performance → Layout shifts that the
dashboard's CLS score lands below 0.1.

**Critical files.** `src/components/dashboard/allocation-chart.tsx`,
`src/components/dashboard/currency-exposure-chart.tsx`,
`src/components/dashboard/trend-chart.tsx`,
`src/components/dashboard/dashboard-skeleton.tsx`.

---

### V24 — Preload fonts + defer below-fold work (LCP / FCP)

**Observation.** Geist Sans is loaded via `next/font/local` with
`display: "swap"` — correct — but the dashboard title (likely the
LCP candidate on `/`) still waits one paint cycle for the
400/600-weight subset. Below-fold chart cards render immediately even
though the user may not scroll to them.

**Recommendation.** (1) In `src/app/layout.tsx`, mark the
`next/font/local` declaration with `preload: true` for the weights
used by the hero (`400`, `600`). (2) Add `content-visibility: auto;
contain-intrinsic-size: 320px 600px;` (Tailwind arbitrary value) to
below-fold chart cards so the browser skips their layout/paint until
they scroll near.

**Critical files.** `src/app/layout.tsx`,
`src/components/dashboard/allocation-chart.tsx`,
`src/components/dashboard/currency-exposure-chart.tsx`.

---

### V25 — `startTransition` around privacy / theme toggles (INP)

**Observation.** `src/components/layout/privacy-mode-context.tsx` and
`next-themes` both trigger a synchronous re-render of every currency
cell across accounts, transactions, and charts when the user toggles
privacy or theme. On a 50+ holding account, this pushes INP past the
200 ms "needs improvement" threshold.

**Recommendation.**

```ts
import { startTransition } from "react";
// …
const togglePrivacyMode = () =>
  startTransition(() => setPrivacyMode((v) => !v));
```

Also wrap currency-formatting cells in `React.memo` and pass a stable
`formatCurrency` reference so they skip re-renders when neither
amount nor currency changed. Measure with the "Interactions" panel in
the Vercel Speed Insights dashboard.

**Critical files.**
`src/components/layout/privacy-mode-context.tsx`,
`src/components/layout/theme-toggle.tsx`,
`src/lib/currencies.ts` (add memoized `<CurrencyCell>` component).

---

### V26 — Extend PPR to `/settings` and `/` (TTFB)

**Observation.** Build output flags `/` and `/settings` as
`ƒ (Dynamic)`. Both pages pay a full Neon round-trip from `sin1` on
every visit — TTFB baselines around 250–400 ms.

**Recommendation.** Apply V18's pattern with a user-keyed cache tag.
`/settings` is straightforward (one row keyed by `userId`):

```ts
"use cache";
import { cacheTag, cacheLife } from "next/cache";

export async function getUserSettings(userId: string) {
  cacheTag(`settings:${userId}`);
  cacheLife("minutes");
  return prisma.userSettings.findUnique({ where: { userId } });
}
```

`/` (dashboard) is trickier because net-worth depends on prices
refreshed by the cron. Cache the **structural** parts (list of
account names, currencies, holdings) under `accounts:${userId}`, and
leave the price-valued numbers as dynamic islands streamed from the
server. Build output should flip both routes from `ƒ` to `◐` without
losing correctness. Pair with V21 so mutations invalidate the right
tags.

**Critical files.** `src/app/(main)/page.tsx`,
`src/app/(main)/settings/page.tsx`,
`src/lib/services/settings-service.ts` (or similar),
`src/lib/services/net-worth-service.ts`.

---

## Addendum — 2026-04-19 Re-Pull (V27–V33)

A third read of the Vercel MCP connector against production deployment
`dpl_GiNydqzEuRBeKv7iw8hVgWrbvPQd` (commit `1c0c953`, 2026-04-19)
surfaced a critical gap: **V26 was marked ✅ Done but the build output
still classifies `/`, `/accounts`, `/analysis`, `/history`, `/settings`
as `ƒ (Dynamic)`.** Only `/accounts/[id]` is `◐ (Partial Prerender)`.
V26 added per-user `cacheTag()` calls to the existing `unstable_cache`
wrappers, but **no file in the repo used the Next.js 16 `"use cache"`
directive** (grep confirms zero hits), so the Cache Components layer
never adopted those routes.

Items V27–V33 address the remaining Speed-Insights headroom across
every Core Web Vital. V27–V29 ship in this same pass; V30–V33 are
queued follow-ups.

### V27 — Flip five routes to Partial Prerender via `"use cache"`

**Observation.** Despite `cacheComponents: true` in `next.config.ts`,
no service-layer read declared `"use cache"`. The routes never opted
into PPR and every visit paid a Neon round-trip from `sin1`. Build
output at `dpl_GiNydqzEuRBeKv7iw8hVgWrbvPQd` confirmed `ƒ /`,
`ƒ /accounts`, `ƒ /analysis`, `ƒ /history`, `ƒ /settings`.

**Recommendation.** Keep React `cache()` wrappers (per-render dedup)
and replace `unstable_cache` with the Next.js 16 `"use cache"`
directive on the structural reads the pages await. Tags and
`cacheLife("minutes")` migrate across:

```ts
// src/lib/services/settings-service.ts
async function findSettings(userId: string) {
  "use cache";
  cacheTag("settings");
  cacheTag(`settings:${userId}`);
  cacheLife("minutes");
  return prisma.setting.findUnique({ where: { userId } });
}
```

`getLocale()` reads cookies, so the create-fallback branch stays
outside the cached function. Same pattern applied to
`fetchUserAccountsWithHoldings`, `getCachedExchangeRates`,
`getNormalizedHistory`, and `fetchFullHistoryCached`. The existing
mutation-layer `revalidateTag` calls (`accounts:${userId}`,
`settings:${userId}`, `net-worth:${userId}`, `exchange-rates`,
`net-worth`, `snapshots`) already match the new tags — no API-route
changes needed.

**Critical files.** `src/lib/services/settings-service.ts`,
`src/lib/services/net-worth-service.ts`,
`src/lib/services/exchange-rate-service.ts`,
`src/lib/services/history-service.ts`.

---

### V28 — Preconnect to `va.vercel-scripts.com`

**Observation.** `src/app/layout.tsx` mounts `<Analytics />` and
`<SpeedInsights />` which load their runtime from
`https://va.vercel-scripts.com`. The head block had
`dns-prefetch` entries for the FX-rate APIs but nothing for the
Vercel scripts origin — first-time visitors on cellular pay the full
TLS handshake before the analytics script starts.

**Recommendation.** Add two lines next to the existing
`dns-prefetch` entries:

```tsx
<link
  rel="preconnect"
  href="https://va.vercel-scripts.com"
  crossOrigin="anonymous"
/>
<link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
```

The `crossOrigin="anonymous"` attribute is required so the preconnect
matches the script's CORS mode. Verify with DevTools → Network →
`va.vercel-scripts.com` TLS handshake starts alongside HTML parse.

**Critical files.** `src/app/layout.tsx`.

---

### V29 — SSR the pie-chart card shells

**Observation.**
`src/components/dashboard/lazy-charts.tsx` wrapped
`AllocationChart` and `CurrencyExposureChart` in
`dynamic(..., { ssr: false })`. The server sent the generic
`<ChartSkeleton />` placeholder; the real card title and shell only
rendered after client hydration. Because recharts'
`ResponsiveContainer` uses `ResizeObserver`, the chart SVG itself
does need a client pass — but the card header with the localized
title does not.

**Recommendation.** Drop `ssr: false` from both Lazy exports:

```ts
export const LazyAllocationChart = dynamic(
  () => import("./allocation-chart").then((m) => m.AllocationChart),
  { loading: () => <ChartSkeleton /> },
);
export const LazyCurrencyExposureChart = dynamic(
  () => import("./currency-exposure-chart").then((m) => m.CurrencyExposureChart),
  { loading: () => <ChartSkeleton /> },
);
```

With SSR enabled the server renders the real `Card` + `CardHeader`
+ localized title in HTML. The chart's internal
`mounted`-gated `<ResponsiveContainer>` still waits for the client,
but the visible card title ships immediately — shifting the LCP
candidate to a server-rendered element. `TrendChart` stays
`ssr: false` because its line-chart animation logic has historically
collided with hydration.

**Critical files.** `src/components/dashboard/lazy-charts.tsx`.

---

### V30 — Extend `startTransition` to transaction/holding mutators

**Observation.** V25 wrapped privacy/theme toggles in
`startTransition`. Inline-edit submit paths on `/accounts/[id]`
still call `router.refresh()` synchronously after every save —
`src/components/accounts/transaction-history.tsx:131,152`,
`src/components/accounts/edit-holding-dialog.tsx:98`,
`src/components/accounts/quick-add-holding.tsx:158`,
`src/components/accounts/holding-form.tsx:97`. On a 50+ holding
account each click blocks the next frame while React re-renders the
whole table.

**Recommendation.** Wrap `router.refresh()` + optimistic state
setters in `startTransition`:

```tsx
import { startTransition } from "react";
// …
startTransition(() => {
  router.refresh();
  onSuccess?.();
});
```

Measure with the Vercel Speed Insights dashboard → Interactions
panel; INP should move below 200ms on mid-range Android devices.

**Critical files.** `src/components/accounts/transaction-history.tsx`,
`src/components/accounts/edit-holding-dialog.tsx`,
`src/components/accounts/quick-add-holding.tsx`,
`src/components/accounts/holding-form.tsx`,
`src/components/accounts/account-detail.tsx`.

---

### V31 — Optimize remote avatar images

**Observation.** `next.config.ts` has no `images` block, so any
`next/image` rendering a Google avatar (`lh3.googleusercontent.com`,
set by NextAuth for Google OAuth users) would fail with
"unconfigured host". AVIF/WebP formats are off by default on Next.js
16 — every avatar request ships PNG even though modern browsers
support AVIF.

**Recommendation.**

```ts
// next.config.ts
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    { protocol: "https", hostname: "lh3.googleusercontent.com" },
  ],
},
```

Pair with `<Image src={session.user.image} priority width={32} height={32} />`
in the sidebar user block (if added) so the above-fold avatar
preloads.

**Critical files.** `next.config.ts`,
`src/components/layout/sidebar.tsx` (if/when an avatar lands).

---

### V32 — Trim Speed Insights telemetry

**Observation.** `<SpeedInsights />` currently samples every page at
100%, including `/login` (single-purpose OAuth redirect) and
`/privacy` (legal copy). Both inflate the sampling budget without
providing actionable score data.

**Recommendation.**

```tsx
<SpeedInsights
  beforeSend={(data) => {
    if (data.url.includes("/login") || data.url.includes("/privacy")) {
      return null;
    }
    return data;
  }}
/>
```

On Pro tier, set `sampleRate={0.5}` once traffic exceeds 10k
page-views/day. Neither change affects Lighthouse lab scores — this
is a cost + signal-to-noise cleanup.

**Critical files.** `src/app/layout.tsx`.

---

### V33 — Ship `@next/bundle-analyzer`

**Observation.** V22 recommended bundle-analyzer for baseline
measurement but never landed. Without it, the team can't prove that
`optimizePackageImports` is actually trimming recharts / lucide /
date-fns, and any future client-JS win (V30, dynamic form loaders,
etc.) has no before/after evidence.

**Recommendation.**

```bash
npm i -D @next/bundle-analyzer
```

```ts
// next.config.ts
import withBundleAnalyzer from "@next/bundle-analyzer";
const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});
export default analyzer(withNextIntl(nextConfig));
```

Commit the `ANALYZE=true npm run build` baseline (dashboard route
JS, shared chunks, largest single module) to this doc. Re-run on
every Speed Insights PR to quantify client-JS movement.

**Critical files.** `next.config.ts`, `package.json`, this doc.

---

## Next Steps

1. Implement **V1, V2, V3, V7, V13** first — low effort, high signal.
2. Verify **V11** (cron) before shipping; if not firing, it's a silent
   data-integrity bug.
3. Tackle **V4, V5, V10** together — all `vercel.json` / platform config.
4. **V6** requires careful testing to avoid regressing #127's perceived
   nav speed.
5. **V14** (CSP) should land only after V13 + a week of report-only data.
6. **V16 + V23** are the highest-signal new items — V16 removes
   multi-second duplicate DB hits, V23 removes measurable CLS from
   every dashboard load.
7. **V17 and V20** are 15–20-minute quick wins and both tighten cache
   headers — batch them with V2's build-command cleanup.
8. **V18 + V26** unlock PPR on the three currently-dynamic routes,
   but require V21's `revalidateTag` discipline first; otherwise
   mutations will either leave stale data or cascade-invalidate too
   much.
9. **V24 + V25** are the Speed Insights polish pass — land them after
   the structural items (V16, V18, V23, V26) so baseline scores move
   first.
10. **V22** before and after V19 — bundle-analyzer output is the
    cleanest evidence that recharts got slimmer.
