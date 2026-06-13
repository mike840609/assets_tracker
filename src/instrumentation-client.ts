import * as Sentry from "@sentry/nextjs";
import {
  beforeSend,
  getSentryDist,
  getSentryEnvironment,
  getSentryRelease,
  getSentryTags,
} from "@/lib/sentry-config";

// E19 — Client-side Sentry init. This file runs in the browser before React
// hydration (Next.js `instrumentation-client` convention), so it cannot import
// the server-only `@/lib/env`; the DSN is read from the build-time-inlined
// `NEXT_PUBLIC_SENTRY_DSN`. With no DSN the SDK is never initialized and every
// capture call is a no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    dist: getSentryDist(),
    initialScope: { tags: getSentryTags("browser") },
    beforeSend,
    enabled: true,
  });
}

// Required by the Sentry Next.js SDK to instrument client-side navigations. Safe
// to export even when Sentry is uninitialized — it no-ops without a DSN.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
