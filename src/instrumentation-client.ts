// E19 — Client-side Sentry init. This file runs in the browser before React
// hydration (Next.js `instrumentation-client` convention), so it cannot import
// the server-only `@/lib/env`; the DSN is read from the build-time-inlined
// `NEXT_PUBLIC_SENTRY_DSN`. When no DSN is configured at build time the SDK
// import is dead-code eliminated entirely, keeping it out of shared route
// chunks; builds with a DSN keep full telemetry behavior.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

async function initializeSentry(): Promise<void> {
  if (!dsn) return;

  const [{ spanStreamingIntegration }, { initializeSentryClient }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/sentry-client-init"),
  ]);

  initializeSentryClient({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    spanStreamingIntegration,
  });
}

void initializeSentry();

export {};
