# Assets Tracker - Sentry Monitoring Plan

Date: 2026-06-13

## Scope

This plan turns the current Sentry integration into an operating monitoring system for Assets Tracker. It is based on the current Next.js 16.2.2 App Router codebase, `@sentry/nextjs` 10.57.0, Vercel deployment, Prisma/Neon data access, daily snapshot cron, market-data refresh flows, and existing `/api/health` readiness signal.

## Current Integration

Already wired:

- Server and Edge init: `src/instrumentation.ts`
  - Initializes Sentry only when `SENTRY_DSN` exists.
  - Uses `environment: VERCEL_ENV ?? NODE_ENV`.
  - Exports `onRequestError = Sentry.captureRequestError` for App Router server/request errors.
  - `SENTRY_TRACES_SAMPLE_RATE` defaults to `0`.
- Browser init: `src/instrumentation-client.ts`
  - Initializes only when `NEXT_PUBLIC_SENTRY_DSN` exists.
  - Exports `onRouterTransitionStart = Sentry.captureRouterTransitionStart`.
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` defaults to `0`.
- Logger forwarding: `src/lib/logger.ts`
  - `log.error` and `log.warn` emit structured JSON logs.
  - When `SENTRY_DSN` exists, errors are forwarded to Sentry and warnings become breadcrumbs by default.
  - Warning-level Sentry issues require `SENTRY_CAPTURE_WARNINGS=true`.
  - `withTiming()` captures thrown `Error` instances with duration metadata.
- Build integration: `next.config.ts`
  - Wraps config with `withSentryConfig`.
  - Source-map upload is disabled unless `SENTRY_AUTH_TOKEN` exists.
  - Sentry ingest hosts are allowed by CSP.
  - `disableLogger: true` strips Sentry SDK logger statements in production.
- Availability signal: `src/app/api/health/route.ts`
  - Public, rate-limited readiness endpoint.
  - Checks DB reachability, latest successful snapshot cron freshness, and latest `NetWorthSnapshot` freshness.
  - Returns `503` for DB failure or stale cron/snapshot state.
- Existing telemetry:
  - Vercel Analytics and Speed Insights mount only on Vercel.
  - Custom Core Web Vitals budget misses POST to `/api/_metrics/vitals` and currently call `log.warn`.
  - CSP reports POST to `/api/csp/report` and currently call `log.warn`.

Main gaps:

- `beforeSend` redaction/filtering is now centralized in `src/lib/sentry-config.ts`.
- Sentry Cron Monitor check-ins are now wired through `src/lib/sentry-cron.ts`.
- Client error boundaries now explicitly capture exceptions with boundary tags.
- Warning forwarding is breadcrumb-first by default; warning issues require `SENTRY_CAPTURE_WARNINGS=true`.
- Release/dist tagging is explicit when commit SHA env vars are present.
- Sentry dashboard and metric alert setup is scripted in `scripts/setup-sentry-monitoring.mjs`, but applying it requires Sentry credentials.

## Monitoring Goals

1. Catch user-impacting production failures within 5 minutes.
2. Keep daily net-worth snapshots observable even when the cron route returns a handled 500.
3. Separate external-provider degradation from app regressions.
4. Preserve user privacy: no account names, import/export payloads, cookies, auth headers, emails, or raw financial values in Sentry.
5. Keep alert noise low enough that every production alert is actionable.

## Severity Model

| Severity | Page owner expectation    | Examples                                                                                                                   | Primary signal                     |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| SEV1     | Respond immediately       | `/api/health` returns 503, DB unreachable, production 5xx spike, snapshot cron stale > 36 h                                | Uptime monitor, Sentry issue alert |
| SEV2     | Same-day fix              | Cron route fails, auth/login regression, import/export 500, account/holding mutation 500, repeated App Router render crash | Sentry issue alert                 |
| SEV3     | Triage during normal work | Yahoo/CoinGecko/FX failures, CSP noise, CWV budget misses, Prisma slow-query warnings                                      | Sentry dashboard, Vercel logs      |
| SEV4     | Backlog                   | Single-user recoverable UI error, expected validation failure, rate-limit hit                                              | Product logs only                  |

## Sentry Project Setup

Configure one Sentry project for this app with these environments:

- `production`: Vercel production.
- `preview`: Vercel preview deployments.
- `development`: local/dev if DSNs are intentionally configured.

Required environment variables:

- Runtime server: `SENTRY_DSN`
- Runtime browser: `NEXT_PUBLIC_SENTRY_DSN`
- Source maps: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Optional tracing: `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
- Optional warning issue capture: `SENTRY_CAPTURE_WARNINGS=true`
- Optional browser release tag: `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`

