/* eslint-disable no-console */
import "server-only";
import * as Sentry from "@sentry/nextjs";

type Level = "info" | "warn" | "error" | "debug";
type Meta = Record<string, unknown>;

// Pass the original Error here (alongside the human-readable `error` string) so
// Sentry can capture the full stack via captureException. Stripped from the
// JSON log line so output stays unchanged from before E19.
const SENTRY_ERROR_KEY = "__error";

function emit(level: Level, msg: string, meta?: Meta): void {
  const logMeta = meta ? { ...meta } : undefined;
  if (logMeta && SENTRY_ERROR_KEY in logMeta) delete logMeta[SENTRY_ERROR_KEY];
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...logMeta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// E19 — When SENTRY_DSN is configured, forward errors/warnings to Sentry in
// addition to the structured JSON logging above. This is best-effort and must
// never throw or alter the logging contract: if the DSN is unset the SDK is
// never initialized and these calls are skipped entirely. `@sentry/nextjs` is
// already loaded on the server via the instrumentation hook, so importing it
// here adds no extra cost.
const sentryEnabled = Boolean(process.env.SENTRY_DSN);
const captureWarnings = ["1", "true", "yes", "on"].includes(
  (process.env.SENTRY_CAPTURE_WARNINGS ?? "").toLowerCase(),
);

function reportToSentry(level: "warn" | "error", msg: string, meta?: Meta): void {
  if (!sentryEnabled) return;
  try {
    // Sentry is statically imported (server-only module, already initialized by
    // the instrumentation hook). When no DSN is configured these capture calls
    // are guarded out above and never reached.
    const err = meta?.[SENTRY_ERROR_KEY] ?? meta?.error;
    const extra = meta ? { ...meta } : undefined;
    if (extra) delete extra[SENTRY_ERROR_KEY];
    // Sentry's SeverityLevel uses "warning", not the logger's "warn".
    const sentryLevel = level === "warn" ? "warning" : "error";
    if (level === "warn" && !captureWarnings) {
      Sentry.addBreadcrumb({
        category: "app.warning",
        level: sentryLevel,
        message: msg,
        data: extra,
      });
      return;
    }
    if (err instanceof Error) {
      Sentry.captureException(err, { level: sentryLevel, extra: { msg, ...extra } });
    } else {
      Sentry.captureMessage(msg, { level: sentryLevel, extra });
    }
  } catch {
    // Sentry not initialized / failed to load — swallow so logging never breaks.
  }
}

export const log = {
  info: (msg: string, meta?: Meta) => emit("info", msg, meta),
  warn: (msg: string, meta?: Meta) => {
    emit("warn", msg, meta);
    reportToSentry("warn", msg, meta);
  },
  error: (msg: string, meta?: Meta) => {
    emit("error", msg, meta);
    reportToSentry("error", msg, meta);
  },
  debug: (msg: string, meta?: Meta) => emit("debug", msg, meta),
};

export async function withTiming<T>(label: string, fn: () => Promise<T>, meta?: Meta): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(label, { ...meta, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    log.error(label, {
      ...meta,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      [SENTRY_ERROR_KEY]: err,
    });
    throw err;
  }
}
