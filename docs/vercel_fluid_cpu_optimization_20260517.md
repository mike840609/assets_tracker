# Vercel Fluid CPU Optimization Plan (evidence-grounded)

_Author: planning pass on branch `20260517-optimize-vecel-fluid-cpu-usage`, 2026-05-17. Supersedes the earlier draft at `docs/codex_vercel_fluid_cpu_optimization_plan.md` (branch `codex/optimize-vercel-fluid-cpu-usage`), which was written before Vercel MCP runtime logs were inspected._

## Context

The project is on the Vercel **Hobby (Free)** plan. Monthly Fluid Function Active-CPU usage is approaching the included **4-hour** allowance, with little real human traffic. Goal: cut billed Active CPU by ≥50 % without UX regressions, so headroom returns before the next monthly window.

Two reasons the earlier draft needs revising:

1. It was written without live log data and over-weighted cron + refresh paths.
2. The Vercel MCP findings below show those paths are not the current bottleneck — bot traffic through middleware is.

## Evidence from Vercel MCP (last 7 days, production)

| Filter                                       | Result      |
| -------------------------------------------- | ----------- |
| `source=serverless`, env=production, 7d      | **0 logs**  |
| `source=edge-middleware`, env=production, 7d | **33 logs** |
| `query=snapshot`, env=production, 7d         | **0 logs**  |
| `query=timing`, env=production, 7d           | **0 logs**  |

Observed top paths (all edge-middleware): `/wp-admin/install.php` (302), `/cmd_sco` (302), `/privacy` (5× repeats in the same second, suggesting a scraper grabbing sub-resources per page load), `/login`, `/`. Production deployment at the time of audit: `dpl_7PdomFLHzWhy3YHAYsRF2UnqqAVD` on `astt.app`.

**Headline finding:** with current traffic, **bot/anonymous middleware invocations dominate billed CPU**. The cron, `refreshAllPrices`, and analytics page fires too rarely to be the primary cost. The earlier draft's #1 ("user-scope manual refresh") is correct in principle but won't move the needle until human traffic grows.

Caveats: Hobby-plan log retention is short and the 100-row MCP cap may under-sample; cron logs may have rolled out of the window since `30 21 * * *` daily fires can fall outside the 7-day sample. Items P5–P8 below still matter as protection against future growth — they're just lower priority right now.

## Code observations the logs do not show

- `src/proxy.ts:80-84` — matcher is broad: `/((?!api/cron|_next/static|...).*)`. Every bot probe to `/wp-admin/install.php`, `/cmd_sco`, `/.env`, etc. invokes `auth()` + locale-cookie write.
- `src/proxy.ts:5,44` — `NextAuth(authConfig)` runs JWT decode for **every** matched request, even routes that immediately 302 to `/login`.
- `src/lib/auth-session.ts:10` + `src/lib/api-handler.ts:8` — RSC and `withAuth` both call `auth()` again. React `cache()` dedups _within_ a render, not _across_ the middleware → page boundary, so each authenticated navigation pays **two JWT decodes**.
- `src/app/privacy/page.tsx:1` and `src/app/login/page.tsx:1` — both have a comment explaining `force-static` is not allowed under `cacheComponents: true`. They re-render dynamically each request, even for bot 5×-burst hits.
- `src/app/api/cron/snapshot/route.ts:51` + `src/lib/services/price-service.ts:208` — `refreshAllPrices` scans `Holding` distinct by symbol across **all users**, then batch upserts.
- `src/app/api/prices/refresh/route.ts:5` — manual refresh button calls the same global function.
- `src/components/dashboard/dashboard-actions.tsx:46-49` — every dashboard refresh fires **two** functions in parallel (`/api/prices/refresh` + `/api/exchange-rates/refresh`).
- `src/app/(main)/analysis/page.tsx:25` — analysis fans out 4 history reads on every load; cached via `"use cache"` but invalidated whenever the cron/refresh writes new snapshots.

## Prioritized changes

Ordered by **expected Active-CPU saved per change**, given the bot-dominated traffic profile observed in MCP.

### P1 — Tighten middleware matcher to skip bot/junk paths

**Effect:** Very high. Skips middleware entirely on the most common bot probes, returning a static 404 from the edge cache instead of running NextAuth + cookie logic. With 5+ rapid `/privacy` scrapes and repeated `/wp-admin/install.php` / `/cmd_sco` hits per day, this is the single biggest reduction.

- File: `src/proxy.ts` — extend the negative-lookahead in `config.matcher`.
- Add exclusions for: `wp-admin`, `wp-login`, `wordpress`, `xmlrpc.php`, `\\.env`, `\\.git`, `phpmyadmin`, `cgi-bin`, `cmd_`, `\\.well-known` (except `acme-challenge`), `robots.txt`, `sitemap.xml`, and anything with a file extension (`.*\\..*`).
- Optional: add a `public/robots.txt` so Vercel's edge cache absorbs the same paths.

