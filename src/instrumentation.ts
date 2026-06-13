import * as Sentry from "@sentry/nextjs";

// E19 — Sentry server + edge init runs through Next.js's instrumentation hook.
// Guarded on DSN presence: with no SENTRY_DSN the SDK is never initialized, so
// captureException/captureMessage from the logger become safe no-ops and local
// dev / CI / `next build` need no Sentry account.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { log } = await import("@/lib/logger");
    log.info("instrumentation.register", { env: process.env.NODE_ENV });

    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        // Errors are always captured. Tracing is off by default (no perf budget
        // spent unless explicitly opted in via SENTRY_TRACES_SAMPLE_RATE).
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        enabled: true,
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      enabled: true,
    });
  }
}

// E19 — Next.js App Router server-error capture hook. `captureRequestError` is
// a no-op when Sentry was never initialized (no DSN), so this is safe to export
// unconditionally.
export const onRequestError = Sentry.captureRequestError;
