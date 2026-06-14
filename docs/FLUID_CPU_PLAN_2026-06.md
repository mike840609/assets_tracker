# Fluid Active CPU Reduction Plan - June 2026

Last updated: 2026-06-14

This document consolidates the 2026-06-13 re-audit with the 2026-06-14
implementation plan. It supersedes the standalone
`docs/FLUID_ACTIVE_CPU_REDUCTION_PLAN.md` draft.

## Goal

The project runs on Vercel Hobby, which includes 4h of Fluid Active CPU per
month. The target is to keep the rolling forecast below 3h/month, leaving at
least 1h of headroom, without changing the user-facing refresh cadence or
upgrading plans.

Fluid Active CPU is CPU time spent executing code, not wall-clock time waiting on
external HTTP or database I/O. The highest-value levers in this branch are
avoiding duplicate auth work and preventing cache invalidations that force cold
recomputation.

## Current Evidence

Vercel Usage for May 15-Jun 14, 2026 showed:

| Source                 |      Usage | Share |
| ---------------------- | ---------: | ----: |
| Vercel Functions       |     1h 28m | 68.8% |
| Proxy / middleware     |     40m 9s | 31.2% |
| Total Fluid Active CPU | 2h 8m / 4h | 53.7% |

Additional findings:

- Runtime logs sampled from production show clustered authenticated page renders
  across `/`, `/accounts`, `/goals`, `/stocks`, `/analysis`, `/projections`,
  `/settings`, and `/history`.
- Logs also show repeated slow `User.findUnique` auth existence checks.
- Observability Plus is not enabled, so route-level Vercel metrics are
  unavailable on Hobby.
- The latest production deployment runs Vercel Functions in `sin1`, matching the
  Neon Singapore region. A region change is not part of this plan.
- The earlier 2026-06-13 audit also found that the May bot-probe storm had been
  reduced by the matcher and firewall work, so this plan keeps bot defenses in
  place but focuses on app-origin CPU.

## Status Of Existing P/C Items

| Item  | Lever                                                             | Status                     |
| ----- | ----------------------------------------------------------------- | -------------------------- |
| P1/P2 | Middleware matcher and firewall rules for bot/junk paths          | Done                       |
| P3    | Static public `/login`, `/privacy`, `/terms` flow                 | Done                       |
| P4    | Anonymous no-session fast path before NextAuth                    | Done                       |
| P5    | Unified user-scoped `/api/refresh`                                | Done                       |
| P6/C2 | Gate cron cache invalidation on actual market-data changes        | Implemented in this branch |
| P7/C6 | Reduce page-layer duplicate auth work with a trusted Proxy header | Implemented in this branch |
| P8    | Singleton Yahoo client                                            | Done                       |
| P9/C7 | Keep-warm pinger                                                  | Rejected                   |

## Implemented Changes

### 1. Avoid duplicate page-layer JWT decode

- Proxy validates the session cookie once through NextAuth.
- After validation, Proxy overwrites internal auth headers and forwards only the
  trusted user id to the app render.
- Page auth reads that server-written header first, then confirms the user still
  exists in the database.
- Client-supplied `x-asset-user-id` and `x-asset-auth-source` headers are
  stripped before Proxy forwards the request.
- API routes keep their existing `withAuth` flow and do not trust the Proxy
  header.

Expected effect: authenticated page renders skip the second JWT decode while
preserving the database existence check and stale-session fallback.

### 2. Gate market-data cache invalidation on actual value changes

- Price refresh results report both `updated` rows and `changed` rows.
- Exchange-rate refresh results report both `updated` forward rates and
  `changed` persisted rows.
- Cron logs `cron.revalidate.gate` with prices/rates updated and changed counts.
- Cron only revalidates broad `prices`, `prices:crypto`, `exchange-rates`, and
  `net-worth` tags when values actually changed.
- Manual refresh and stock-watch refresh use `changed` for cache busting and
  client `router.refresh()` decisions.
- Snapshot and per-user history invalidation still run after snapshot rows are
  written.

Expected effect: daily cron and manual refreshes no longer force cached reads to
recompute when external providers return the same values.

### 3. Add DB-backed FX freshness for cold Fluid instances

- Manual FX refresh first checks the in-process freshness map.
- On cold instances, it now checks the latest persisted `ExchangeRate.updatedAt`
  for the base currency before calling external FX APIs.
- Cron still uses `force: true`, because snapshots should be based on the latest
  available rates.

Expected effect: cold or newly scaled Fluid instances skip unnecessary external
FX fetches when the database already has fresh rates.

## Remaining Operational Checks

These are not required before merging the code changes, but they should be used
to confirm the source of any remaining Fluid Active CPU after deployment.

- Record the new rolling 30-day Vercel Usage baseline in `docs/LOG.md` after the
  next production deploy.
- Review Vercel Usage for 24-72 hours and compare the daily run rate against the
  May 15-Jun 14 baseline.
- Confirm whether anything polls `/api/health`, and reduce the interval or split
  liveness/readiness if it is frequent.
- Confirm production Sentry tracing/profiling env vars are unset or `0`.
- Keep production deploys batched where possible, because each production deploy
  resets deployment-local render caches.

## Verification

Run before deploy:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
```

Manual checks:

- Run the snapshot cron twice with unchanged market data. The second run should
  log `cron.revalidate.gate` with `pricesChanged: 0` and `ratesChanged: 0`, and
  should skip broad market-data revalidation.
- Send a request with forged `x-asset-user-id` and confirm it does not
  authenticate without a valid session cookie.

Success criteria:

- The 24-72 hour post-deploy Fluid Active CPU run rate drops by at least 35%.
- The rolling monthly forecast stays below 3h.
- Signed-out redirects, signed-in dashboard access, manual refresh, and daily
  snapshot creation keep working.

## Do Not Do

- Do not add a keep-warm ping. It spends Fluid Active CPU without user value.
- Do not move functions away from `sin1` unless the database region changes.
- Do not trust client-supplied auth headers in route handlers or Server Actions.
- Do not switch to database sessions as a CPU fix; it would add per-render DB
  work.
- Do not upgrade plans as the first fix; reduce avoidable CPU before buying more
  quota.