Recommended defaults:

- Production error capture: on.
- Preview error capture: on, but alert separately or at lower priority.
- Development capture: off by default unless testing the integration.
- Production traces: start at `0.02` to `0.05` after redaction is in place.
- Preview traces: `0` unless debugging a performance issue.
- Session Replay: off by default for this financial app. If enabled later, require full text masking, input masking, URL allowlisting, and explicit privacy review.

## Release and Source Maps

Use commit-scoped releases so minified browser errors map back to source:

- Release name: `VERCEL_GIT_COMMIT_SHA` when present.
- Environment: `VERCEL_ENV ?? NODE_ENV`.
- Source-map upload: only when `SENTRY_AUTH_TOKEN` exists, matching current `next.config.ts`.
- Verification after each production deploy:
  - Sentry release exists for the deployed commit.
  - Source maps are attached.
  - A test event from the deployed app resolves to TypeScript source.

Implemented runtime behavior:

- Server/edge/client init set `release` and `dist` through `src/lib/sentry-config.ts` when commit SHA env vars are available.
- Browser release tagging needs `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`; otherwise the Sentry build plugin's injected release remains the fallback source of truth.

## Privacy and Filtering

`beforeSend` is implemented in `src/lib/sentry-config.ts` and used by `src/instrumentation.ts` and `src/instrumentation-client.ts`.

Redact or drop:

- Request headers: `cookie`, `authorization`, `x-vercel-protection-bypass`, `x-forwarded-for`.
- Auth data: email, name, image URL, provider account IDs, session tokens, OAuth tokens.
- Financial data: account names, holding names, balances, quantities, prices, net worth totals, import/export JSON payloads.
- Route bodies for `/api/settings/data` import/export.
- CSP report bodies if they include blocked URLs with query strings.

Keep, when available:

- `environment`
- `release`
- Route/path template, not full sensitive query strings.
- Error message and stack.
- Provider names such as `yahoo`, `coingecko`, `frankfurter`, `er_api`.
- Hashed user ID only, never raw `userId`.
- Stable operation names from `log.*` messages.

Warning policy:

- Do not page on `level:warning`.
- Warnings become Sentry breadcrumbs by default. Set `SENTRY_CAPTURE_WARNINGS=true` only for short dashboard experiments.
- High-noise warning categories to filter or sample:
  - `csp.violation`
  - `csp.report.invalid`
  - `cwv.budget_exceeded`
  - `prisma.slow_query`
  - `option.multiplier.defaulted`
  - `rates.unresolved`
- Warning categories worth retaining in Sentry, but not paging:
  - `stocks.price_warm.failed`
  - `rates.warm.failed`
  - repeated provider failures from market-data refreshes

## Monitor Matrix

