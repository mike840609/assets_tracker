# Assets Tracker — Infrastructure

This file consolidates two former docs: `VERCEL_ANALYSIS.md` (V1–V33, Vercel platform audit) and `RELEASE_READINESS.md` (R1–R26, pre-launch checklist).

---

## Vercel Platform

Findings sourced from the Vercel MCP connector against project `prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team `team_ImEsp9hzYaqzaPz5VmE6LTiW`) across three audit passes: 2026-04-17, 2026-04-18, and 2026-04-19.

| #   | Suggestion                                                                                                                                            | Category                 | Impact    | Effort  | Status                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------- | ------- | ---------------------- |
| V1  | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16 convention)                                                                                   | Deprecation              | 🟢 Low    | 10 min  | ✅ Done                |
| V2  | Remove duplicate `prisma generate` (postinstall + build)                                                                                              | Build Perf               | 🟢 Low    | 5 min   | ✅ Done                |
| V3  | Upgrade `prisma` + `@prisma/client` 7.6.0 → 7.7.0                                                                                                     | Maintenance              | 🟢 Low    | 10 min  | ⚠️ Partial             |
| V4  | Set `maxDuration: 60` for `/api/cron/snapshot` in `vercel.json`                                                                                       | Reliability              | 🔴 High   | 10 min  | ✅ Done                |
| V5  | Pin `regions` in `vercel.json` to match Neon region (`sin1`)                                                                                          | Performance              | 🟡 Medium | 15 min  | ✅ Done                |
| V6  | Hover/viewport prefetch in sidebar (replace eager all-routes prefetch)                                                                                | Performance              | 🟡 Medium | 30 min  | ✅ Done                |
| V7  | Suppress yahoo-finance2 consent notices in `price-service.ts`                                                                                         | Observability            | 🟢 Low    | 15 min  | ❌ Not Done            |
| V8  | Evaluate edge runtime for `/api/search` + `/api/exchange-rates`                                                                                       | Performance              | 🟡 Medium | 1-2 hrs | ⚠️ Blocked (see notes) |
| V9  | Verify `@vercel/speed-insights` + `@vercel/analytics` are mounted                                                                                     | Observability            | 🟢 Low    | 15 min  | ✅ Done                |
| V10 | Add `/api/health` endpoint                                                                                                                            | Observability            | 🟡 Medium | 30 min  | ❌ Not Done            |
| V11 | Verify Vercel Cron `/api/cron/snapshot` is firing daily                                                                                               | Reliability              | 🔴 High   | 15 min  | ❌ Not Done            |
| V12 | Structured error logging in `price-service.ts`                                                                                                        | Observability            | 🟡 Medium | 1 hr    | ❌ Not Done            |
| V13 | Add baseline security headers (HSTS, X-CTO, XFO, Referrer-Policy, Permissions-Policy)                                                                 | Security                 | 🔴 High   | 1 hr    | ✅ Done                |
| V14 | Add CSP (Report-Only first, then enforce)                                                                                                             | Security                 | 🔴 High   | 2-3 hrs | ❌ Not Done            |
| V15 | Audit & shrink `.next/cache` (currently 292 MB)                                                                                                       | Build Perf               | 🟢 Low    | 1 hr    | ❌ Not Done            |
| V16 | React `cache()` wrap for `/accounts/[id]` reads + audit `<Link prefetch>` to stop 5–8× burst                                                          | Performance              | 🔴 High   | 45 min  | ❌ Not Done            |
| V17 | `Cache-Control` + `"use cache"` / `cacheTag("exchange-rates")` on `/api/exchange-rates`                                                               | Performance              | 🟡 Medium | 20 min  | ❌ Not Done            |
| V18 | Opt `/analysis` and `/history` into PPR with `"use cache"` + `cacheTag`                                                                               | Performance              | 🟡 Medium | 1 hr    | ❌ Not Done            |
| V19 | Dynamic-import `AllocationChart` + `CurrencyExposureChart` like `TrendChart`                                                                          | Bundle                   | 🟡 Medium | 30 min  | ✅ Done                |
| V20 | `Cache-Control: public, max-age=31536000, immutable` for `/public/*`                                                                                  | Performance              | 🟢 Low    | 15 min  | ❌ Not Done            |
| V21 | Audit `revalidateTag` after `POST /accounts`, `/holdings`, `/transactions`                                                                            | Performance              | 🟡 Medium | 1–2 hrs | ❌ Not Done            |
| V22 | Add `@next/bundle-analyzer` + baseline dashboard RSC payload                                                                                          | Observability            | 🟢 Low    | 30 min  | ⚠️ Partial             |
| V23 | Reserve `min-h` / `aspect-ratio` on chart cards (CLS fix)                                                                                             | Speed Insights · CLS     | 🔴 High   | 30 min  | ❌ Not Done            |
| V24 | Preload Geist Sans `.woff2` + `content-visibility: auto` on below-fold cards                                                                          | Speed Insights · LCP/FCP | 🟡 Medium | 45 min  | ✅ Done                |
| V25 | `startTransition` + memoize privacy/theme-toggle consumers                                                                                            | Speed Insights · INP     | 🟡 Medium | 1 hr    | ✅ Done                |
| V26 | Extend V18's PPR pattern to `/settings` and `/` (per-user cache key)                                                                                  | Speed Insights · TTFB    | 🟡 Medium | 1–2 hrs | ✅ Done                |
| V27 | Convert `/`, `/accounts`, `/analysis`, `/history`, `/settings` from `ƒ` → `◐` by adding the Next.js 16 `"use cache"` directive to service-layer reads | Speed Insights · TTFB    | 🔴 High   | 1–2 hrs | ✅ Done                |
| V28 | `<link rel="preconnect" href="https://va.vercel-scripts.com" crossOrigin="anonymous">` for Analytics + Speed Insights                                 | Speed Insights · LCP/FCP | 🟢 Low    | 5 min   | ✅ Done                |
| V29 | Re-enable SSR for `AllocationChart` + `CurrencyExposureChart` (drop `ssr: false`)                                                                     | Speed Insights · LCP     | 🟡 Medium | 30 min  | ✅ Done                |
| V30 | Wrap `router.refresh()` + inline-edit state setters in `startTransition` across transaction/holding mutators                                          | Speed Insights · INP     | 🟡 Medium | 45 min  | ✅ Done                |
| V31 | Add `next.config.ts` `images.formats = ["image/avif", "image/webp"]` + `remotePatterns` for `lh3.googleusercontent.com`                               | Speed Insights · LCP     | 🟢 Low    | 15 min  | ✅ Done                |
| V32 | Configure `<SpeedInsights beforeSend={…}>` to drop `/login` + `/privacy` from telemetry                                                               | Observability            | 🟢 Low    | 15 min  | ✅ Done                |
| V33 | Ship `@next/bundle-analyzer` (supersedes V22) — prerequisite for measuring any further client-JS Speed Insights wins                                  | Observability            | 🟢 Low    | 30 min  | ⚠️ Partial             |

### Key Build-log Findings (2026-04-17)

Deployment `dpl_3KqPj4qBr3ZojdDaSxtKvo8iNhC2` (44s total, 292 MB build cache):

1. **Deprecated middleware convention.** `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` The repo still has `src/middleware.ts`.
2. **Prisma minor out of date.** Every build prints a 7.6.0 → 7.7.0 upgrade banner.
3. **Duplicate `prisma generate` (resolved 2026-04-26).** `vercel.json` now pins `buildCommand: "npm run build:vercel"` (= `prisma migrate deploy && next build`).
4. **Large build cache (292 MB).** Upload takes ~4s.

### Key Runtime-log Findings (production, 7d)

1. **Zero error/fatal/5xx/404 logs** in the sampled window.
2. **Sidebar prefetch storm.** On every navigation, the sidebar fires RSC prefetches to `/`, `/accounts`, `/analysis`, `/history`, `/settings` — each with 3–5 duplicate hits in the same second.
3. **Account detail fired 3× per navigation.** `/accounts/[id]` hit three times for the same ID within one second.
4. **Yahoo Finance consent notice** leaks into logs on every `POST /api/prices/refresh`.
5. **No `/api/cron/snapshot` hits in log window.** Either the Vercel Cron isn't firing, runtime logs filter it, or runs land outside the sampled window.
6. **No `/api/health` endpoint exists**.

### Detailed Enhancement Write-ups (V1–V33)

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

**V15 — Audit & shrink `.next/cache`.** Build cache is 292 MB; upload cost is ~4s per deploy. Run `du -sh .next/cache/*` locally; candidates for exclusion: `.next/cache/swc`, `.next/cache/webpack` (not used under Turbopack). Critical files: `.vercelignore`.

**V16 — Dedupe `/accounts/[id]` reads.** Factor the lookup into `src/lib/services/account-service.ts` with `cache()` wrapper. Audit `accounts-list.tsx` — if each row renders `<Link prefetch={true}>` on hover, drop to `prefetch={false}`. Critical files: `src/app/(main)/accounts/[id]/page.tsx`, `src/lib/services/account-service.ts` (new), `src/components/accounts/accounts-list.tsx`.

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

---

## Release Readiness (Pre-Launch)

Findings sourced against Vercel project on **2026-04-24**. Scope: only **launch blockers or high-risk gaps**. Performance and nice-to-have work tracked in the Performance section is not duplicated here.

| #   | Suggestion                                                                           | Category           | Impact    | Effort    | Status                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | ------------------ | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Add baseline security headers (HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy) | Security           | 🔴 High   | 1 hr      | ✅ Done                                                                                                                                         |
| R2  | Content-Security-Policy (Report-Only → enforce)                                      | Security           | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                                                     |
| R3  | Rate limit `/api/search`, `/api/exchange-rates`, `/api/auth/*`                       | Security           | 🔴 High   | 2–3 hrs   | ✅ Done                                                                                                                                         |
| R4  | `crypto.timingSafeEqual` compare for `CRON_SECRET`                                   | Security           | 🟡 Medium | 15 min    | ❌ Not Done                                                                                                                                     |
| R5  | Enforce account/holding ownership on every mutation route                            | Security           | 🔴 High   | 1–2 hrs   | ✅ Done — `transactions/route.ts` and `cash-transactions/route.ts` now use `withAuth` + `{ id, userId }` ownership filter. _(Fixed 2026-05-08)_ |
| R6  | Add `/terms` (Terms of Service) page                                                 | Legal / Compliance | 🔴 High   | 1–2 hrs   | ✅ Done                                                                                                                                         |
| R7  | Cookie / analytics consent banner                                                    | Legal / Compliance | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                                                     |
| R8  | GDPR data-export + delete-account flows                                              | Legal / Compliance | 🔴 High   | 2–3 hrs   | ❌ Not Done                                                                                                                                     |
| R9  | Verify Google OAuth consent screen is published & verified                           | Legal / Compliance | 🔴 High   | 30 min    | ✅ Done                                                                                                                                         |
| R10 | Add support/contact email in footer + `/privacy`                                     | Legal / Compliance | 🟡 Medium | 15 min    | ❌ Not Done                                                                                                                                     |
| R11 | Add `error.tsx`, `global-error.tsx`, `not-found.tsx`                                 | Reliability        | 🔴 High   | 1–2 hrs   | ❌ Not Done                                                                                                                                     |
| R12 | Add `/api/health` endpoint                                                           | Reliability        | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                                                     |
| R13 | Verify Vercel Cron `/api/cron/snapshot` fires daily in production                    | Reliability        | 🔴 High   | 15 min    | ❌ Not Done                                                                                                                                     |
| R14 | Timeout + retry guards on Yahoo Finance / CoinGecko calls                            | Reliability        | 🔴 High   | 30–60 min | ✅ Done                                                                                                                                         |
| R15 | Switch Prisma `db push` → `migrate deploy` (committed migrations)                    | Reliability        | 🔴 High   | 2–3 hrs   | 🟡 Partial — `prisma/migrations/` committed; `build:vercel` runs `prisma migrate deploy`; baselining pending                                    |
| R16 | Document Neon backup / PITR SLA in `README.md`                                       | Reliability        | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                                                     |
| R17 | Ship Sentry (or equivalent) for error aggregation + alerts                           | Observability      | 🔴 High   | 1–2 hrs   | ❌ Not Done                                                                                                                                     |
| R18 | Structured logging via `pino` with `userId` / `requestId` context                    | Observability      | 🟡 Medium | 3–4 hrs   | ❌ Not Done                                                                                                                                     |
| R19 | On-call playbook (Vercel log queries + baselines) in `README.md`                     | Observability      | 🟡 Medium | 45 min    | ❌ Not Done                                                                                                                                     |
| R20 | `.github/workflows/ci.yml` — lint + `tsc --noEmit` + `next build` on PR              | Testing / CI       | 🔴 High   | 1 hr      | ✅ Done                                                                                                                                         |
| R21 | Playwright smoke E2E — login, create account+holding, view dashboard                 | Testing / CI       | 🔴 High   | 4–6 hrs   | ✅ Done                                                                                                                                         |
| R22 | In-app help / FAQ modal + support link                                               | Product            | 🟡 Medium | 2–3 hrs   | ❌ Not Done                                                                                                                                     |
| R23 | Non-destructive data import (merge, not overwrite)                                   | Product            | 🔴 High   | 3–4 hrs   | ❌ Not Done                                                                                                                                     |
| R24 | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16)                             | Platform Config    | 🟢 Low    | 10 min    | ✅ Done                                                                                                                                         |
| R25 | Add `public/robots.txt` + `/sitemap.xml`                                             | Platform Config    | 🟡 Medium | 30 min    | ❌ Not Done                                                                                                                                     |
| R26 | Flip Vercel project `live: true` ONLY after R1–R14 land                              | Platform Config    | 🔴 High   | 5 min     | ❌ Not Done                                                                                                                                     |

### Security (R1–R5)

**R1** — Baseline security headers: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. ✅ Done. See also V13.

**R2** — Content-Security-Policy: ship in two stages — `Content-Security-Policy-Report-Only` for 48 h with `report-uri`, review violations, then flip to enforced. Allowlist must cover Google OAuth, Vercel Analytics + Speed Insights, self-hosted fonts. See V14.

**R3** — Rate limiting: `/api/search`, `/api/exchange-rates`, and `/api/auth/*` accept unbounded request volume. Add a token bucket keyed by `x-forwarded-for` + `session.user.id`. ✅ Done.

**R4** — Timing-safe `CRON_SECRET` comparison: `src/app/api/cron/snapshot/route.ts` compares the bearer token with `!==` (short-circuits on first byte mismatch, leaks secret length via timing). Replace with `crypto.timingSafeEqual` on equal-length buffers.

**R5** ⚠️ Partial — Ownership checks partially in place. `src/app/api/accounts/[id]/holdings/route.ts` and `src/app/api/accounts/[id]/route.ts` (PATCH/DELETE) both validate `account.userId === session.user.id`. **Still missing:** `src/app/api/accounts/[id]/transactions/route.ts` and `src/app/api/accounts/[id]/cash-transactions/route.ts` — these routes access transactions via `accountId` param without verifying the account belongs to the session user. Patch pattern: fetch the parent `Account` row and assert `account.userId === userId` before proceeding. Must be closed before opening signups. _(Audited 2026-05-08)_

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

**R20** — `.github/workflows/ci.yml`: run `npm ci`, `npx prisma generate`, `npm run lint`, `npx tsc --noEmit`, `next build` on every PR. Fails red → blocks merge. ✅ Done.

**R21** — Playwright smoke E2E: cover (1) unauth → login → `/`, (2) create account → add holding → holding appears, (3) dashboard loads with net-worth card + trend chart. ✅ Done.

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
