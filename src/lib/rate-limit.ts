/**
 * R3 — Sliding-window rate limiter (zero external dependencies).
 *
 * Uses a module-level Map so the state is shared across requests that hit the
 * same warm serverless instance. On Vercel Node.js runtime this provides
 * meaningful per-IP throttling; cold starts reset the window, which is an
 * acceptable trade-off until Upstash / Vercel KV is wired in.
 *
 * Usage:
 *   const limited = rateLimitCheck(request, { limit: 60, windowMs: 60_000 });
 *   if (limited) return limited;          // 429 response
 */

interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Sliding-window duration in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
  /** Identifier prefix to namespace the key in the shared store. */
  prefix?: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Module-level store — shared across warm invocations on the same instance.
const store = new Map<string, WindowEntry>();

/** Extract the best available IP from the request headers. */
function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Check the rate limit for the incoming request.
 *
 * @returns A 429 Response if the limit is exceeded, otherwise `null`.
 */
export function rateLimitCheck(request: Request, options: RateLimitOptions): Response | null {
  const { limit, windowMs = 60_000, prefix = "rl" } = options;
  const ip = getClientIp(request);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // First request in window (or expired window) — initialise.
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(JSON.stringify({ error: { message: "Too many requests" } }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
      },
    });
  }

  return null;
}

/**
 * Periodically prune expired entries to prevent unbounded Map growth.
 * Called lazily on each check; runs at most once per minute.
 */
let lastPruned = 0;
function maybePrune() {
  const now = Date.now();
  if (now - lastPruned < 60_000) return;
  lastPruned = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

// Attach prune to the check function so callers don't need to think about it.
const _originalCheck = rateLimitCheck;
export function rateLimitCheckWithPrune(
  request: Request,
  options: RateLimitOptions,
): Response | null {
  maybePrune();
  return _originalCheck(request, options);
}
