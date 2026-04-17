# Asset Tracker — Vercel Deploy Analysis

## Overview

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| V1 | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16 convention) | Deprecation | 🟢 Low | 10 min | ❌ Not Done |
| V2 | Remove duplicate `prisma generate` (postinstall + build) | Build Perf | 🟢 Low | 5 min | ❌ Not Done |
| V3 | Upgrade `prisma` + `@prisma/client` 7.6.0 → 7.7.0 | Maintenance | 🟢 Low | 10 min | ❌ Not Done |
| V4 | Set `maxDuration: 60` for `/api/cron/snapshot` in `vercel.json` | Reliability | 🔴 High | 10 min | ❌ Not Done |
| V5 | Pin `regions` in `vercel.json` to match Neon region | Performance | 🟡 Medium | 15 min | ❌ Not Done |
| V6 | Hover/viewport prefetch in sidebar (replace eager all-routes prefetch) | Performance | 🟡 Medium | 30 min | ❌ Not Done |
| V7 | Suppress yahoo-finance2 consent notices in `price-service.ts` | Observability | 🟢 Low | 15 min | ❌ Not Done |
| V8 | Evaluate edge runtime for `/api/search` + `/api/exchange-rates` | Performance | 🟡 Medium | 1-2 hrs | ❌ Not Done |
| V9 | Verify `@vercel/speed-insights` + `@vercel/analytics` are mounted | Observability | 🟢 Low | 15 min | ❌ Not Done |
| V10 | Add `/api/health` endpoint | Observability | 🟡 Medium | 30 min | ❌ Not Done |
| V11 | Verify Vercel Cron `/api/cron/snapshot` is firing daily | Reliability | 🔴 High | 15 min | ❌ Not Done |
| V12 | Structured error logging in `price-service.ts` | Observability | 🟡 Medium | 1 hr | ❌ Not Done |
| V13 | Add baseline security headers (HSTS, X-CTO, XFO, Referrer-Policy, Permissions-Policy) | Security | 🔴 High | 1 hr | ❌ Not Done |
| V14 | Add CSP (Report-Only first, then enforce) | Security | 🔴 High | 2-3 hrs | ❌ Not Done |
| V15 | Audit & shrink `.next/cache` (currently 292 MB) | Build Perf | 🟢 Low | 1 hr | ❌ Not Done |

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

## Next Steps

1. Implement **V1, V2, V3, V7, V13** first — low effort, high signal.
2. Verify **V11** (cron) before shipping; if not firing, it's a silent
   data-integrity bug.
3. Tackle **V4, V5, V10** together — all `vercel.json` / platform config.
4. **V6** requires careful testing to avoid regressing #127's perceived
   nav speed.
5. **V14** (CSP) should land only after V13 + a week of report-only data.
