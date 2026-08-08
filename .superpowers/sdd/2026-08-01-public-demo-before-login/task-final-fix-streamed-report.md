# Final streamed-span fix report

## Scope

This final correction addresses only Sentry streamed-span privacy. Deferred public-Demo UX work remains unchanged.

## Root cause and fix

- `@sentry/nextjs` 10.57.0 re-exports the official `withStreamedSpan` helper. Its SpanStreaming integration rejects an unmarked `beforeSendSpan` callback and falls back to `traceLifecycle: "static"`.
- `beforeSendSpan` is now created with that helper, so it is marked with the SDK's `_streamed` marker and receives the real streamed span shape (`name` and `attributes`).
- Static transaction spans use `sanitizeStaticSpan`; streamed spans use `beforeSendSpan`. Both delegate to the same private `sanitizeSpan` boundary, preserving identical route, identifier, IP, and message redaction rules.
- Node and Edge activate the SDK's streamed lifecycle with `traceLifecycle: "stream"`. The browser initializer additionally installs the official `spanStreamingIntegration`, which the browser SDK does not add merely from the lifecycle option.

## Sampling impact

`traceLifecycle` changes the transport lifecycle of spans; it does not raise the sampling rate. All three initializers retain their existing `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` settings and default of `0`.

## RED / GREEN evidence

- **RED:** The new real-SDK transport test failed on the baseline because `beforeSendSpan` had no `_streamed` marker.
- **GREEN:** The test initializes the installed SDK with a memory transport and `traceLifecycle: "stream"`, starts a real span, flushes the SDK, and inspects the serialized v2 span-envelope payload. Dynamic account/transaction route IDs, query token, and IP sentinels are absent; the span name and IP are filtered and the URL is parameterized.
- A second RED/GREEN check proves the browser initializer explicitly installs `SpanStreaming`; Node, Edge, and browser initialization tests continue to cover the shared callback wiring and streamed lifecycle.

## Verification

- `pnpm exec vitest run tests/unit/sentry-config.test.ts tests/unit/sentry-initialization.test.ts tests/unit/demo-quota-service.test.ts tests/unit/demo-stock-refresh-credit.test.ts tests/unit/preview-auth-policy.test.ts tests/unit/public-demo-policy.test.ts tests/unit/public-demo-route-policy.test.ts tests/unit/public-demo-auth.test.ts` — passed: 8 files, 88 tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `git diff --check` — passed.

## Unrun integration

The PostgreSQL integration suite was not run because `DATABASE_URL` is unset in this worktree. No database service or Demo UX behavior was changed for this correction.
