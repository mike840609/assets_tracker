# Vercel Fluid CPU Optimization Plan

## Context

This app is currently deployed on the Vercel Hobby plan, and the immediate concern is that monthly Vercel Functions usage on Fluid is approaching the included Active CPU allowance.

This plan is based on repository and deployment-config inspection in this workspace. Live Vercel MCP runtime logs were not available in-session, so the findings below distinguish between:

- Observed in code/config
- Needs verification in production

Relevant deployment context already visible in the repo:

- [vercel.json](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/vercel.json:1) configures a daily cron job and extended max durations for refresh-heavy routes.
- The project is structured around Next.js App Router server components plus several API routes that refresh prices, exchange rates, and snapshots.

## Key Findings

Observed in code/config:

- Manual refresh currently appears to trigger global work instead of user-scoped work. The interactive refresh UI calls `/api/prices/refresh`, and the underlying refresh logic loads every distinct symbol in the database rather than only the current user's holdings. See [src/components/dashboard/dashboard-actions.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/components/dashboard/dashboard-actions.tsx:42) and [src/lib/services/price-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/price-service.ts:208).
- The daily cron snapshot flow bundles several CPU-heavy operations into a single function: expired option sweeping, global price refresh, per-user snapshot creation, and cache invalidation. See [src/app/api/cron/snapshot/route.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/api/cron/snapshot/route.ts:1).
- Protected API requests likely do duplicate auth work. Middleware runs auth at the edge/proxy layer, while protected API handlers call auth again through `withAuth`. See [src/proxy.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/proxy.ts:44) and [src/lib/api-handler.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/api-handler.ts:4).
- Analytics-style pages rebuild expensive history-derived payloads. The analysis page in particular fans out full-history, breakdown, and cash-flow computations in parallel. See [src/app/(main)/analysis/page.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/(main)/analysis/page.tsx:19).
- Some render paths can still trigger exchange-rate resolution work at request time, which increases CPU variance and makes cold or invalidated requests more expensive. See [src/lib/services/net-worth-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/net-worth-service.ts:112).

Needs verification in production:

- Which function family is the dominant consumer of Active CPU: interactive refreshes, the daily cron, analytics page requests, or noisy auxiliary endpoints such as search/options.
- How often users trigger refresh actions compared with the scheduled cron path.
- Whether cache invalidation patterns are causing a meaningful number of expensive recomputations after writes.

## Prioritized Optimization Plan

| Priority | Suggestion | Expected Effect | Pros | Cons | Primary References |
| --- | --- | --- | --- | --- | --- |
| 1 | Split interactive refresh from global refresh and make manual refresh user-scoped. | Very high | Cuts the most obvious source of over-broad work; aligns CPU usage with the current user instead of total dataset size. | Requires separate code paths for cron/global refresh vs. manual/user refresh. | [src/components/dashboard/dashboard-actions.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/components/dashboard/dashboard-actions.tsx:42), [src/lib/services/price-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/price-service.ts:208), [src/app/api/cron/snapshot/route.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/api/cron/snapshot/route.ts:49) |
| 2 | Reduce duplicate auth execution on API routes. | High | Lowers CPU on every protected API call; simplifies the request path. | Requires careful review of which routes remain protected by proxy vs. route-level auth. | [src/proxy.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/proxy.ts:44), [src/lib/api-handler.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/api-handler.ts:4) |
| 3 | Cache or precompute analysis, goals, and projection payloads. | High | Reduces repeated full-history recomputation; stabilizes heavy page requests. | Adds invalidation complexity and may introduce bounded staleness. | [src/app/(main)/analysis/page.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/(main)/analysis/page.tsx:25), [src/lib/services/projection-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/projection-service.ts:13), [src/lib/services/goal-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/goal-service.ts:95) |
| 4 | Remove render-time FX fetching and rely on prepared cached rates. | High | Makes request CPU more predictable; avoids external-rate work inside render paths. | Rates may be slightly stale until the next refresh/cron cycle. | [src/lib/services/net-worth-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/net-worth-service.ts:112), [src/lib/services/exchange-rate-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/exchange-rate-service.ts:212) |
| 5 | Narrow invalidation from global tags to per-user tags where applicable. | Medium | Reduces avoidable recomputation after writes and refreshes. | Requires consistent cache-tag ownership across routes and services. | [src/app/api/prices/refresh/route.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/api/prices/refresh/route.ts:1), [src/lib/services/net-worth-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/net-worth-service.ts:201) |
| 6 | Rework broad price-cache access patterns if symbol count grows. | Medium | Prevents dataset-wide filtering from scaling poorly as the portfolio universe expands. | May trade some shared-cache simplicity for more targeted queries. | [src/lib/services/price-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/price-service.ts:181), [src/app/(main)/accounts/page.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/(main)/accounts/page.tsx:41) |
| 7 | Reduce noisy search/options traffic with tighter client behavior and caching. | Low/Medium | Lowers avoidable function invocations from typing-driven lookups and options-chain fetches. | Small UX tradeoffs if debounce/min-length rules get stricter. | [src/components/accounts/holding-search.tsx](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/components/accounts/holding-search.tsx:46), [src/app/api/search/route.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/api/search/route.ts:108), [src/app/api/options/chain/route.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/app/api/options/chain/route.ts:32) |
| 8 | Add timing logs around CPU-heavy paths for future verification. | Low/Medium | Makes later Vercel log review evidence-based and helps rank follow-up work. | Small logging overhead and some noise if not curated. | [src/lib/logger.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/logger.ts:1), [src/lib/services/price-service.ts](/Users/chuntsai/.codex/worktrees/f701/asset_tracker/src/lib/services/price-service.ts:96) |

## Recommended Execution Order

1. User-scope manual refresh endpoints.
2. Remove API double-auth.
3. Cache or materialize analytics payloads.
4. Eliminate render-time FX fetching.
5. Revisit invalidation scope and noisy auxiliary endpoints.

## References

- [Vercel Hobby plan](https://vercel.com/docs/accounts/plans/hobby)
- [Fluid compute pricing](https://vercel.com/docs/edge-middleware/usage-and-pricing)
- [Vercel limits overview](https://vercel.com/docs/limits/overview)
