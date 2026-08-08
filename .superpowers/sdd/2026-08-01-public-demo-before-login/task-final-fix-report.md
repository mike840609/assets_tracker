# Final-fix report — Demo quota and privacy hardening

## Status

Implemented and verified. The accompanying single commit is `fix: harden demo quota and telemetry privacy`; its final SHA is supplied in the handoff.

## Findings resolved

1. **Live market calls now have a DB-authoritative Demo refresh credit.**
   - `GET /api/stocks/quote` and `POST /api/stocks` retain their Task 9 `demo: "allow"` capability policy, but opt into `marketData: "refresh-credit"` in `withAuth`.
   - The wrapper consumes the transactional ten-minute Demo refresh credit before either handler can call a provider. A POST still consumes its normal mutation credit first, so the established mutation quota remains intact.
   - The stock create/quote paths reuse the already fetched quote when caching it, avoiding a second provider call during one request.
   - This deliberately preserves the explicit Task 9 route-policy matrix rather than changing core stock CRUD/quote to `market-refresh`; capability and provider-resource budget are separate concerns.

2. **Module-memory limiter keys are opaque.**
   - The generic limiter now requires an explicit key and provides purpose-separated HMAC helpers for client IP and authenticated subject identities.
   - Every existing Node limiter caller now supplies one; Demo start uses an IP-derived opaque key, while the authenticated Demo quote limiter uses an opaque Demo principal key.
   - Client-IP extraction moved into an Edge-safe module. The Edge `/api/auth` limiter was additionally converted to a WebCrypto HMAC key so its own module `Map` cannot retain raw forwarded IPs.
   - Raw IP remains request-local for the workspace creator-source policy only.

3. **Sentry `beforeSend` is an end-to-end privacy boundary.**
   - Forwarding/IP headers and nested forwarding context are dropped; IP-containing strings and sensitive context/env values are filtered.
   - Error event message, log entry, exception value/metadata, stack trace, breadcrumbs, tags, query/cookies/request body, and fingerprint are sanitized.
   - URLs template dynamic resource IDs across account, Demo, transaction, calendar, recurring, stock, goal, snapshot, workspace, and related paths while removing query/hash content.
   - The existing node, Edge, and browser Sentry initializers already wire this shared `beforeSend`, so no parallel initializer behavior can bypass it.

## TDD evidence

- **RED:** The initial contracts failed against the original branch: 8 expected failures showed missing refresh-credit enforcement/order, raw limiter fallback/keying, and unsanitized Sentry sentinel values (the existing 65 tests still passed).
- **GREEN:** The same focused contract coverage passed after the minimal implementation.
- **Additional RED/GREEN:** A nested Sentry event with an IPv6 sentinel in exception mechanism data, request env, and context plus a recurring API ID initially leaked all three. After hardening the shared sanitizer, `tests/unit/sentry-config.test.ts` passed 2/2.

## Verification

- `pnpm vitest run tests/unit/api-handler-demo.test.ts tests/unit/rate-limit.test.ts tests/unit/rate-limited-routes.test.ts tests/unit/public-demo-route-policy.test.ts tests/unit/public-demo-auth.test.ts tests/unit/sentry-config.test.ts tests/unit/price-service.test.ts tests/unit/refresh-route.test.ts tests/unit/health-route.test.ts tests/unit/calendar-backup-route.test.ts tests/unit/proxy.test.ts` — passed: 11 files, 178 tests.
- `pnpm test:unit` — passed: 82 files, 734 tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `git diff --check` — passed.

The focused public-Demo PostgreSQL integration suite was not run because this worktree has no configured `DATABASE_URL` and no local Compose database service running. No database was created or modified merely for this final-fix pass.

## Changed files

- Quota/provider behavior: `src/lib/api-handler.ts`, `src/app/api/stocks/quote/route.ts`, `src/app/api/stocks/route.ts`, `src/lib/services/stock-watch-service.ts` and their focused unit contracts.
- Opaque rate limiting: `src/lib/rate-limit.ts`, new `src/lib/client-ip.ts`, `src/app/demo/actions.ts`, `src/proxy.ts`, all existing rate-limited API callers, and rate/proxy/auth route tests.
- Telemetry privacy: `src/lib/sentry-config.ts` and new `tests/unit/sentry-config.test.ts`.
- Compatibility test-mock updates: the refresh, health, and calendar backup unit suites; the proxy’s active Demo fixture now uses a far-future expiry instead of the already elapsed 2026-08-02 timestamp.

## Scope and concerns

No deferred UX work was changed. No blocking concerns remain; the only omitted check is the unavailable local-DB integration suite noted above.
