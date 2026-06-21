# Dashboard Network Errors Design

## Problem

The production dashboard emits two independent classes of browser errors:

1. Brave Shields blocks browser-side Sentry session envelopes sent directly to Sentry, producing `net::ERR_BLOCKED_BY_CLIENT` / `(blocked:other)`.
2. The network-only service worker intercepts the cross-origin Google avatar request and calls `fetch()`. That fetch is governed by `connect-src`, which intentionally does not allow `lh3.googleusercontent.com`, even though the normal image request is allowed by `img-src`. The avatar fails and the service worker reports an unhandled fetch rejection.

Neither failure originates in dashboard data loading, but both create misleading loading noise and the second prevents the avatar from rendering.

## Goals

- Preserve browser-side Sentry reporting when privacy filters block direct Sentry ingestion.
- Preserve server-side and edge Sentry behavior without changes.
- Restore Google avatar loading without broadening `connect-src`.
- Preserve the service worker's network-only behavior for same-origin GET requests and its PWA role.
- Keep telemetry and avatar failures non-blocking for the dashboard.

## Non-goals

- Changing Sentry sampling, event sanitization, release tagging, or DSN configuration.
- Adding caching, offline behavior, retries, or a custom service-worker strategy.
- Replacing the avatar component or proxying Google images through the application.
- Addressing the unrelated deprecated `interest-cohort` Permissions-Policy warning.
- Refactoring dashboard components or data services.

## Design

### Sentry browser tunnel

Enable `tunnelRoute: true` in the existing `withSentryConfig` options in `next.config.ts`.

During each production build, the installed Sentry Next.js SDK generates a randomized same-origin route, injects that route into the browser SDK, and adds a Next.js rewrite to the regional Sentry envelope endpoint. Browser events therefore post to `astt.app/<generated-route>` instead of directly to `*.ingest.us.sentry.io`.

The SDK's proxy wrapper detects its generated tunnel path and bypasses application authentication middleware for those requests. Existing CSP already permits same-origin connections through `'self'`, so no CSP expansion is required. Node.js and edge Sentry clients continue using their existing direct DSNs.

The randomized route is preferred over a fixed path because it is less likely to be added to tracker-blocking filter lists. The trade-off is that the tunnel path changes between builds and consumes application request/bandwidth capacity when forwarding browser telemetry.

### Service-worker request boundary

Keep the existing fetch listener in `public/sw.js`, but call `respondWith(fetch(request))` only when both conditions hold:

- the method is `GET`; and
- the request URL has the same origin as the service worker.

Cross-origin requests—including Google avatars—receive no `respondWith` call and fall through to the browser's normal networking path. The avatar is then evaluated as an image load under the existing `img-src` directive, where `https://lh3.googleusercontent.com` is already allowed.

Same-origin GET requests remain network-only. Non-GET requests continue to fall through unchanged. The service worker gains no cache, retry, or offline behavior.

## Data Flow

### Browser telemetry

1. The browser Sentry SDK creates an envelope.
2. The SDK posts it to the randomized same-origin tunnel path.
3. The Sentry/Next.js integration bypasses the auth proxy for that path.
4. Next.js rewrites the request to the configured regional Sentry ingest endpoint.
5. A transport failure is handled by the SDK and never blocks dashboard rendering.

### Google avatar

1. The sidebar creates an image request for `https://lh3.googleusercontent.com/...`.
2. The service worker observes that the request is cross-origin and does not intercept it.
3. The browser evaluates the request under `img-src` and loads it directly from Google.
4. If the remote image itself fails, the browser reports a normal image failure; the service worker does not create a CSP violation or rejected fetch promise.

## Verification

- Add regression coverage that exercises the service-worker fetch listener and confirms:
  - same-origin GET requests call `respondWith`;
  - cross-origin GET requests do not call `respondWith`; and
  - non-GET requests do not call `respondWith`.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit`.
- Run a production build and confirm its route manifest contains the generated Sentry tunnel rewrite.
- In a browser controlled by the service worker, confirm:
  - Sentry envelopes target a randomized same-origin URL rather than the public Sentry ingest host;
  - the tunnel request is not redirected to login and is not blocked by the browser;
  - the Google avatar loads successfully; and
  - no related `connect-src`, service-worker fetch rejection, or direct-Sentry blocking errors appear.

## Files Expected to Change

- `next.config.ts` — enable the SDK-managed randomized tunnel.
- `public/sw.js` — restrict fetch interception to same-origin GET requests.
- A focused regression test for the service-worker routing behavior.

No dashboard component, avatar component, authentication rule, or CSP directive should change.