| Monitor                  | Source                                                                                               | Alert condition                                                                  | Severity  | First check                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| App health               | External uptime check on `/api/health`                                                               | 2 consecutive 503s or timeout                                                    | SEV1      | Response JSON: `db`, `cron`, `snapshot`, age fields        |
| DB availability          | `/api/health`, Sentry `health.db_unreachable`                                                        | Any production event or health `db:error`                                        | SEV1      | Neon status, Vercel logs, recent migrations                |
| Snapshot cron            | Sentry Cron Monitor around `/api/cron/snapshot`                                                      | Missed check-in or failed check-in                                               | SEV1/SEV2 | `CronRun` latest row, Vercel Cron execution history        |
| Cron route failure       | Sentry event `cron.snapshot.failed`                                                                  | Any production event                                                             | SEV2      | `CronRun.error`, provider errors, Prisma errors            |
| Cron audit failure       | Sentry event `cron.snapshot.audit_failed`                                                            | Any production event                                                             | SEV2      | DB write path and schema migration state                   |
| App Router server errors | `onRequestError`                                                                                     | New issue in production or >5 events/5 min                                       | SEV2      | Route type/context, recent deploy diff                     |
| API mutation 500s        | Sentry level error with route matching `/api/accounts`, `/api/goals`, `/api/stocks`, `/api/settings` | New production issue                                                             | SEV2      | Ownership checks, Prisma constraint, request method        |
| Import/export failure    | `export.failed`, `import.failed`, `import.validation`                                                | Any production `export.failed`/`import.failed`; validation sampled only          | SEV2      | Redacted payload size, schema version, Prisma transaction  |
| Market price refresh     | `price.yahoo.batch_failed`, `price.yahoo.symbol_failed`, `price.coingecko.failed`                    | >10 provider failures/15 min or full refresh returns zero updates repeatedly     | SEV3      | Provider status, timeout/retry behavior, symbol list       |
| FX refresh               | `rates.fetch.failed`, `rates.unresolved`                                                             | `rates.fetch.failed` >5/15 min or unresolved rates for same pair repeatedly      | SEV3      | Frankfurter/ER API status, cached `ExchangeRate` freshness |
| Client rendering         | Explicit captures from `global-error.tsx` and `(main)/error.tsx` after follow-up                     | New production issue or >5 events/10 min                                         | SEV2      | Browser, route, release, digest                            |
| Client navigation        | `onRouterTransitionStart`, browser errors                                                            | Navigation-related errors after deploy                                           | SEV3      | Chunk 404s, Vercel skew, service worker cache              |
| Core Web Vitals          | `/api/_metrics/vitals` warning or Sentry metric after follow-up                                      | Dashboard trend, not page alert                                                  | SEV3      | Vercel Speed Insights, route-specific budget               |
| CSP violations           | `/api/csp/report`                                                                                    | Dashboard trend only; page only if first-party script/style blocked after deploy | SEV3      | `blocked-uri`, `violated-directive`, recent CSP change     |
| Prisma slow queries      | `prisma.slow_query`                                                                                  | Dashboard trend; alert only if correlated with health failures                   | SEV3      | Query model/operation, Neon latency, cache miss pattern    |

## Alert Rules

Create these Sentry alert rules for `environment:production`:

Repo setup path:

- Dry run: `npm run sentry:setup`
- Apply: `SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... SENTRY_ALERT_USER_ID=... npm run sentry:setup -- --apply`
- The setup script creates metric alert rules for production error spikes, API error spikes, cron snapshot failures, and DB unreachable events.
- Email notification actions require a Sentry user or team id. Use `SENTRY_ALERT_USER_ID` or `SENTRY_ALERT_TEAM_ID`; use `SENTRY_ALERT_ACTIONS_JSON` for Slack/PagerDuty/custom action payloads.
- Create the "new issue" rule in the Sentry UI if you need a true first-seen issue alert. Sentry's issue alert API is project-specific and notification-action dependent.

Current Sentry resources:

- Dashboard: `Assets Tracker - Production Health`, id `7021314`.
- Metric alerts: production error spike `439337`, API error spike `439338`, cron snapshot failed `439339`, DB unreachable `439340`.

1. New issue, level error
   - Query: `level:error environment:production`
   - Exclude known handled telemetry paths and warnings.
   - Notify immediately.

2. Error spike
   - Query: `level:error environment:production`
   - Trigger: more than 10 events in 5 minutes.
   - Notify immediately.

3. User-impacting API failures
   - Query: `level:error environment:production transaction:/api/*`
   - Trigger: new issue or more than 5 events in 10 minutes.

4. Cron snapshot failure
   - Query: `message:"cron.snapshot.failed" environment:production`
   - Trigger: any event.

