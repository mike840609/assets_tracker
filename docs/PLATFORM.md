# Assets Tracker — Platform

This file consolidates four former docs: `INFRASTRUCTURE.md` (V1–V36 Vercel platform audit, R1–R26 release readiness), `vercel_fluid_cpu_optimization_20260517.md` (P1–P9 Active-CPU optimization), `suggestions_20260515_vercel_mcp.md` (F1–F8 live MCP findings), and `firewall_setup.md` (firewall rule setup).

---

## Vercel Platform

Findings sourced from the Vercel MCP connector against project `prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team `team_ImEsp9hzYaqzaPz5VmE6LTiW`) across four audit passes: 2026-04-17, 2026-04-18, 2026-04-19, and 2026-05-14.

> **2026-05-14 audit pass.** `get_project` returned `"live": false` (meaning TBD — likely a Vercel-internal traffic/billing flag, consistent with the empty 7-day runtime-log window observed in F1). `get_runtime_logs` against production returned no entries for the same window. Full findings in the [Vercel MCP Findings](#vercel-mcp-findings-2026-05-14) section below (F1–F8).

| #   | Suggestion                                                                                                                                                                                                                 | Category                 | Impact    | Effort  | Status                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------- | ------- | ---------------------- |
| V1  | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16 convention)                                                                                                                                                        | Deprecation              | 🟢 Low    | 10 min  | ✅ Done                |
| V2  | Remove duplicate `prisma generate` (postinstall + build)                                                                                                                                                                   | Build Perf               | 🟢 Low    | 5 min   | ✅ Done                |
| V3  | Upgrade `prisma` + `@prisma/client` 7.6.0 → 7.7.0                                                                                                                                                                          | Maintenance              | 🟢 Low    | 10 min  | ⚠️ Partial             |
| V4  | Set `maxDuration: 60` for `/api/cron/snapshot` in `vercel.json`                                                                                                                                                            | Reliability              | 🔴 High   | 10 min  | ✅ Done                |
| V5  | Pin `regions` in `vercel.json` to match Neon region (`sin1`)                                                                                                                                                               | Performance              | 🟡 Medium | 15 min  | ✅ Done                |
| V6  | Hover/viewport prefetch in sidebar (replace eager all-routes prefetch)                                                                                                                                                     | Performance              | 🟡 Medium | 30 min  | ✅ Done                |
| V7  | Suppress yahoo-finance2 consent notices in `price-service.ts`                                                                                                                                                              | Observability            | 🟢 Low    | 15 min  | ❌ Not Done            |
| V8  | Evaluate edge runtime for `/api/search` + `/api/exchange-rates`                                                                                                                                                            | Performance              | 🟡 Medium | 1-2 hrs | ⚠️ Blocked (see notes) |
| V9  | Verify `@vercel/speed-insights` + `@vercel/analytics` are mounted                                                                                                                                                          | Observability            | 🟢 Low    | 15 min  | ✅ Done                |
| V10 | Add `/api/health` endpoint                                                                                                                                                                                                 | Observability            | 🟡 Medium | 30 min  | ❌ Not Done            |
| V11 | Verify Vercel Cron `/api/cron/snapshot` is firing daily                                                                                                                                                                    | Reliability              | 🔴 High   | 15 min  | ❌ Not Done            |
| V12 | Structured error logging in `price-service.ts`                                                                                                                                                                             | Observability            | 🟡 Medium | 1 hr    | ❌ Not Done            |
| V13 | Add baseline security headers (HSTS, X-CTO, XFO, Referrer-Policy, Permissions-Policy)                                                                                                                                      | Security                 | 🔴 High   | 1 hr    | ✅ Done                |
| V14 | Add CSP (Report-Only first, then enforce)                                                                                                                                                                                  | Security                 | 🔴 High   | 2-3 hrs | ❌ Not Done            |
| V15 | Audit & shrink `.next/cache` (currently 292 MB)                                                                                                                                                                            | Build Perf               | 🟢 Low    | 1 hr    | ⚠️ Partial             |
| V16 | React `cache()` wrap for `/accounts/[id]` reads + audit `<Link prefetch>` to stop 5–8× burst                                                                                                                               | Performance              | 🔴 High   | 45 min  | ✅ Done                |
| V17 | `Cache-Control` + `"use cache"` / `cacheTag("exchange-rates")` on `/api/exchange-rates`                                                                                                                                    | Performance              | 🟡 Medium | 20 min  | ❌ Not Done            |
| V18 | Opt `/analysis` and `/history` into PPR with `"use cache"` + `cacheTag`                                                                                                                                                    | Performance              | 🟡 Medium | 1 hr    | ❌ Not Done            |
| V19 | Dynamic-import `AllocationChart` + `CurrencyExposureChart` like `TrendChart`                                                                                                                                               | Bundle                   | 🟡 Medium | 30 min  | ✅ Done                |
| V20 | `Cache-Control: public, max-age=31536000, immutable` for `/public/*`                                                                                                                                                       | Performance              | 🟢 Low    | 15 min  | ❌ Not Done            |
| V21 | Audit `revalidateTag` after `POST /accounts`, `/holdings`, `/transactions`                                                                                                                                                 | Performance              | 🟡 Medium | 1–2 hrs | ❌ Not Done            |
| V22 | Add `@next/bundle-analyzer` + baseline dashboard RSC payload                                                                                                                                                               | Observability            | 🟢 Low    | 30 min  | ⚠️ Partial             |
| V23 | Reserve `min-h` / `aspect-ratio` on chart cards (CLS fix)                                                                                                                                                                  | Speed Insights · CLS     | 🔴 High   | 30 min  | ❌ Not Done            |
| V24 | Preload Geist Sans `.woff2` + `content-visibility: auto` on below-fold cards                                                                                                                                               | Speed Insights · LCP/FCP | 🟡 Medium | 45 min  | ✅ Done                |
| V25 | `startTransition` + memoize privacy/theme-toggle consumers                                                                                                                                                                 | Speed Insights · INP     | 🟡 Medium | 1 hr    | ✅ Done                |
| V26 | Extend V18's PPR pattern to `/settings` and `/` (per-user cache key)                                                                                                                                                       | Speed Insights · TTFB    | 🟡 Medium | 1–2 hrs | ✅ Done                |
| V27 | Convert `/`, `/accounts`, `/analysis`, `/history`, `/settings` from `ƒ` → `◐` by adding the Next.js 16 `"use cache"` directive to service-layer reads                                                                      | Speed Insights · TTFB    | 🔴 High   | 1–2 hrs | ✅ Done                |
| V28 | `<link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin="anonymous">` for Analytics + Speed Insights                                                                                                      | Speed Insights · LCP/FCP | 🟢 Low    | 5 min   | ✅ Done                |
| V29 | Re-enable SSR for `AllocationChart` + `CurrencyExposureChart` (drop `ssr: false`)                                                                                                                                          | Speed Insights · LCP     | 🟡 Medium | 30 min  | ✅ Done                |
| V30 | Wrap `router.refresh()` + inline-edit state setters in `startTransition` across transaction/holding mutators                                                                                                               | Speed Insights · INP     | 🟡 Medium | 45 min  | ✅ Done                |
| V31 | Add `next.config.ts` `images.formats = ["image/avif", "image/webp"]` + `remotePatterns` for `lh3.googleusercontent.com`                                                                                                    | Speed Insights · LCP     | 🟢 Low    | 15 min  | ✅ Done                |
| V32 | Configure `<SpeedInsights beforeSend={…}>` to drop `/login` + `/privacy` from telemetry                                                                                                                                    | Observability            | 🟢 Low    | 15 min  | ✅ Done                |
| V33 | Ship `@next/bundle-analyzer` (supersedes V22) — prerequisite for measuring any further client-JS Speed Insights wins                                                                                                       | Observability            | 🟢 Low    | 30 min  | ⚠️ Partial             |
| V34 | Extend `maxDuration` in `vercel.json` to cover `/api/prices/refresh` (60 s) and `/api/exchange-rates/refresh` (30 s)                                                                                                       | Reliability              | 🟡 Medium | 5 min   | ✅ Done                |
| V35 | Enable Skew Protection — keeps old deployment assets alive during transition so users don't hit JS chunk 404s on new deploy (configure via Vercel Dashboard → Project Settings → Deployment Protection, not `vercel.json`) | Reliability              | 🟢 Low    | 2 min   | ❌ Not Done            |
| V36 | Add `poweredByHeader: false` to `next.config.ts`; set `images.minimumCacheTTL: 86400` for Google profile-picture cache (was 60 s default)                                                                                  | Performance              | 🟢 Low    | 5 min   | ✅ Done                |

### Key Build-log Findings (2026-04-17)

Deployment `dpl_3KqPj4qBr3ZojdDaSxtKvo8iNhC2` (44s total, 292 MB build cache):

1. **Deprecated middleware convention.** `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` The repo still has `src/middleware.ts`.
2. **Prisma minor out of date.** Every build prints a 7.6.0 → 7.7.0 upgrade banner.
3. **Duplicate `prisma generate` (resolved 2026-04-26).** `vercel.json` now pins `buildCommand: "npm run build:vercel"`. As of 2026-05-16, the script runs `prisma migrate deploy` followed by `next build`, and skips the migrate step when `git diff --name-only $VERCEL_GIT_PREVIOUS_SHA HEAD -- prisma/migrations` is empty. Falls open (still runs migrate) on any uncertainty — missing previous SHA, shallow clone that can't reach it, or git failure. `FORCE_PRISMA_MIGRATE_DEPLOY=1` overrides; pre-existing `SKIP_PRISMA_MIGRATE_DEPLOY=1` short-circuit preserved.
4. **Large build cache (292 MB).** Upload takes ~4s. Partially addressed 2026-05-16 by tightening `.vercelignore` — see V15.

### Key Runtime-log Findings (production, 7d)

1. **Zero error/fatal/5xx/404 logs** in the sampled window.
2. **Sidebar prefetch storm.** On every navigation, the sidebar fires RSC prefetches to `/`, `/accounts`, `/analysis`, `/history`, `/settings` — each with 3–5 duplicate hits in the same second.
3. **Account detail fired 3× per navigation.** `/accounts/[id]` hit three times for the same ID within one second.
4. **Yahoo Finance consent notice** leaks into logs on every `POST /api/prices/refresh`.
5. **No `/api/cron/snapshot` hits in log window.** Either the Vercel Cron isn't firing, runtime logs filter it, or runs land outside the sampled window.
6. **No `/api/health` endpoint exists**.

### Detailed Enhancement Write-ups (V1–V36)

**V1 — Rename `src/middleware.ts` → `src/proxy.ts`.** Next.js 16.2.2 deprecation warning on every build. Rename the file — no import or config changes needed elsewhere. Critical files: `src/middleware.ts`.

**V2 — Remove duplicate `prisma generate`.** Resolved 2026-04-26. `vercel.json` now pins `buildCommand: "npm run build:vercel"` which does not include `prisma generate`.

**V3 — Upgrade Prisma 7.6.0 → 7.7.0.** `npm i -D prisma@7.7.0 && npm i @prisma/client@7.7.0`. Verify adapter packages stay compatible. Critical files: `package.json`.

**V4 — Set `maxDuration: 60` for cron snapshot.** Add per-function config to `vercel.json`: `"functions": { "src/app/api/cron/snapshot/route.ts": { "maxDuration": 60 } }`. Critical files: `vercel.json`.

**V5 — Pin `regions` in `vercel.json` to the Neon region.** Every hop between serverless function and Neon costs ~10–80ms per query. Add `"regions": ["sin1"]` (matching Neon `ap-southeast-1`). Critical files: `vercel.json`.

**V6 — Hover/viewport prefetch in sidebar.** Change `<Link prefetch>` to `prefetch={false}` and call `router.prefetch(href)` in `onMouseEnter` / `onFocus` / `IntersectionObserver` handlers. Critical files: `src/components/layout/sidebar.tsx`.

**V7 — Suppress yahoo-finance2 consent notices.** Add `yahooFinance.suppressNotices(["yahooSurvey", "ripHistorical"])` near the top of the price-service module. Critical files: `src/lib/services/price-service.ts`.

**V8 — Edge runtime evaluation.** Adding `export const runtime = "edge"` to either route fails the Turbopack build with: `Route segment config "runtime" is not compatible with nextConfig.cacheComponents`. Blocked until Next.js relaxes the Cache Components + edge restriction. **Do not re-propose** until that constraint lifts.

**V9 — Verify analytics mounts.** Confirm `<Analytics />` and `<SpeedInsights />` are imported and rendered in `src/app/layout.tsx`. Critical files: `src/app/layout.tsx`.

**V10 — Add `/api/health` endpoint.** Create `src/app/api/health/route.ts` returning `{ ok, db, time }` with a `SELECT 1` DB probe. Hook it into Vercel Monitoring uptime checks.

**V11 — Verify Vercel Cron is firing.** In Vercel Dashboard → Project → Settings → Cron Jobs, confirm last execution timestamp. If empty: verify `CRON_SECRET` env var, then trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://asset-tracker-ct.vercel.app/api/cron/snapshot`.

**V12 — Structured error logging in price-service.** Wrap fetches with explicit JSON logging including `{ scope, provider, symbol, userId, error }`. Overlaps with PE1 — adopt whichever lands first.

**V13 — Add baseline security headers.** Extend `next.config.ts` `headers()` to include HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Critical files: `next.config.ts`.

**V14 — Add Content-Security-Policy.** Start with `Content-Security-Policy-Report-Only` for one week, then promote to enforcement. Allowlist: `default-src 'self'`, `script-src 'self' 'nonce-<NONCE>' https://va.vercel-scripts.com`, `img-src 'self' data: https://lh3.googleusercontent.com`, `frame-ancestors 'none'`. Critical files: `next.config.ts` or `src/proxy.ts`.

**V15 — Audit & shrink `.next/cache`.** Build cache is 292 MB; upload cost is ~4s per deploy. ⚠️ Partial (2026-05-16): `.vercelignore` now excludes `tests/`, `playwright-report/`, `test-results/`, `playwright.config.ts`, `docs/`, `*.md` (except `README.md`), `.github/`, `.husky/`, and `scripts/compress-og-images.mjs` so they no longer ride along in the deploy upload. The 292 MB `.next/cache` itself is still untouched — running `du -sh .next/cache/*` locally and excluding the `.next/cache/swc` + `.next/cache/webpack` subtrees (Turbopack doesn't use them) remains open. Critical files: `.vercelignore`.

**V16 — Dedupe `/accounts/[id]` reads.** Done 2026-05-10. `src/lib/services/account-service.ts` now wraps account detail lookup and account-detail price-map reads in React `cache()`, while continuing to use the ownership-safe `fetchUserAccountsWithHoldings(userId)` structural cache. Repeated account detail links in `accounts-list.tsx` and `accounts-summary.tsx`, plus the mobile bottom nav, now use `prefetch={false}` to avoid viewport-triggered RSC bursts. Critical files: `src/app/(main)/accounts/[id]/page.tsx`, `src/lib/services/account-service.ts`, `src/components/accounts/accounts-list.tsx`, `src/components/dashboard/accounts-summary.tsx`, `src/components/layout/sidebar.tsx`.

**V17 — Cache `/api/exchange-rates`.** Add `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` or adopt `"use cache"` + `cacheTag("exchange-rates")`. Call `revalidateTag("exchange-rates")` inside refresh routes. Critical files: `src/app/api/exchange-rates/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`.

**V18 — Opt `/analysis` and `/history` into PPR.** Move each route's data-fetching helper into a cached server function with `cacheTag(\`history:${userId}\`)`+`cacheLife("minutes")`. Critical files: `src/app/(main)/analysis/page.tsx`, `src/app/(main)/history/page.tsx`, `src/lib/services/history-service.ts`.

**V19 — Dynamic-import sibling dashboard charts.** Extend the existing `lazy-charts` pattern to add `LazyAllocationChart` and `LazyCurrencyExposureChart`. Keep SSR enabled (unlike TrendChart which uses `ssr: false`) to preserve CLS. Critical files: `src/components/dashboard/lazy-charts.tsx`, `src/components/dashboard/dashboard-content.tsx`.

**V20 — Long-cache `/public/*` static assets.** Add a second `source: "/:all*(svg|jpg|png|webp|avif|ico|woff2)"` entry in `next.config.ts` `headers()` with `Cache-Control: public, max-age=31536000, immutable`. Critical files: `next.config.ts`.

**V21 — Audit `revalidateTag` fan-out.** Map each mutation to the narrowest tag(s) it should invalidate. Land V18 first so there are actual tagged reads to invalidate. Correct tag mappings: `POST /api/accounts` → `accounts:${userId}`, `net-worth:${userId}`; `POST /api/accounts/[id]/holdings` → `account:${id}`, `net-worth:${userId}`; etc.

**V22 — Bundle-analyzer baseline.** `npm i -D @next/bundle-analyzer`. Wrap the export in `next.config.ts`. Run `ANALYZE=true npm run build` once and commit baseline numbers. Superseded by V33 / PE4.

**V23 — Reserve chart card height (CLS).** Set explicit `min-h-[320px]` on each chart card wrapper in `allocation-chart.tsx`, `currency-exposure-chart.tsx`, `trend-chart.tsx`. Match the skeleton in `dashboard-skeleton.tsx`. Verify CLS < 0.1.

**V24 — Preload fonts + defer below-fold work.** Mark the `next/font/local` declaration with `preload: true` for the weights used by the hero (`400`, `600`). Add `content-visibility: auto` to below-fold chart cards. Critical files: `src/app/layout.tsx`, chart card components.

**V25 — `startTransition` around privacy / theme toggles.** `togglePrivacyMode` and theme toggle should wrap state setters in `startTransition`. Also wrap `<CurrencyCell>` in `React.memo`. Critical files: `src/components/layout/privacy-mode-context.tsx`, `src/components/layout/theme-toggle.tsx`.

**V26 — Extend PPR to `/settings` and `/`.** Apply V18's pattern with a user-keyed cache tag. `/settings`: `cacheTag(\`settings:${userId}\`)`. `/`: cache structural parts (account names, currencies, holdings) under `accounts:${userId}`, leave price-valued numbers as dynamic islands. Critical files: `src/app/(main)/page.tsx`, `src/app/(main)/settings/page.tsx`, `src/lib/services/settings-service.ts`.

**V27 — Flip five routes to Partial Prerender via `"use cache"`.** Replace `unstable_cache` with the Next.js 16 `"use cache"` directive on structural reads. Apply to `findSettings`, `fetchUserAccountsWithHoldings`, `getCachedExchangeRates`, `getNormalizedHistory`, `fetchFullHistoryCached`. Critical files: `src/lib/services/settings-service.ts`, `src/lib/services/net-worth-service.ts`, `src/lib/services/exchange-rate-service.ts`, `src/lib/services/history-service.ts`.

**V28 — Preconnect to `va.vercel-scripts.com`.** Add `<link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin="anonymous" />` + `<link rel="dns-prefetch" href="https://va.vercel-scripts.com" />`. Critical files: `src/app/layout.tsx`.

**V29 — SSR the pie-chart card shells.** Drop `ssr: false` from `LazyAllocationChart` and `LazyCurrencyExposureChart` in `lazy-charts.tsx`. Keep `TrendChart` as `ssr: false`. Critical files: `src/components/dashboard/lazy-charts.tsx`.

**V30 — Extend `startTransition` to transaction/holding mutators.** Wrap `router.refresh()` + optimistic state setters in `startTransition` across `transaction-history.tsx:131,152`, `edit-holding-dialog.tsx:98`, `quick-add-holding.tsx:158`, `holding-form.tsx:97`.

**V31 — Optimize remote avatar images.** Add `images: { formats: ["image/avif", "image/webp"], remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }] }` to `next.config.ts`. Critical files: `next.config.ts`.

**V32 — Trim Speed Insights telemetry.** Configure `<SpeedInsights beforeSend={(data) => { if (data.url.includes("/login") || data.url.includes("/privacy")) return null; return data; }} />`. Critical files: `src/app/layout.tsx`.

**V33 — Ship `@next/bundle-analyzer`.** `npm i -D @next/bundle-analyzer`. Wrap the export in `next.config.ts`. Commit the `ANALYZE=true npm run build` baseline (dashboard route JS, shared chunks, largest single module) to this doc. Re-run on every Speed Insights PR.

**V34 — Extend `maxDuration` for refresh routes.** Add per-function entries: `"src/app/api/prices/refresh/route.ts": { "maxDuration": 60 }` and `"src/app/api/exchange-rates/refresh/route.ts": { "maxDuration": 30 }`. Critical files: `vercel.json`.

**V35 — Enable Skew Protection.** Configure via Vercel Dashboard → Project Settings → Deployment Protection. No `vercel.json` change needed.

**V36 — `poweredByHeader: false` + image cache TTL.** Add `poweredByHeader: false` to `next.config.ts`; set `images.minimumCacheTTL: 86400` so Google profile pictures aren't re-fetched every 60 s. Critical files: `next.config.ts`.

---

## Release Readiness (Pre-Launch)

Findings sourced against Vercel project on **2026-04-24**. Scope: only **launch blockers or high-risk gaps**. Performance and nice-to-have work tracked in the Vercel Platform section is not duplicated here.

| #   | Suggestion                                                                           | Category           | Impact    | Effort    | Status                                                                                                       |
| --- | ------------------------------------------------------------------------------------ | ------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| R1  | Add baseline security headers (HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy) | Security           | 🔴 High   | 1 hr      | ✅ Done                                                                                                      |
| R2  | Content-Security-Policy (Report-Only → enforce)                                      | Security           | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                  |
| R3  | Rate limit `/api/search`, `/api/exchange-rates`, `/api/auth/*`                       | Security           | 🔴 High   | 2–3 hrs   | ✅ Done                                                                                                      |
| R4  | `crypto.timingSafeEqual` compare for `CRON_SECRET`                                   | Security           | 🟡 Medium | 15 min    | ❌ Not Done                                                                                                  |
| R5  | Enforce account/holding ownership on every mutation route                            | Security           | 🔴 High   | 1–2 hrs   | ✅ Done                                                                                                      |
| R6  | Add `/terms` (Terms of Service) page                                                 | Legal / Compliance | 🔴 High   | 1–2 hrs   | ✅ Done                                                                                                      |
| R7  | Cookie / analytics consent banner                                                    | Legal / Compliance | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                  |
| R8  | GDPR data-export + delete-account flows                                              | Legal / Compliance | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                  |
| R9  | Verify Google OAuth consent screen is published & verified                           | Legal / Compliance | 🔴 High   | 30 min    | ✅ Done                                                                                                      |
| R10 | Add support/contact email in footer + `/privacy`                                     | Legal / Compliance | 🟡 Medium | 15 min    | ❌ Not Done                                                                                                  |
| R11 | Add `error.tsx`, `global-error.tsx`, `not-found.tsx`                                 | Reliability        | 🔴 High   | 1–2 hrs   | ❌ Not Done                                                                                                  |
| R12 | Add `/api/health` endpoint                                                           | Reliability        | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                  |
| R13 | Verify Vercel Cron `/api/cron/snapshot` fires daily in production                    | Reliability        | 🔴 High   | 15 min    | ❌ Not Done                                                                                                  |
| R14 | Timeout + retry guards on Yahoo Finance / CoinGecko calls                            | Reliability        | 🔴 High   | 30–60 min | ✅ Done                                                                                                      |
| R15 | Switch Prisma `db push` → `migrate deploy` (committed migrations)                    | Reliability        | 🔴 High   | 2–3 hrs   | 🟡 Partial — `prisma/migrations/` committed; `build:vercel` runs `prisma migrate deploy`; baselining pending |
| R16 | Document Neon backup / PITR SLA in `README.md`                                       | Reliability        | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                  |
| R17 | Ship Sentry (or equivalent) for error aggregation + alerts                           | Observability      | 🔴 High   | 1–2 hrs   | ❌ Not Done                                                                                                  |
| R18 | Structured logging via `pino` with `userId` / `requestId` context                    | Observability      | 🟡 Medium | 3–4 hrs   | ❌ Not Done                                                                                                  |
| R19 | On-call playbook (Vercel log queries + baselines) in `README.md`                     | Observability      | 🟡 Medium | 45 min    | ❌ Not Done                                                                                                  |
| R20 | `.github/workflows/ci.yml` — lint + `tsc --noEmit` + `next build` on PR              | Testing / CI       | 🔴 High   | 1 hr      | ✅ Done                                                                                                      |
| R21 | Playwright smoke E2E — login, create account+holding, view dashboard                 | Testing / CI       | 🔴 High   | 4–6 hrs   | ✅ Done                                                                                                      |
| R22 | In-app help / FAQ modal + support link                                               | Product            | 🟡 Medium | 2–3 hrs   | ❌ Not Done                                                                                                  |
| R23 | Non-destructive data import (merge, not overwrite)                                   | Product            | 🔴 High   | 3–4 hrs   | ❌ Not Done                                                                                                  |
| R24 | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16)                             | Platform Config    | 🟢 Low    | 10 min    | ✅ Done                                                                                                      |
| R25 | Add `public/robots.txt` + `/sitemap.xml`                                             | Platform Config    | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                  |
| R26 | Flip Vercel project `live: true` ONLY after R1–R14 land                              | Platform Config    | 🔴 High   | 5 min     | ❌ Not Done                                                                                                  |

### Security (R1–R5)

**R1** — Baseline security headers: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. ✅ Done. See also V13.

**R2** — Content-Security-Policy: ship in two stages — `Content-Security-Policy-Report-Only` for 48 h with `report-uri`, review violations, then flip to enforced. Allowlist must cover Google OAuth, Vercel Analytics + Speed Insights, self-hosted fonts. See V14.

**R3** — Rate limiting: `/api/search`, `/api/exchange-rates`, and `/api/auth/*` accept unbounded request volume. Add a token bucket keyed by `x-forwarded-for` + `session.user.id`. ✅ Done.

**R4** — Timing-safe `CRON_SECRET` comparison: `src/app/api/cron/snapshot/route.ts` compares the bearer token with `!==` (short-circuits on first byte mismatch, leaks secret length via timing). Replace with `crypto.timingSafeEqual` on equal-length buffers.

**R5** ✅ Done — All four `/api/accounts/[id]/...` mutation routes now scope reads/writes to `session.user.id`. `route.ts` and `cash-transactions/route.ts` already gated the parent account by `{ id, userId }`; `transactions/[transactionId]/route.ts` PATCH/DELETE were unwrapped (no `withAuth`) and only checked `tx.accountId === accountId` — now wrapped in `withAuth` with an upfront `Account.findUnique({ id, userId })` guard. `holdings/route.ts` POST gained the same parent-account guard, and PATCH/DELETE now resolve the holding via `findFirst({ id, account: { userId } })` instead of an unscoped `findUnique`. _(Closed 2026-05-16)_

### Legal / Compliance (R6–R10)

**R6** — Terms of Service page. ✅ Done.

**R7** — Consent banner: Vercel Analytics + Speed Insights are mounted globally. For EU/UK visitors, ePrivacy + GDPR require explicit opt-in before any non-essential telemetry fires. Add a bottom-of-page banner with "Accept / Reject non-essential" that gates the Analytics/Speed Insights mount via `beforeSend` + a cookie flag.

**R8** — GDPR data-export and delete-account flows. Users must be able to retrieve their data (Art. 15) and delete their account (Art. 17). Ship `POST /api/user/export` (returns JSON zip of all user rows) and `DELETE /api/user` (cascades through every `userId`-scoped table). Surface both on `/settings`.

**R9** — Google OAuth consent screen must be verified. Confirm: App status **In production**, App verification **Published**, Scopes `openid email profile` only. ✅ Done.

**R10** — Support/contact email: GDPR Art. 13 requires a reachable contact for data-subject requests. Add a `support@...` mailto in the footer and `/privacy`.

### Reliability (R11–R16)

**R11** — Error boundaries: no `error.tsx`, `global-error.tsx`, or `not-found.tsx` under `src/app/`. Ship: `src/app/error.tsx` (per-route reset + translated copy), `src/app/global-error.tsx` (last-resort boundary with its own `<html><body>`), `src/app/not-found.tsx` (localized 404 with CTA). See SUGGESTIONS.md#27.

**R12** — `/api/health` endpoint: required for Vercel uptime monitoring, deployment smoke checks. Minimal spec: GET returns 200 with `{ ok: true, db: "up" | "down", commit: process.env.VERCEL_GIT_COMMIT_SHA }`. DB probe: `SELECT 1` via Prisma with a 2s timeout. See V10.

**R13** — Verify Cron actually fires: `vercel.json` schedules `/api/cron/snapshot` for `30 21 * * *`. The 7-day runtime-log scan found no invocations in the sampled filters — confirm via Vercel Dashboard → Crons. See V11.

**R14** — External-call timeout + retry guards: Add 5s timeout per HTTP call (`AbortController`), 2 retries with exponential backoff on transient errors, per-symbol failure isolation. ✅ Done.

**R15** — Prisma migrations: `prisma/migrations/` exists with one committed migration; `build:vercel` runs `prisma migrate deploy && next build`. Pre-existing Neon branches (production + shared `preview`) were created via `prisma db push` so their `_prisma_migrations` history is empty — baseline each one once with `npx prisma migrate resolve --applied 202604120001_add_hot_path_indexes` against the corresponding `DATABASE_URL` (use the **direct**, non-pooled Neon URL) before the next Vercel deploy. 🟡 Partial.

**R16** — Document Neon backup SLA: confirm which Neon plan is in use, the PITR retention window, and how a restore is performed. Capture in `README.md` under "Operations".

### Observability (R17–R19)

**R17** — Sentry (or equivalent) for error aggregation + alerts: today errors go to Vercel stdout and are forgotten. Wire the Next.js integration into both server and client bundles.

**R18** — Structured logging via `pino` with `userId` / `requestId` context. Replace `console.log` / `console.error` across services. Combines SUGGESTIONS.md#30, #55, and V12.

**R19** — On-call playbook: capture the "healthy baseline" (0 errors in last 7 days) and the Vercel runtime-log queries used to verify health in `README.md#Operations`.

### Testing / CI (R20–R21)

**R20** — `.github/workflows/ci.yml`: run `npm ci`, `npx prisma generate`, `npm run lint`, `npx tsc --noEmit`, `next build` on every PR. Fails red → blocks merge. ✅ Done. (2026-05-16) Pipeline is now fan-out: a single `install` job seeds a `node_modules + src/generated/prisma + ~/.cache/prisma` cache (keyed by `package-lock.json` + `prisma/schema.prisma`); `format`, `lint`, `typecheck`, and `build` restore it in parallel. The `build` job additionally restores `.next/cache` keyed by lockfile + schema + `next.config.ts`. `concurrency: cancel-in-progress` is on, and `paths-ignore: docs/**, **.md` skips doc-only PRs.

**R21** — Playwright smoke E2E: cover (1) unauth → login → `/`, (2) create account → add holding → holding appears, (3) dashboard loads with net-worth card + trend chart. ✅ Done. (2026-05-16) Workflow caches `~/.cache/ms-playwright` keyed by the `@playwright/test` version in the lockfile — warm runs only call `playwright install-deps chromium` instead of redownloading the browser archive. Shares the same `node_modules` cache as CI. `playwright.config.ts` now runs `fullyParallel: true, workers: 2`; the `waitForPageReady` `networkidle` helper was removed in favor of explicit `expect(locator).toBeVisible()` waits.

### Product (R22–R23)

**R22** — In-app help / support: ship a small help drawer referencing `README.md` plus the support email from R10.

**R23** — Non-destructive data import: if a user pastes a CSV, they should see a diff (new / updated / unchanged) and confirm before anything is written.

### Platform Config (R24–R26)

**R24** — Middleware rename: see V1. Batch into the launch PR.

**R25** — `robots.txt` + `sitemap.xml`: allow `/privacy` and `/terms` to be crawled; `Disallow` everything else. Ship as `public/robots.txt` and a dynamic `src/app/sitemap.ts`.

**R26** — Flip Vercel `live: true` last: `get_project` reports `"live": false`. Keep it that way until R1–R14 have shipped and R13 has been verified in prod.

### Deferred (not launch blockers)

- Bundle-size reduction items (PERFORMANCE.md B-series)
- Remaining Vercel ❌ items not listed above (V7, V15, V17/V18/V20, V22/V33, V23)
- Feature backlog (SUGGESTIONS.md #7 cost basis, #17 dividends, #23 2FA, #24 Plaid)
- Rendering ladder items (PERFORMANCE.md S/P/I/X)
- PWA manifest / install prompt
- Accessibility polish (SUGGESTIONS.md #43, #44, #48, #57, #70)

### Verification Checklist

After R1–R26 land, confirm:

- `curl -sI https://assets-tracker-ct.vercel.app/ | rg -i 'strict-transport|x-frame|x-content|referrer|permissions|content-security'` → all headers present.
- `curl -s https://assets-tracker-ct.vercel.app/api/health` → `{ "ok": true, "db": "up", ... }`.
- `/terms` and `/privacy` load unauthenticated.
- Trigger cron manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://assets-tracker-ct.vercel.app/api/cron/snapshot` → 200.
- Open a throwaway PR with a deliberate `tsc` error → `ci.yml` fails red.
- `get_project` once R26 is applied → `"live": true`.

### Launch-day go/no-go

Go only when every 🔴 High item above is ✅ Done. The 🟡 Medium items (R4, R10, R12, R16, R18, R19, R22, R25) can land in the week following launch but should all be closed within 14 days.

---

## Fluid CPU Optimization

_Author: planning pass on branch `20260517-optimize-vecel-fluid-cpu-usage`, 2026-05-17. Supersedes the earlier draft (`docs/codex_vercel_fluid_cpu_optimization_plan.md`), which was written before Vercel MCP runtime logs were inspected._

### Context

The project is on the Vercel **Hobby (Free)** plan. Monthly Fluid Function Active-CPU usage is approaching the included **4-hour** allowance, with little real human traffic. Goal: cut billed Active CPU by ≥50 % without UX regressions, so headroom returns before the next monthly window.

Two reasons the earlier draft needed revising:

1. It was written without live log data and over-weighted cron + refresh paths.
2. The Vercel MCP findings below show those paths are not the current bottleneck — bot traffic through middleware is.

### Evidence from Vercel MCP (last 7 days, production)

| Filter                                       | Result      |
| -------------------------------------------- | ----------- |
| `source=serverless`, env=production, 7d      | **0 logs**  |
| `source=edge-middleware`, env=production, 7d | **33 logs** |
| `query=snapshot`, env=production, 7d         | **0 logs**  |
| `query=timing`, env=production, 7d           | **0 logs**  |

Observed top paths (all edge-middleware): `/wp-admin/install.php` (302), `/cmd_sco` (302), `/privacy` (5× repeats in the same second, suggesting a scraper grabbing sub-resources per page load), `/login`, `/`. Production deployment at the time of audit: `dpl_7PdomFLHzWhy3YHAYsRF2UnqqAVD` on `astt.app`.

**Headline finding:** with current traffic, **bot/anonymous middleware invocations dominate billed CPU**. The cron, `refreshAllPrices`, and analytics page fires too rarely to be the primary cost. The earlier draft's #1 ("user-scope manual refresh") is correct in principle but won't move the needle until human traffic grows.

Caveats: Hobby-plan log retention is short and the 100-row MCP cap may under-sample; cron logs may have rolled out of the window since `30 21 * * *` daily fires can fall outside the 7-day sample. Items P5–P8 below still matter as protection against future growth — they're just lower priority right now.

### Code observations the logs do not show

- `src/proxy.ts:80-84` — matcher is broad: `/((?!api/cron|_next/static|...).*)`. Every bot probe to `/wp-admin/install.php`, `/cmd_sco`, `/.env`, etc. invokes `auth()` + locale-cookie write.
- `src/proxy.ts:5,44` — `NextAuth(authConfig)` runs JWT decode for **every** matched request, even routes that immediately 302 to `/login`.
- `src/lib/auth-session.ts:10` + `src/lib/api-handler.ts:8` — RSC and `withAuth` both call `auth()` again. React `cache()` dedups _within_ a render, not _across_ the middleware → page boundary, so each authenticated navigation pays **two JWT decodes**.
- `src/app/privacy/page.tsx:1` and `src/app/login/page.tsx:1` — both have a comment explaining `force-static` is not allowed under `cacheComponents: true`. They re-render dynamically each request, even for bot 5×-burst hits.
- `src/app/api/cron/snapshot/route.ts:51` + `src/lib/services/price-service.ts:208` — `refreshAllPrices` scans `Holding` distinct by symbol across **all users**, then batch upserts.
- `src/app/api/prices/refresh/route.ts:5` — manual refresh button calls the same global function.
- `src/components/dashboard/dashboard-actions.tsx:46-49` — every dashboard refresh fires **two** functions in parallel (`/api/prices/refresh` + `/api/exchange-rates/refresh`).
- `src/app/(main)/analysis/page.tsx:25` — analysis fans out 4 history reads on every load; cached via `"use cache"` but invalidated whenever the cron/refresh writes new snapshots.

### Prioritized changes

Ordered by **expected Active-CPU saved per change**, given the bot-dominated traffic profile observed in MCP.

#### P1 — Tighten middleware matcher to skip bot/junk paths

**Effect:** Very high. Skips middleware entirely on the most common bot probes, returning a static 404 from the edge cache instead of running NextAuth + cookie logic. With 5+ rapid `/privacy` scrapes and repeated `/wp-admin/install.php` / `/cmd_sco` hits per day, this is the single biggest reduction.

- File: `src/proxy.ts` — extend the negative-lookahead in `config.matcher`.
- Add exclusions for: `wp-admin`, `wp-login`, `wordpress`, `xmlrpc.php`, `\\.env`, `\\.git`, `phpmyadmin`, `cgi-bin`, `cmd_`, `\\.well-known` (except `acme-challenge`), `robots.txt`, `sitemap.xml`, and anything with a file extension (`.*\\..*`).
- Optional: add a `public/robots.txt` so Vercel's edge cache absorbs the same paths.

**Pros:** Zero code-path change for legitimate users; meaningful instant savings; trivial to ship; no conflict with `cacheComponents`.
**Cons:** Tiny risk of accidentally excluding a real route — easy to mitigate with path anchors (`^/wp-admin`) and a smoke test.

#### P2 — Add Vercel Firewall / WAF rules to drop bot probes at the edge

**Effect:** High. Even with a tighter matcher, the request still reaches Vercel's edge before being served. WAF/IP rules let Vercel return a 403 before any function (edge or serverless) is billed. This is the single most effective lever for the `/wp-admin*`, `/cmd_*`, `/xmlrpc.php` pattern in logs.

- Vercel dashboard → Project → Settings → Firewall → custom rules:
  - Block when `path` matches `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`, `/cmd_*`, `/.env*`, `/.git/*`.
  - Optional: rate-limit `/privacy` and `/login` per IP (e.g. 30 req/min) to absorb scrapers without hurting humans.

**Pros:** Stops billed work upstream of even edge middleware; configurable from the dashboard with no deploy; complements P1.
**Cons:** Rules live outside the repo (drift risk) — mitigate by exporting via the Vercel API and committing the JSON to `docs/`. Some firewall features (managed rulesets) need a paid plan; custom path-block rules are available on Hobby.

#### P3 — Statically prerender `/privacy`, `/terms`, and the `/login` shell, and exclude them from middleware

**Effect:** High. The page-source comments rule out `force-static` because `cacheComponents: true` is project-wide, but the cheaper, lower-risk alternative is: keep PPR, and exclude these paths from the middleware matcher so the prebuilt shell is served from CDN without any middleware execution. The locale-cookie logic moves to first authenticated navigation instead.

- File: `src/proxy.ts` — add `/login`, `/privacy`, `/terms` to the matcher exclusion.
- Files: `src/app/privacy/page.tsx`, `src/app/login/page.tsx`, `src/app/terms/page.tsx` — keep PPR; move the dynamic island (e.g. `signIn` button) into a leaf client component so the shell is fully prerendered. Move the locale-cookie write into either the `/login` server action or the `(main)/layout.tsx` first render.

**Pros:** Removes one of the largest bot-traffic categories from billed CPU; legitimate users still get their locale cookie set on first authenticated navigation.
**Cons:** Need to re-verify locale-cookie still lands before the first user-visible page; the `/login` page reads `process.env.VERCEL_ENV` for the preview-only Credentials path, but env reads are cheap.

#### P4 — Skip middleware JWT decode on requests that are obviously unauthenticated

**Effect:** Medium-High. Today middleware calls `auth()` for every non-excluded path, even when there is no session cookie at all. A fast `request.cookies.get(SESSION_COOKIE)` check before invoking NextAuth can short-circuit anonymous requests to the redirect path without JWT crypto work.

- File: `src/proxy.ts`. Replace the `default auth((req) => …)` wrapping with a plain `default function middleware(req)` that:
  1. Cheap path: if path is public and there is no session cookie → just `NextResponse.next()`.
  2. If a session cookie exists, call `auth(req)` to validate (only then pay JWT decode).
  3. Keep the `/api/auth/*` rate limit and locale-cookie write.

**Pros:** Removes the biggest per-request cost (JWT decode) from any bot traffic that survives P1/P2. Predictable, no UX change.
**Cons:** Need to keep the session-cookie name in sync with NextAuth (`__Secure-authjs.session-token` in prod, `authjs.session-token` in dev). Extract to a single constant.

#### P5 — Collapse the dashboard "refresh" button into one user-scoped function

**Effect:** Medium per click; grows in importance as user traffic grows.

- File: `src/components/dashboard/dashboard-actions.tsx:46-49`. Today: two fetches in parallel (`/api/prices/refresh` + `/api/exchange-rates/refresh`).
- New: `POST /api/refresh` that internally fetches **only the symbols held by the requesting user** and the rates for the user's `baseCurrency`. Reuse `getAllExchangeRates` cache instead of re-fetching.
- Implementation hint: pull symbols via `prisma.holding.findMany({ where: { account: { userId } }, select: { symbol: true, assetType: true }, distinct: ["symbol"] })`; pass to existing `fetchStockPrices` / `fetchCryptoPrices`.

**Pros:** One function invocation instead of two; CPU scales O(user) not O(DB); also fixes the partial-error UX referenced in commit `f0ccd5488`.
**Cons:** Small refactor (new route + delete old route consumers); cron still uses the global `refreshAllPrices` path.

#### P6 — Gate the cron's `revalidateTag` calls on "anything-changed"

**Effect:** Medium. Today the cron unconditionally invalidates `net-worth`, `prices:crypto`, `snapshots`, and a per-user `history:${user.id}` tag for every user. Every invalidation forces the **next** page load to rebuild via expensive RSC reads — wasted Active CPU on days when no prices actually moved.

- File: `src/app/api/cron/snapshot/route.ts:53-74`.
- Hash the result of `refreshAllPrices` / `createSnapshot` per user; only invalidate when the new total net-worth differs from yesterday's snapshot by more than a small epsilon (e.g. 0.01 in base currency), or when option expirations were processed.

**Pros:** Removes a daily cold-rebuild cost across all cached RSC reads; aligns invalidation with actual change.
**Cons:** Adds branching that must be tested — a missed invalidation could surface stale prices on the dashboard for up to 24 h. Mitigate by keeping the per-user `history:${id}` invalidation always-on (cheap) and gating only the heavyweight `net-worth` + `prices:crypto`.

#### P7 — Remove RSC double-auth for protected pages

**Effect:** Low-Medium per request. Middleware decodes the JWT; `getSession()` decodes it again at the page layer. Across heavy navigations (dashboard, `accounts/[id]`, analysis, history) this is 2× the JWT cost per request.

- Files: `src/lib/auth-session.ts` and `src/proxy.ts`.
- Have middleware attach the decoded userId to a request header (e.g. `x-user-id`), trusted because it was set after middleware decoded the JWT itself. Then `getSession()` reads the header instead of re-decoding (still validates the session cookie is present, but skips crypto).
- Alternative: set a short-lived `x-session-uid` cookie from middleware that the RSC reads with `cookies()`. Either way, gate strictly behind same-origin.

**Pros:** Halves auth CPU for every authenticated page render.
**Cons:** Introduces a "trusted header" pattern — needs care so it can't be spoofed. Vercel strips inbound `x-*` headers in production by default, but document the invariant clearly. NextAuth v5 doesn't ship this pattern out of the box.

#### P8 — Cache `yahoo-finance2` module + class instance at module scope

**Effect:** Low. `price-service.ts:73-74`, `search/route.ts:79-80`, `options/chain/route.ts:44-45` each do `await import("yahoo-finance2")` and `new YahooFinance()` per call. Node's ESM cache makes the second import a no-op, but instantiating a new class per call still allocates state.

- Add `src/lib/yahoo.ts` exporting a `const yf = new YahooFinance()` singleton; update the three callers to import it.

**Pros:** Slightly lower per-call CPU/allocation; cleaner code; warm HTTP keep-alive across Fluid invocations.
**Cons:** Minor — singletons can hold internal state across requests; in Fluid that's actually a benefit.

#### P9 — (Defensive, do NOT ship yet) keep-warm pinger

**Effect:** Defensive only. Cold starts cost more than warm execution on Fluid, but warming itself costs Active CPU. Only worth revisiting **after** P1–P4 land — measure first.

**Recommendation:** **do not add a warmer.** Rely on P1–P4 to keep total work low.

### Recommended execution order

1. **P1 + P2 together (same PR):** tighten middleware matcher and add Vercel firewall rules. These two account for most of the observed traffic.
2. **P3:** statically serve `/login`, `/privacy`, `/terms` and exclude from middleware.
3. **P4:** short-circuit anonymous middleware passes before invoking NextAuth.
4. **P5:** user-scope the refresh button + collapse to one fetch.
5. **P6 + P7:** invalidation gating + RSC auth dedup.
6. **P8:** singleton Yahoo client.

After P1–P3 land, re-pull MCP logs for 3 days and recompute the Active-CPU trajectory before deciding whether P4–P7 are still needed.

### Critical files

| Item                                 | Files                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1, P3, P4, P7 (header pass-through) | `src/proxy.ts`                                                                                                                                                                                   |
| P7                                   | `src/lib/auth-session.ts`, `src/lib/api-handler.ts`                                                                                                                                              |
| P3                                   | `src/app/privacy/page.tsx`, `src/app/login/page.tsx`, `src/app/terms/page.tsx`                                                                                                                   |
| P5                                   | `src/app/api/prices/refresh/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`, `src/components/dashboard/dashboard-actions.tsx`, `src/lib/services/price-service.ts` (`refreshAllPrices`) |
| P6                                   | `src/app/api/cron/snapshot/route.ts`                                                                                                                                                             |
| P8                                   | `src/lib/services/price-service.ts`, `src/app/api/search/route.ts`, `src/app/api/options/chain/route.ts`, new `src/lib/yahoo.ts`                                                                 |
| P2                                   | None in repo (managed in Vercel dashboard; export JSON to `docs/firewall_rules.json` for tracking)                                                                                               |

### Verification

After each change ships to production, wait ~24 h then:

1. **MCP runtime logs comparison.** Re-run:
   - `mcp__claude_ai_Vercel__get_runtime_logs` with `source=["edge-middleware"]` and `source=["serverless"]`, `since=24h`.
   - Confirm prior bot-probe entries no longer appear in middleware logs (P1) and ideally not in edge access logs at all (P2).
2. **Vercel dashboard → Project → Usage → Active CPU.** Compare the rolling-24 h Active CPU number vs the day before the change. Track results in `docs/LOG.md`.
3. **Functional smoke:**
   - Visit `astt.app` while signed out → redirects to `/login` with no broken styling (P3).
   - Visit `astt.app/privacy` → static HTML, no middleware log entry expected after P1+P3.
   - Sign in with Google → dashboard loads → click "Refresh" → toast shows success, prices visibly update (P5).
   - `npm run test:e2e` smoke spec still green (E2E uses Credentials preview login — must keep working after P4).
4. **Cron sanity:** wait for the next 21:30 UTC fire and confirm `snapshotIds` appear in serverless logs and a new `NetWorthSnapshot` row exists in Neon (`prisma studio` or `mcp__plugin_neon_neon__run_sql`).
5. **Vercel Firewall blocks (P2):** Dashboard → Firewall → Logs should show blocked requests for `/wp-admin/install.php`, `/cmd_sco`, etc.

### Out of scope (intentionally skipped)

- Switching the JWT session strategy to database sessions — would _increase_ CPU on every page load.
- Migrating off Hobby — the user explicitly wants to stay on Free.
- Edge-runtime opt-in for individual API routes — most depend on Prisma (Node-only).
- Rewriting `analysis-service` payload shape — premature until logs show analytics is actually hot.

---

## Vercel MCP Findings (2026-05-14)

Companion to `docs/ROADMAP.md §Current Priorities`. The S-series digest is the system-of-record backlog (S1–S32). This section captures **only the signal that the Vercel MCP surfaces** — i.e. items that come from inspecting the live project, deployments, build logs, and runtime telemetry on Vercel itself, not from reading the codebase.

When a finding here overlaps an S-item, it appears in the [S-Series Re-Prioritization](#s-series-re-prioritization) table at the bottom — not as a duplicate F-item.

### Live Platform Snapshot (2026-05-14)

Captured via `mcp__plugin_vercel_vercel__*` against project `prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team `team_ImEsp9hzYaqzaPz5VmE6LTiW`). Use as a baseline for the next audit.

| Aspect                             | Observed value                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Framework / Node                   | Next.js 16.2.2 / Node 24.x / Turbopack bundler                                   |
| Function region                    | `sin1` (matches Neon `ap-southeast-1`)                                           |
| Build region                       | `iad1` (Washington DC) — fine, build is one-shot                                 |
| Latest prod deploy                 | `dpl_3J2mvqrYWANr68Nao6rASJV8fJD2` (commit `54ed7ce`, READY, 55 s build)         |
| Project flag                       | **`live: false`** in `get_project` response                                      |
| Domains                            | 5 × `*.vercel.app`, **no custom domain**                                         |
| Production runtime logs (last 7 d) | **Empty** (`No logs found` for all levels)                                       |
| Lambdas                            | 4 Node.js functions (`lambdaRuntimeStats: nodejs:4`)                             |
| Build cache                        | 295 MB uploaded; Turbopack compile 29.6 s; full deploy 55 s                      |
| Build warnings                     | 2 × `engines.node: ">=22"` auto-upgrade warning (resolved by F3)                 |
| Prisma                             | Client `7.8.0` generated in build (V3's 7.6.0 → 7.7.0 ask is moot)               |
| Routes shape                       | All app routes are PPR (`◐`) or Dynamic (`ƒ`); no fully static (`○`) page routes |

### MCP-Only Findings (F-series)

#### F1 — Production runtime logs empty for 7 days · 🔴 · Effort: investigate

`get_runtime_logs` (`environment: production`, last 7 d, all levels) returns `No logs found`. Two possibilities, both worth resolving:

- The cron snapshot at 21:30 UTC isn't firing → silent data loss (matches the worry behind S6 in `docs/ROADMAP.md`).
- The cron _is_ firing but logs are absent because no `console.*` calls run on the success path → observability blind spot (matches S4 in `docs/ROADMAP.md`).

This **elevates S5 + S6 + S4 to "do first in Tier 1"** — there is currently zero live signal that the daily snapshot pipeline is healthy.

**Action:** Verify in the Vercel dashboard (Functions → `/api/cron/snapshot` → Invocations) whether cron has fired in the last 7 days. If yes → ship S4 (logger) + S5 (`/api/health`) so the next 7 days produce evidence. If no → fix cron _before_ anything else.

#### F2 — `live: false` on the Vercel project · 🟡 · Effort: XS

`get_project` returns `"live": false`. Not user-visible; likely a Vercel-internal traffic/billing flag. Confirm via the dashboard whether it indicates "no traffic in N days" vs. a billing throttle. If it's a traffic indicator, it's consistent with F1.

**Action:** One-line check in the dashboard; document the resolved meaning in the [Vercel Platform](#vercel-platform) section above.

#### F3 — Pin `engines.node` to a specific major · ✅ Done 2026-05-14 · Effort: XS

Build log emitted twice:

> `Warning: Detected "engines": { "node": ">=22" } in your package.json that will automatically upgrade when a new major Node.js Version is released.`

Resolved — `package.json` now declares `"node": "24.x"`. Verify by inspecting the next deployment's build log: the warning should no longer appear.

#### F4 — S8 (CSP) is partly underway · ⚠️ status correction

Untracked file: `src/app/api/_csp/report/route.ts`. The `_` prefix means App Router treats it as a private folder (the route is not yet wired). Someone has already started scaffolding the CSP violation report endpoint that S8 calls for.

**Action:** S8's status in `docs/ROADMAP.md §Current Priorities` updated from ❌ → ⚠️ ("report endpoint scaffolded; header + nonce pipeline still missing"). Promote the route under a public path (e.g. `/api/csp/report`) once the header lands.

#### F5 — No custom domain on production traffic · 🟡 · Effort: S (one-time)

All 5 domains are `*.vercel.app`. Production traffic served from `assets-tracker-ct.vercel.app`. Not a problem today (personal project) but: subdomain on `vercel.app` means no SEO equity, no email-on-domain, and a confusing OAuth consent screen for any future user beyond the owner.

**Action:** If this stays a personal tool, ignore. If invite-anyone is on the roadmap, register a domain and add it to the project (Vercel handles cert).

#### F6 — Vercel Rolling Releases (canary deploys) · 🟡 · Effort: XS

Daily-deploy cadence (5 deploys to production yesterday alone) means a bad ship hits 100% of users instantly. **Rolling Releases** (GA June 2025) lets a deploy go to a configurable % first. Toggle in project settings; no code change.

**Action:** Enable in Vercel dashboard → Settings → Deployments → Rolling Releases. Set canary to 10% for 5 min. Pairs with S20 (Skew Protection) in `docs/ROADMAP.md` — both are XS dashboard toggles that meaningfully shrink deploy blast radius.

#### F7 — Vercel BotID on hot public endpoints · 🟡 · Effort: S

`/api/search` (Yahoo Finance symbol search) and `/api/auth/[...nextauth]` (Google sign-in) are unauthenticated or pre-auth. They're attractive bot-scraping targets that cost Yahoo Finance rate-limit budget. **BotID** (GA June 2025) ships invisible client-side bot detection; protect the routes via the BotID server SDK.

**Action:** Install BotID, gate `/api/search` first (lowest blast radius), then `/api/auth/*` after a week of telemetry. Free up to a quota.

#### F8 — Vercel Log Drain to long-term storage · 🟡 · Effort: S

Vercel default log retention is short. The 7-day `No logs found` query in F1 is partly bounded by retention. Set up a Log Drain to a cheap sink (Better Stack / Logtail / Axiom free tier) so the next time something silently breaks, you have history beyond the retention window.

**Action:** Vercel dashboard → Project → Logs → Drains → add HTTPS endpoint. Pairs naturally with S4 (logger) in `docs/ROADMAP.md` — the logger emits the lines, the drain persists them.

### S-Series Re-Prioritization

Driven by the F-series above. No items are removed — only urgency shifts.

| Item | Current S-tier | Recommended new tier                  | Reason                                                                                  |
| ---- | -------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| S5   | Tier 1         | Tier 1 — **do first**                 | F1: zero evidence cron is firing; need a healthcheck before adding any observability    |
| S6   | Tier 1         | Tier 1 — **do alongside S5**          | F1: paired with /api/health; without `CronRun` table no historical signal exists either |
| S4   | Tier 1         | Tier 1 — **promote ahead of S1 / S7** | F1: every other Tier-1 item benefits from having a logger first                         |
| S8   | Tier 1, ❌     | Tier 1, **⚠️ partial**                | F4: report endpoint already scaffolded                                                  |
| S20  | Tier 2         | Tier 1 — bundle with F6               | F6: both are XS dashboard toggles; logical to ship together                             |

### Cross-References

| Tracker                       | Items referenced here        |
| ----------------------------- | ---------------------------- |
| `docs/ROADMAP.md` (S-series)  | S4, S5, S6, S8, S20          |
| `docs/PLATFORM.md` (V-series) | V3 (moot), V8, V11, V14, V35 |

---

## Firewall Setup

Companion to `docs/firewall_rules.json`. Hobby plan allows **3 custom firewall rules**; the rule set below is consolidated to fit that cap. Rules 1 and 2 overlap intentionally (e.g. `/wp-admin/install.php` matches both) — the firewall short-circuits on first match, so duplication is harmless and gives redundant coverage.

Two paths to install: dashboard or REST API.

### A. Dashboard (recommended for first-time setup)

1. Open https://vercel.com/mike840609s-projects/asset-tracker/settings/firewall
2. Under **Custom Rules**, click **New Rule** and create each entry below in order.

#### Rule 1 — `block-extensions-and-dotfiles`

- **If**: Path, Matches Regex, value: `\.(php|aspx?|jsp|cgi|env|git|svn|htaccess|htpasswd)($|\?|/)`
- **Then**: Deny (403)
- **Why**: Broadest single rule. Catches `/wp-admin/install.php`, `/xmlrpc.php`, any `*.php`/`*.asp`/`*.aspx`/`*.jsp`/`*.cgi`, `/.env`, `/.git/config`, `/.svn/...`, `/.htaccess`, `/.htpasswd`. The app is Next.js — none of those extensions are legitimate routes.

#### Rule 2 — `block-bot-prefixes`

- **If**: Path, Matches Regex, value: `^/(wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc|cmd_|phpmyadmin|pma|adminer|vendor/phpunit|cgi-bin)`
- **Then**: Deny (403)
- **Why**: Catches what doesn't end in a tell-tale extension. `/cmd_sco` (observed 2026-05-17), `/wp-admin/`, `/wp-content/uploads/...`, `/phpmyadmin/`, `/adminer.php`, `/vendor/phpunit/...` would not be caught by rule 1 alone.

#### Rule 3 — `rate-limit-public-pages`

- **If**: Path, Matches Regex, value: `^/(login|privacy|terms)$` **AND** Method, Equals, value: `GET`
- **Then**: Rate Limit — **30 requests / 60 seconds per IP**
- **Why**: Addresses the 5×/sec `/privacy` bursts observed in the 2026-05-17 logs (a scraper grabbing sub-resources per page load) without blocking humans. 30 / 60s is well above any real user pattern.

Rules apply immediately on the edge — no deploy needed.

### B. REST API (for repeatable / scripted setup)

```bash
# Requires a Vercel token with Firewall scope.
export VERCEL_TOKEN=...   # never commit this
export TEAM_ID=team_ImEsp9hzYaqzaPz5VmE6LTiW
export PROJECT_ID=prj_soY30S7ki1x38gmeZXCancJD1PVA

# The Vercel REST docs describe the exact wire-format expected by the
# firewall config endpoint:
#   https://vercel.com/docs/rest-api/reference/endpoints/security
# The JSON in this repo is the conceptual spec, not the wire-format —
# you may need to transform `conditionGroup`/`action` to match the
# current API schema before POSTing.
curl -X POST "https://api.vercel.com/v1/security/firewall/config?teamId=${TEAM_ID}&projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @docs/firewall_rules.json
```

### Verification

After applying, wait ~2 min for edge propagation then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/wp-admin/install.php  # 403 (rules 1 & 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/cmd_sco                # 403 (rule 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/.env                   # 403 (rule 1)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/xmlrpc.php             # 403 (rules 1 & 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/anything.php           # 403 (rule 1)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/login                  # 200
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/                        # 302 (redirects to /login)
```

Then inspect:

- Dashboard → Project → Firewall → Logs — confirm those paths show as **Denied**.
- MCP runtime logs: `mcp__claude_ai_Vercel__get_runtime_logs source=["edge-middleware"] since=1d` — those paths should no longer appear (firewall is upstream of middleware).
- Track the resulting Active-CPU drop in Vercel → Project → Usage and record in `docs/LOG.md`.

### Drift management

The dashboard is the source of truth at runtime, but `firewall_rules.json` is the **review-able spec**. After any dashboard change, re-export and commit so the repo stays in sync. The `description` field on each rule is the trail explaining why it exists — keep it current.

If you need a 4th rule later (Pro plan or above), revisit the deleted rules from the original 5-rule draft (see git history for `firewall_rules.json`): a split `block-wordpress-probes` (rule 1 of the original) and a split `block-dotfile-and-source-probes` (rule 2 of the original) are good candidates to break out for clearer reporting.
