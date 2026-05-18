# React Best-Practices Review — 2026-05-18

**Scope reviewed:** whole `src/components/` tree + `src/app/(main)/**/page.tsx` + `src/lib/services/`
**Rule categories prioritized:** Eliminating Waterfalls, Bundle Size, Server-Side Performance, Client-Side Data Fetching
**Tool:** `/vercel:react-best-practices`

---

## Context

Run prioritized review of the codebase against the four highest-impact rule categories from Vercel's React best-practices guide. The codebase was already healthy in many respects — dashboard charts lazy via `next/dynamic`, services use `"use cache"` + `cacheTag()`, passive listeners correct, no barrel-import violations. This review focused on the remaining gaps.

Two themes emerged:

1. **`/analysis` route eagerly bundled ~932 lines of recharts-dependent chart code** that should be deferred (matching the dashboard pattern).
2. **Four pages awaited `getOrCreateSettings(userId)` sequentially** before the outer `Promise.all`, blocking translation/message/data fetches from starting.

---

## Findings & Status

### P0 — implemented in this pass

| ID  | Finding                                                   | Files                                                                                                          |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | Lazy-load 5 analysis charts (`bundle-dynamic-imports`)    | `src/components/analysis/lazy-analysis-charts.tsx` (new), `src/components/analysis/analysis-view.tsx`          |
| F2  | Lazy-load projection chart (`bundle-dynamic-imports`)     | `src/components/projections/lazy-projection-chart.tsx` (new), `src/components/projections/projection-view.tsx` |
| F3  | Defer settings await on `/analysis` (`async-defer-await`) | `src/app/(main)/analysis/page.tsx`                                                                             |
| F4  | Defer settings await on `/goals`                          | `src/app/(main)/goals/page.tsx`                                                                                |
| F5  | Defer settings await on `/history`                        | `src/app/(main)/history/page.tsx`                                                                              |
| F6  | Defer settings await on `/projections`                    | `src/app/(main)/projections/page.tsx`                                                                          |

### P1 — evaluated and declined

Both items were re-read against the current code and judged not worth the change cost. Recorded here so a future reviewer doesn't re-flag them.

- **F7. `getAccountDetail` `"use cache"` — declined.** Inner `fetchUserAccountsWithHoldings` already has `"use cache"` + `accounts:${userId}` tag + `cacheLife("hours")` (`net-worth-service.ts:23-37`). The wrapper's `.find()` over <100 accounts is microseconds; adding per-account tags would force every mutation route to invalidate the narrower tag instead of the current broad `accounts:${userId}`. Real bookkeeping cost, no measurable benefit.
- **F8. `accounts-list` payload trim — declined.** The client genuinely uses each holding's `id`, `symbol`, `name`, `currency`, `assetType`, `contractMultiplier`, `quantity` — `getAccountValue` (accounts-list.tsx:108-115) iterates them for sort/totals and `AccountCardWithHoldings` (L741-748) renders every holding row on mobile. Trimming meaningfully would require a parallel `AccountForList` shape and moving per-row compute server-side; ~5-10 KB payload saved doesn't justify the forked type surface.

### P2 — evaluated and declined

Both items were re-read against the current code and judged not worth the change cost. Recorded here so a future reviewer doesn't re-flag them.

- **F9. SWR adoption — declined.** Classified every `fetch()` in the 9 flagged files: 3 are GET queries (`holding-search.tsx`, `data-management.tsx` export, `transaction-history.tsx` list), 15 are POST/PATCH/DELETE mutations. SWR's value (dedup, stale-while-revalidate, focus revalidation) is for queries; the codebase is ~5:1 mutations. The 3 queries are user-action-triggered (or already debounced for `holding-search`), so SWR's auto-features add nothing. `useSWRMutation` for the 15 mutations is just a wrapper that wouldn't shrink the existing toast/setLoading/router.refresh pattern. +12 KB dependency, ~18 sites refactored, ~zero observable user impact.
- **F10. Centralized event bus — declined.** The review claimed "duplicate listeners" but mapping every dispatcher/listener showed only `new-item` has two listeners — and they're on different routes (`/accounts` vs `/accounts/[id]`), mounted one at a time. The remaining 7 custom events are 1-dispatcher → 1-listener pubs (mostly command palette → page actions). Current pattern is ~8 lines per listener, 1 per dispatch, easy to grep. An `event-bus.ts` would save ~30 lines but add an abstraction layer for no functional gain.

---

## Implementation Notes

### Waterfall fix shape

`getOrCreateSettings` is `"use cache"` wrapped, so multiple `.then((s) => ...)` chains trigger a single cached read — no duplicate DB work. The pattern adopted across all four pages:

```ts
const settingsP = getOrCreateSettings(userId);
const [t, messages /*...service reads...*/, , settings] = await Promise.all([
  getTranslations("..."),
  getMessages(),
  settingsP.then((s) => someServiceCall(userId, s.baseCurrency)),
  // ...
  settingsP,
]);
```

This lets the i18n + locale promises start immediately in parallel with the settings query, instead of after it resolves.

### Lazy-chart placeholders

`lazy-analysis-charts.tsx` uses a single `ChartSkeleton` with configurable `height` (default 280, matches the 5 analysis charts; 200 for attribution to match its smaller chart). The skeleton uses `Card className="border-0 bg-transparent shadow-none"` to match each chart's internal Card wrapper, so layout shift is minimal.

`lazy-projection-chart.tsx` uses a 320px skeleton to match the projection chart's internal height.

### Patterns reused (no duplication)

- `src/components/dashboard/lazy-charts.tsx` — `dynamic()` recipe applied for both new files.
- Service-layer `"use cache"` + `cacheTag()` — no service edits needed.

---

## Verification

- `npm run format:check` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- Bundle-size verification (`ANALYZE=true npm run build`) and Playwright smoke recommended before shipping but not run as part of this pass.

---

## Related docs

- `docs/PERFORMANCE.md` — bundle optimization (B1–B15), already flags `next/dynamic` migration for recharts; this completes the analysis + projections side.
- `docs/LOG.md` — engineering log.