5. DB unreachable
   - Query: `message:"health.db_unreachable" environment:production`
   - Trigger: any event.

6. Provider degradation dashboard only
   - Query: `message:"price.*.failed" OR message:"rates.fetch.failed"`
   - Trigger: no page; add dashboard widget and weekly review.

7. Warning quarantine
   - Query: `level:warning environment:production`
   - Trigger: no page; dashboard only.

## Monitor Dashboard

Create one Sentry dashboard named `Assets Tracker - Production Health`.

Repo setup path:

- Dry run: `npm run sentry:setup`
- Apply through the Sentry API: `SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... SENTRY_ALERT_USER_ID=... npm run sentry:setup -- --apply`
- The API token needs Sentry scopes for dashboard creation and metric alerts.
- The script creates the dashboard widgets listed below.

Dashboard purpose:

- Morning scan: confirm no silent production degradation.
- Post-deploy scan: confirm the latest release did not introduce new errors.
- Incident triage: quickly separate app, database, cron, provider, and browser failures.

Default filters:

- Environment: `production`
- Time range: last 24 hours
- Release: all releases by default; switch to latest release during deploy review

Recommended layout:

| Row | Widget                  | Visualization          | Query / metric                                                                                                            | Why it exists                                               |
| --- | ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Production errors       | Big number + sparkline | `level:error environment:production`, `count()`                                                                           | Immediate app health pulse                                  |
| 1   | Affected users          | Big number             | `level:error environment:production`, `count_unique(user)` or hashed user tag                                             | Distinguishes one noisy session from broad breakage         |
| 1   | Latest release errors   | Big number + sparkline | `level:error environment:production release:<latest>`                                                                     | Post-deploy regression check                                |
| 1   | Warning volume          | Area chart             | `level:warning environment:production`, `count()`                                                                         | Optional only when `SENTRY_CAPTURE_WARNINGS=true`           |
| 2   | Errors by route         | Table                  | Group by `transaction` or route tag, `count()`                                                                            | Finds broken pages/API routes fast                          |
| 2   | Errors by release       | Table                  | Group by `release`, `count()`                                                                                             | Confirms rollback/forward target                            |
| 2   | Errors by runtime       | Pie/table              | Group by runtime tag: `nodejs`, `edge`, `browser`                                                                         | Separates server, edge, and client failures                 |
| 3   | Cron health             | Big number + table     | `message:"cron.snapshot.failed" OR message:"cron.snapshot.audit_failed"`                                                  | Snapshot freshness is core product trust                    |
| 3   | DB failures             | Big number + table     | `message:"health.db_unreachable" OR error.type:*Prisma*`                                                                  | Database issues become SEV1 quickly                         |
| 3   | Import/export failures  | Table                  | `message:"export.failed" OR message:"import.failed"`                                                                      | High-risk data-management workflows                         |
| 4   | Market providers        | Stacked area/table     | `message:"price.yahoo.*" OR message:"price.coingecko.failed" OR message:"rates.fetch.failed"` grouped by provider/message | Provider degradation without mixing it into app regressions |
| 4   | FX unresolved pairs     | Table                  | `message:"rates.unresolved"` grouped by `from`, `to`, `baseCurrency`                                                      | Detects stale/missing currency coverage                     |
| 4   | Slow Prisma operations  | Table                  | `message:"prisma.slow_query"` grouped by model/operation                                                                  | Spots cache misses and DB latency drift                     |
| 5   | Browser render errors   | Table                  | `level:error runtime:browser` grouped by `transaction`, browser, release                                                  | Client-only failures and hydration/runtime crashes          |
| 5   | Navigation/chunk errors | Table                  | Browser errors containing chunk/load/navigation terms                                                                     | Catches stale service worker or deployment skew             |
| 5   | CSP violations          | Table                  | `message:"csp.violation"` grouped by violated directive and blocked URI                                                   | Verifies CSP changes without paging on internet noise       |
| 6   | Backend p95 latency     | Line chart             | `p95(transaction.duration)` for `/api/health`, `/api/refresh`, `/api/cron/snapshot`                                       | Backend degradation trend after tracing is enabled          |
| 6   | Page p95 latency        | Line chart             | `p95(transaction.duration)` for `/`, `/accounts`, `/accounts/[id]`, `/analysis`, `/history`                               | User-facing route performance trend                         |
| 6   | CWV budget misses       | Bar/table              | `message:"cwv.budget_exceeded"` grouped by metric and URL                                                                 | Complements Vercel Speed Insights                           |