**Pros:** Zero code-path change for legitimate users; meaningful instant savings; trivial to ship; no conflict with `cacheComponents`.
**Cons:** Tiny risk of accidentally excluding a real route — easy to mitigate with path anchors (`^/wp-admin`) and a smoke test.

### P2 — Add Vercel Firewall / WAF rules to drop bot probes at the edge

**Effect:** High. Even with a tighter matcher, the request still reaches Vercel's edge before being served. WAF/IP rules let Vercel return a 403 before any function (edge or serverless) is billed. This is the single most effective lever for the `/wp-admin*`, `/cmd_*`, `/xmlrpc.php` pattern in logs.

- Vercel dashboard → Project → Settings → Firewall → custom rules:
  - Block when `path` matches `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`, `/cmd_*`, `/.env*`, `/.git/*`.
  - Optional: rate-limit `/privacy` and `/login` per IP (e.g. 30 req/min) to absorb scrapers without hurting humans.

**Pros:** Stops billed work upstream of even edge middleware; configurable from the dashboard with no deploy; complements P1.
**Cons:** Rules live outside the repo (drift risk) — mitigate by exporting via the Vercel API and committing the JSON to `docs/`. Some firewall features (managed rulesets) need a paid plan; custom path-block rules are available on Hobby.

### P3 — Statically prerender `/privacy`, `/terms`, and the `/login` shell, and exclude them from middleware

**Effect:** High. The page-source comments rule out `force-static` because `cacheComponents: true` is project-wide, but the cheaper, lower-risk alternative is: keep PPR, and exclude these paths from the middleware matcher so the prebuilt shell is served from CDN without any middleware execution. The locale-cookie logic moves to first authenticated navigation instead.

- File: `src/proxy.ts` — add `/login`, `/privacy`, `/terms` to the matcher exclusion.
- Files: `src/app/privacy/page.tsx`, `src/app/login/page.tsx`, `src/app/terms/page.tsx` — keep PPR; move the dynamic island (e.g. `signIn` button) into a leaf client component so the shell is fully prerendered. Move the locale-cookie write into either the `/login` server action or the `(main)/layout.tsx` first render.

**Pros:** Removes one of the largest bot-traffic categories from billed CPU; legitimate users still get their locale cookie set on first authenticated navigation.
**Cons:** Need to re-verify locale-cookie still lands before the first user-visible page; the `/login` page reads `process.env.VERCEL_ENV` for the preview-only Credentials path, but env reads are cheap.

### P4 — Skip middleware JWT decode on requests that are obviously unauthenticated

**Effect:** Medium-High. Today middleware calls `auth()` for every non-excluded path, even when there is no session cookie at all. A fast `request.cookies.get(SESSION_COOKIE)` check before invoking NextAuth can short-circuit anonymous requests to the redirect path without JWT crypto work.

- File: `src/proxy.ts`. Replace the `default auth((req) => …)` wrapping with a plain `default function middleware(req)` that:
  1. Cheap path: if path is public and there is no session cookie → just `NextResponse.next()`.
  2. If a session cookie exists, call `auth(req)` to validate (only then pay JWT decode).
  3. Keep the `/api/auth/*` rate limit and locale-cookie write.

**Pros:** Removes the biggest per-request cost (JWT decode) from any bot traffic that survives P1/P2. Predictable, no UX change.
**Cons:** Need to keep the session-cookie name in sync with NextAuth (`__Secure-authjs.session-token` in prod, `authjs.session-token` in dev). Extract to a single constant.

### P5 — Collapse the dashboard "refresh" button into one user-scoped function

**Effect:** Medium per click; grows in importance as user traffic grows.

- File: `src/components/dashboard/dashboard-actions.tsx:46-49`. Today: two fetches in parallel (`/api/prices/refresh` + `/api/exchange-rates/refresh`).
- New: `POST /api/refresh` that internally fetches **only the symbols held by the requesting user** and the rates for the user's `baseCurrency`. Reuse `getAllExchangeRates` cache instead of re-fetching.
- Implementation hint: pull symbols via `prisma.holding.findMany({ where: { account: { userId } }, select: { symbol: true, assetType: true }, distinct: ["symbol"] })`; pass to existing `fetchStockPrices` / `fetchCryptoPrices`.

**Pros:** One function invocation instead of two; CPU scales O(user) not O(DB); also fixes the partial-error UX referenced in commit `f0ccd5488`.
**Cons:** Small refactor (new route + delete old route consumers); cron still uses the global `refreshAllPrices` path.

### P6 — Gate the cron's `revalidateTag` calls on "anything-changed"

**Effect:** Medium. Today the cron unconditionally invalidates `net-worth`, `prices:crypto`, `snapshots`, and a per-user `history:${user.id}` tag for every user. Every invalidation forces the **next** page load to rebuild via expensive RSC reads — wasted Active CPU on days when no prices actually moved.

