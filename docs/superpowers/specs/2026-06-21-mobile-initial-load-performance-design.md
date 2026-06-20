# Mobile Initial-Load Performance Design

## Goal

Make the authenticated dashboard's first load feel faster in iPhone Safari and Android Chrome on a throttled mid-range mobile baseline. Improve perceived loading and Core Web Vitals without removing or deferring any dashboard chart and without increasing Vercel Fluid CPU usage.

## Current state

- Next.js 16.2.2 Cache Components produces a partially prerendered `/` route.
- Dashboard data already streams through section-level Suspense boundaries.
- Chart client components already use split bundles and must remain part of the initial load.
- The root locale boundary falls back to an empty element, so runtime locale work can leave the first response visually blank.
- The main layout awaits authentication and cookies before it can render its UI.
- Session reads are request-cached, and core dashboard services already use caching that should be reused.
- CI measures aggregate static assets, but does not isolate the initial dashboard route.

## Design

### Initial shell

Replace the empty root fallback with a lightweight, non-personalized app shell that paints useful mobile structure immediately. The shell must contain no user or financial data and must work for both authenticated and unauthenticated requests.

Keep authentication authoritative, but place the blocking validation behind the shell's Suspense boundary. An unauthenticated request still redirects to login; the shell is only temporary presentation and never grants access to protected content.

### Dashboard delivery

Preserve the current dashboard sections and every chart. Continue rendering sections through independent Suspense boundaries so all work can start concurrently and completed sections can stream without waiting for slower siblings.

Prioritize the net-worth summary as the dashboard's largest-content element. Charts remain immediately requested and are not delayed by viewport detection, idle callbacks, or user interaction.

Reuse the existing request-level session cache and service caches. Do not add a dashboard aggregation layer or duplicate client-side fetching.

### Client work

Audit the client-provider tree and dashboard route chunks, then remove only work not required for the first usable render. Preserve theme, locale, privacy, navigation, pull-to-refresh, and chart behavior.

Keep existing chart bundle boundaries. Reduce initial hydration and transferred JavaScript where possible without combining chart bundles or adding a dependency.

### Vercel Fluid CPU constraint

Current Fluid CPU usage is a hard ceiling. The change must add no background job, prewarming request, polling loop, extra server invocation, or duplicate database/API read.

Favor static shell delivery, removal of repeated work, request-cache reuse, and smaller client hydration. Keep current cache lifetimes unless measurement demonstrates that a change lowers total compute. Reject any implementation whose comparable production measurements increase CPU time per dashboard request or invocation count.

### Errors and security

Preserve existing authentication redirects and route error handling. The shell must never include cached or stale financial values. A failed authenticated dashboard load uses the existing error/retry path rather than retaining previously rendered user data.

## Verification

1. Build the production app and confirm `/` remains partially prerendered.
2. Run five cold dashboard loads with a throttled mid-range mobile profile and compare medians for FCP, LCP, blocking time, request count, and transferred bytes.
3. Accept only a repeatable FCP/LCP improvement beyond run-to-run variance, with no regression in CLS or interaction readiness.
4. Add one mobile loading-flow check that verifies the non-personalized shell appears first, the authenticated summary follows, and every dashboard chart eventually renders.
5. Confirm the initial dashboard route bundle does not grow. Keep the existing aggregate bundle gate.
6. Compare Vercel CPU time per dashboard request and invocation count under equivalent traffic. Both must remain at or below baseline.

## Out of scope

- Removing or deferring dashboard charts
- Changing dashboard information architecture or visual design
- Adding dependencies, background computation, or new caching infrastructure
- Optimizing later client-side navigation or non-dashboard routes