Dashboard conventions:

- Use `production` only for the primary dashboard. Create a separate preview dashboard if preview noise becomes useful.
- Keep `level:warning` widgets visually separate from `level:error` widgets.
- Provider widgets should be reviewed, not paged, unless they correlate with cron or health failures.
- Pin the latest release widget near the top. Most scary-looking graphs become obvious once grouped by release.
- Add a short text widget at the top with links to:
  - Vercel production deployment
  - Vercel Cron history
  - Neon dashboard
  - `/api/health`
  - this document

Missing tags to add before the dashboard is fully useful:

- `runtime`: `nodejs`, `edge`, `browser`
- `operation`: stable logger message or service operation
- `provider`: `yahoo`, `coingecko`, `frankfurter`, `er_api`, `neon`
- `route`: route template when known
- `user_hash`: hashed user ID, never raw `userId`
- `cron_name`: `snapshot`
- `boundary`: `global`, `main`, or future route-level boundary

Review cadence:

- After every production deploy: check latest release errors for 15 minutes.
- Daily: scan production errors, cron health, DB failures, and provider degradation.
- Weekly: review warning volume, CSP violations, slow Prisma operations, and CWV budget misses.
- Monthly: archive or tune noisy widgets so the dashboard stays readable.

Dashboard success criteria:

- A broken deploy is visible in the top row within minutes.
- A missed or failed snapshot run is visible without opening Vercel first.
- Provider outages are visible but do not drown out app errors.
- Warnings can be trended without creating issue-alert fatigue.
- Every high-level widget has a drilldown path to route, release, and first failing operation.

## Sentry Cron Monitor Plan

The current `/api/cron/snapshot` route writes `CronRun` rows and `/api/health` reads the latest success. Keep that DB-level audit because it is app-owned and visible outside Sentry.

Add Sentry Cron Monitor check-ins around the route:

- Start check-in immediately after cron secret validation.
- Mark success after `CronRun.update({ ok: true })`.
- Mark failure in the catch block before returning 500.
- Include duration and route name `snapshot`.

Schedule expectation:

- Expected frequency: daily, matching Vercel Cron.
- Max runtime: use existing `vercel.json` function duration budget.
- Missed-check-in grace: 36 hours, matching `/api/health` freshness window.

Operational behavior:

- Sentry missed check-in pages first.
- `/api/health` also returns 503 if the latest successful run is stale, giving uptime monitors an independent signal.
- `CronRun` remains the local audit trail for debugging and historical analysis.

## Client Error Boundary Plan

Current error boundaries are correct App Router recovery surfaces, but they only log to console:

- `src/app/global-error.tsx`
- `src/app/(main)/error.tsx`

Follow-up:

- Import `@sentry/nextjs` in both client error components.
- In `useEffect`, call `Sentry.captureException(error, { tags: { boundary: "global" | "main" }, extra: { digest: error.digest } })`.
- Keep the existing retry UI.
- Do not include user/account state in `extra`.

Why this matters:

- `onRequestError` covers server/request failures.
- Explicit boundary capture gives richer browser-side context for client render crashes and hydration/runtime failures.

## Performance Monitoring Plan

Tracing is currently off by default. Keep it off until privacy filtering is done.

After filtering:

- Start production sample rate at `0.02` to `0.05`.
- Track p95 transaction duration for:
  - `/`
  - `/accounts`
  - `/accounts/[id]`
  - `/analysis`
  - `/history`
  - `/api/refresh`
  - `/api/cron/snapshot`
  - `/api/health`