- File: `src/app/api/cron/snapshot/route.ts:53-74`.
- Hash the result of `refreshAllPrices` / `createSnapshot` per user; only invalidate when the new total net-worth differs from yesterday's snapshot by more than a small epsilon (e.g. 0.01 in base currency), or when option expirations were processed.

**Pros:** Removes a daily cold-rebuild cost across all cached RSC reads; aligns invalidation with actual change.
**Cons:** Adds branching that must be tested — a missed invalidation could surface stale prices on the dashboard for up to 24 h. Mitigate by keeping the per-user `history:${id}` invalidation always-on (cheap) and gating only the heavyweight `net-worth` + `prices:crypto`.

### P7 — Remove RSC double-auth for protected pages

**Effect:** Low-Medium per request. Middleware decodes the JWT; `getSession()` decodes it again at the page layer. Across heavy navigations (dashboard, `accounts/[id]`, analysis, history) this is 2× the JWT cost per request.

- Files: `src/lib/auth-session.ts` and `src/proxy.ts`.
- Have middleware attach the decoded userId to a request header (e.g. `x-user-id`), trusted because it was set after middleware decoded the JWT itself. Then `getSession()` reads the header instead of re-decoding (still validates the session cookie is present, but skips crypto).
- Alternative: set a short-lived `x-session-uid` cookie from middleware that the RSC reads with `cookies()`. Either way, gate strictly behind same-origin.

**Pros:** Halves auth CPU for every authenticated page render.
**Cons:** Introduces a "trusted header" pattern — needs care so it can't be spoofed. Vercel strips inbound `x-*` headers in production by default, but document the invariant clearly. NextAuth v5 doesn't ship this pattern out of the box.

### P8 — Cache `yahoo-finance2` module + class instance at module scope

**Effect:** Low. `price-service.ts:73-74`, `search/route.ts:79-80`, `options/chain/route.ts:44-45` each do `await import("yahoo-finance2")` and `new YahooFinance()` per call. Node's ESM cache makes the second import a no-op, but instantiating a new class per call still allocates state.

- Add `src/lib/yahoo.ts` exporting a `const yf = new YahooFinance()` singleton; update the three callers to import it.

**Pros:** Slightly lower per-call CPU/allocation; cleaner code; warm HTTP keep-alive across Fluid invocations.
**Cons:** Minor — singletons can hold internal state across requests; in Fluid that's actually a benefit.

### P9 — (Defensive, do NOT ship yet) keep-warm pinger

**Effect:** Defensive only. Cold starts cost more than warm execution on Fluid, but warming itself costs Active CPU. Only worth revisiting **after** P1–P4 land — measure first.

**Recommendation:** **do not add a warmer.** Rely on P1–P4 to keep total work low.

## Recommended execution order

1. **P1 + P2 together (same PR):** tighten middleware matcher and add Vercel firewall rules. These two account for most of the observed traffic.
2. **P3:** statically serve `/login`, `/privacy`, `/terms` and exclude from middleware.
3. **P4:** short-circuit anonymous middleware passes before invoking NextAuth.
4. **P5:** user-scope the refresh button + collapse to one fetch.
5. **P6 + P7:** invalidation gating + RSC auth dedup.
6. **P8:** singleton Yahoo client.

After P1–P3 land, re-pull MCP logs for 3 days and recompute the Active-CPU trajectory before deciding whether P4–P7 are still needed.

## Critical files

| Item                                 | Files                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1, P3, P4, P7 (header pass-through) | `src/proxy.ts`                                                                                                                                                                                   |
| P7                                   | `src/lib/auth-session.ts`, `src/lib/api-handler.ts`                                                                                                                                              |
| P3                                   | `src/app/privacy/page.tsx`, `src/app/login/page.tsx`, `src/app/terms/page.tsx`                                                                                                                   |
| P5                                   | `src/app/api/prices/refresh/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`, `src/components/dashboard/dashboard-actions.tsx`, `src/lib/services/price-service.ts` (`refreshAllPrices`) |
| P6                                   | `src/app/api/cron/snapshot/route.ts`                                                                                                                                                             |
| P8                                   | `src/lib/services/price-service.ts`, `src/app/api/search/route.ts`, `src/app/api/options/chain/route.ts`, new `src/lib/yahoo.ts`                                                                 |
| P2                                   | None in repo (managed in Vercel dashboard; export JSON to `docs/firewall_rules.json` for tracking)                                                                                               |

## Verification

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

## Out of scope (intentionally skipped)

- Switching the JWT session strategy to database sessions — would _increase_ CPU on every page load.
- Migrating off Hobby — the user explicitly wants to stay on Free.
- Edge-runtime opt-in for individual API routes — most depend on Prisma (Node-only).
- Rewriting `analysis-service` payload shape — premature until logs show analytics is actually hot.
