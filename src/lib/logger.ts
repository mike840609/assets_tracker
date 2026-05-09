/* eslint-disable no-console */
import "server-only";

type Level = "info" | "warn" | "error" | "debug";
type Meta = Record<string, unknown>;

function emit(level: Level, msg: string, meta?: Meta): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, meta?: Meta) => emit("info", msg, meta),
  warn: (msg: string, meta?: Meta) => emit("warn", msg, meta),
  error: (msg: string, meta?: Meta) => emit("error", msg, meta),
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
    });
    throw err;
  }
}
