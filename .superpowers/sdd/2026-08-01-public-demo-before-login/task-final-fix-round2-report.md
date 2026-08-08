# Final-fix round 2 report — trace privacy and deferred Demo refresh credits

## Scope

This round resolves the final re-review findings only. It leaves the deferred UX Minor untouched and preserves the existing opaque limiter keys and explicit public-Demo route-policy matrix.

## RED / GREEN evidence

### Sentry privacy and tracing

- **RED:** `pnpm exec vitest run tests/unit/sentry-config.test.ts tests/unit/sentry-initialization.test.ts` failed on the baseline. The sentinel payload still contained raw tag/env identifiers, `logentry.formatted`, and a dynamic breadcrumb category; the shared module also had no transaction/span scrubbers, and all three initializers lacked the hooks.
- **GREEN:** The same Sentry tests pass after adding one shared transaction/span sanitizer and wiring the official `beforeSendTransaction` and `beforeSendSpan` hooks in browser, Node, and Edge initialization.
- The installed `@sentry/nextjs` 10.57.0 SDK supports both hooks. Its package facade does not directly re-export the event/span types used by the callbacks, so the implementation derives those types from the public `init` options signature instead of importing an internal SDK path.
- Sentinel coverage proves that forwarding/IP data and dynamic identifiers do not remain in error events, transaction request/url/headers/tags/contexts, transaction spans, or standalone span description/data/attributes.

### Demo refresh-credit timing

- **RED:** `pnpm exec vitest run tests/unit/api-handler-demo.test.ts tests/unit/demo-stock-refresh-credit.test.ts` failed on the baseline. A missing quote symbol, invalid JSON, schema-invalid stock create, and exact duplicate stock create each spent the Demo refresh credit before their handler/provider gate.
- **GREEN:** `withAuth` now injects a refresh-credit capability for the two explicit `marketData: "refresh-credit"` routes. The routes call it only immediately before `fetchEquityQuote`, after their validation and exact-duplicate checks.
- A Demo POST retains mutation-before-refresh ordering. Exhausted refresh credit returns before either quote/create provider call. Formal quote lookup keeps its existing behavior and never calls the Demo quota service.

## Cache behavior

The deferred cache UX Minor was intentionally not changed. In particular, no unconditional `cacheEquityQuote` call or fresh-cache/revalidation logic was added or moved: formal quote lookup still follows its pre-existing fetch-then-direct-cache path, including its original cache invalidation semantics. Only the Demo/formal no-op credit capability is positioned before the existing provider call.

## Final verification

- `pnpm exec vitest run tests/unit/api-handler-demo.test.ts tests/unit/rate-limit.test.ts tests/unit/rate-limited-routes.test.ts tests/unit/public-demo-route-policy.test.ts tests/unit/public-demo-auth.test.ts tests/unit/sentry-config.test.ts tests/unit/sentry-initialization.test.ts tests/unit/demo-stock-refresh-credit.test.ts tests/unit/price-service.test.ts tests/unit/refresh-route.test.ts tests/unit/health-route.test.ts tests/unit/calendar-backup-route.test.ts tests/unit/proxy.test.ts` — passed: 13 files, 193 tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `git diff --check` — passed.

## Unrun integration

The public-Demo PostgreSQL integration suite was not run: `DATABASE_URL` is unset in this worktree, and no local database service was started or modified for this fix round. The unit suite covers the wrapper-to-route provider boundary; integration remains an external-environment follow-up.
