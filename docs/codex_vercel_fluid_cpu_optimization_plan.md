# Vercel Fluid CPU Optimization Plan

## Context

This app is currently deployed on the Vercel Hobby plan, and the immediate concern is that monthly Vercel Functions usage on Fluid is approaching the included Active CPU allowance.

This plan is based on repository and deployment-config inspection in this workspace. Live Vercel MCP runtime logs were not available in-session, so the findings below distinguish between:

- Observed in code/config
- Needs verification in production

Relevant deployment context already visible in the repo:

- `vercel.json` configures a daily cron job and extended max durations for refresh-heavy routes.
- The project is structured around Next.js App Router server components plus several API routes that refresh prices, exchange rates, and snapshots.

## Implementation Status (Updated)

Last updated: 2026-05-18.

- ✅ Milestone A shipped:
  - Manual refresh route `/api/prices/refresh` is now user-scoped (`refreshPricesForUser`) instead of global symbol refresh.
  - API requests are excluded from `proxy.ts` matcher (`api/`), so route-level auth (e.g. `withAuth`) owns API authorization checks.
- ✅ Milestone B shipped:
  - Analysis page now uses a cached aggregate payload (`getCachedAnalysisPayload`) with a 5-minute revalidation window and user-scoped cache tags.
- ⏳ Still pending production verification:
  - Measure before/after Active CPU by function family in Vercel runtime logs.
  - Confirm no API routes lost intended behavior by moving auth responsibility to handlers only.
  - Validate analysis cache hit-rate and invalidation behavior under real write traffic.

## Key Findings

Observed in code/config:

- ✅ Manual refresh global-work issue addressed by splitting user-scoped manual refresh from global refresh logic.
- The daily cron snapshot flow still bundles several CPU-heavy operations into a single function: expired option sweeping, global price refresh, per-user snapshot creation, and cache invalidation.
- ✅ Duplicate auth execution on API requests addressed by excluding `/api/*` from proxy and using route-level auth.
- ✅ Analysis payload recomputation addressed for analysis page through aggregate caching.
- Some render paths can still trigger exchange-rate resolution work at request time, which increases CPU variance and makes cold or invalidated requests more expensive.

Needs verification in production:

- Which function family is the dominant consumer of Active CPU: interactive refreshes, the daily cron, analytics page requests, or noisy auxiliary endpoints such as search/options.
- How often users trigger refresh actions compared with the scheduled cron path.
- Whether cache invalidation patterns are causing a meaningful number of expensive recomputations after writes.

## Prioritized Optimization Plan

| Priority | Suggestion                                                                         | Status                | Expected Effect | Pros                                                                                                                   | Cons                                                                                    |
| -------- | ---------------------------------------------------------------------------------- | --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1        | Split interactive refresh from global refresh and make manual refresh user-scoped. | ✅ Shipped             | Very high       | Cuts the most obvious source of over-broad work; aligns CPU usage with the current user instead of total dataset size. | Requires separate code paths for cron/global refresh vs. manual/user refresh.           |
| 2        | Reduce duplicate auth execution on API routes.                                     | ✅ Shipped             | High            | Lowers CPU on every protected API call; simplifies the request path.                                                   | Requires careful review of which routes remain protected by proxy vs. route-level auth. |
| 3        | Cache or precompute analysis, goals, and projection payloads.                      | ✅ Partial (analysis)  | High            | Reduces repeated full-history recomputation; stabilizes heavy page requests.                                           | Adds invalidation complexity and may introduce bounded staleness.                       |
| 4        | Remove render-time FX fetching and rely on prepared cached rates.                  | ⏳ Pending             | High            | Makes request CPU more predictable; avoids external-rate work inside render paths.                                     | Rates may be slightly stale until the next refresh/cron cycle.                          |
| 5        | Narrow invalidation from global tags to per-user tags where applicable.            | ⏳ Pending             | Medium          | Reduces avoidable recomputation after writes and refreshes.                                                            | Requires consistent cache-tag ownership across routes and services.                     |
| 6        | Rework broad price-cache access patterns if symbol count grows.                    | ⏳ Pending             | Medium          | Prevents dataset-wide filtering from scaling poorly as the portfolio universe expands.                                 | May trade some shared-cache simplicity for more targeted queries.                       |
| 7        | Reduce noisy search/options traffic with tighter client behavior and caching.      | ⏳ Pending             | Low/Medium      | Lowers avoidable function invocations from typing-driven lookups and options-chain fetches.                            | Small UX tradeoffs if debounce/min-length rules get stricter.                           |
| 8        | Add timing logs around CPU-heavy paths for future verification.                    | ⏳ Pending             | Low/Medium      | Makes later Vercel log review evidence-based and helps rank follow-up work.                                            | Small logging overhead and some noise if not curated.                                   |

## Recommended Execution Order

1. ✅ User-scope manual refresh endpoints.
2. ✅ Remove API double-auth.
3. ✅ Cache or materialize analytics payloads (analysis page aggregate cache shipped).
4. Eliminate render-time FX fetching.
5. Revisit invalidation scope and noisy auxiliary endpoints.

## Next Verification Checklist

1. Compare CPU time and invocation count for:
   - `/api/prices/refresh` before vs after user-scoping.
   - analysis page requests before vs after aggregate cache rollout.
2. Audit API routes for explicit auth enforcement (`withAuth` or equivalent), now that proxy excludes `/api/*`.
3. Validate cache invalidation behavior by exercising:
   - account/holding writes
   - snapshot creation flow
   - price refresh path

## References

- [Vercel Hobby plan](https://vercel.com/docs/accounts/plans/hobby)
- [Fluid compute pricing](https://vercel.com/docs/edge-middleware/usage-and-pricing)
- [Vercel limits overview](https://vercel.com/docs/limits/overview)