- Use Vercel Speed Insights as the primary CWV dashboard.
- Use Sentry performance for correlated errors and slow backend transactions, not as the only frontend performance source.

Performance alerts:

- Do not page on single slow transactions.
- Create dashboard widgets for p95 regressions after deploy.
- Page only when slow transactions correlate with 5xx spikes or `/api/health` failures.

## Runbooks

### `/api/health` is 503

1. Read the response JSON.
2. If `db:error`, check Neon status, Vercel runtime logs, and recent migrations.
3. If `cron:stale`, inspect latest `CronRun` row and Vercel Cron execution history.
4. If `snapshot:stale` but `cron:ok`, inspect `createSnapshot`, `getCachedNetWorthSummary`, market-data refresh, and cache invalidation logs.
5. Check Sentry for correlated `cron.snapshot.failed`, `health.db_unreachable`, and Prisma errors.

### `cron.snapshot.failed`

1. Inspect event stack and `CronRun.error`.
2. Determine failing phase:
   - expired option sweep
   - FX refresh
   - price refresh
   - per-user snapshot creation
   - cache invalidation
3. If provider-only, decide whether cached/stale data is acceptable.
4. If DB write failed, check Neon and latest migration.
5. Manually rerun the cron with the production `CRON_SECRET` after fix.

### Market-data provider degradation

1. Check whether Yahoo, CoinGecko, Frankfurter, or ER API is failing.
2. Confirm whether cached `PriceCache` and `ExchangeRate` data remains fresh enough for reads.
3. Avoid paging unless snapshots cannot be created or user refreshes repeatedly fail.
4. If one provider is down, prefer fallback/cached behavior over blocking app usage.

### New App Router render error

1. Check Sentry release and route context.
2. Compare against the latest deploy diff.
3. If Server Component digest exists, match digest to server-side Sentry/log event.
4. Reproduce on preview with the same route and user shape if possible.
5. Roll back if the error affects primary dashboard/account routes.

### Import/export failure

1. Confirm no raw payload was sent to Sentry.
2. Check validation schema errors and Prisma transaction failure.
3. Verify account/holding ownership and data version assumptions.
4. Add a regression fixture if the payload shape is valid but unsupported.

## Implementation Checklist

Phase 1 - Stabilize signal quality:

- Done: `beforeSend` redaction/filtering is shared by server, edge, and client Sentry init.
- Done: explicit `release`/`dist` are set when commit SHA env vars are available.
- Done: warnings are breadcrumbs by default and warning-level issue capture is opt-in.
- Done: `npm run sentry:setup` dry-runs dashboard and metric-alert setup; `-- --apply` applies it with Sentry credentials.

Phase 2 - Add monitors:

- Configure external uptime check against `/api/health`.
- Done: Sentry Cron Monitor check-ins are wired into `/api/cron/snapshot`.
- Done: metric alert setup is automated by `npm run sentry:setup -- --apply`.
- Verify source maps with a safe test event in preview, then production.

Phase 3 - Improve context:

- Done: `global-error.tsx` and `(main)/error.tsx` explicitly capture client boundary errors.
- Add sanitized tags for operation, provider, route, and hashed user ID.
- Add a guarded Sentry test endpoint or admin-only action for integration verification.

Phase 4 - Performance:

- Enable low-rate production traces only after redaction lands.
- Build Sentry performance dashboard for primary pages and refresh/cron API routes.
- Keep CWV budget reporting in Vercel Speed Insights; sample or dashboard Sentry CWV warnings only.

## Definition of Done

- Production Sentry receives server, edge, and browser events with source maps.
- No Sentry event contains auth headers, cookies, emails, account names, raw user IDs, or financial payloads.
- `/api/health` has an external uptime monitor.
- Snapshot cron has Sentry missed/failure check-ins plus the existing `CronRun` DB audit.
- Error alerts page on production `level:error`, DB health failures, and cron failures only.
- Warning telemetry is visible in dashboards but does not page.
- A new production deploy can be traced to release, commit, environment, and affected route.
