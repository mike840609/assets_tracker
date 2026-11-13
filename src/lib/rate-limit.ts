/**
 * R3 — Sliding-window rate limiter (zero external dependencies).
 *
 * Uses a module-level Map so the state is shared across requests that hit the
 * same warm serverless instance. On Vercel Node.js runtime this provides
 * meaningful per-IP throttling; cold starts reset the window, which is an
 * acceptable trade-off until Upstash / Vercel KV is wired in.
 *
 * Usage:
 *   const key = rateLimitKeyForClientIp(request, "search");
 *   const limited = rateLimitCheckWithPrune(request, { limit: 60, windowMs: 60_000, key });
 *   if (limited) return limited;          // 429 response
 */

import { createHmac } from "node:crypto";
import { getClientIp } from "@/lib/client-ip";

export { getClientIp, getClientIpFromHeaders } from "@/lib/client-ip";

interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Sliding-window duration in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
  /** Identifier prefix to namespace the key in the shared store. */
  prefix?: string;
  /**
   * Opaque identity to limit on. Callers must use one of the HMAC helpers
   * below; the module-level store must never retain raw IPs or user IDs.
   */
  key: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Process-wide store, shared across warm invocations on the same instance. It
// lives on globalThis because a production build bundles this module into several
// chunks (route handlers and each server-action/SSR layer); a module-level Map
// would give each copy its own buckets and multiply every limit.
const globalForRateLimit = globalThis as unknown as { __rateLimitStore?: Map<string, WindowEntry> };
const store = (globalForRateLimit.__rateLimitStore ??= new Map<string, WindowEntry>());

const RATE_LIMIT_TEST_SECRET = "asset-tracker-rate-limit-test-secret";

function getRateLimitSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "test") return RATE_LIMIT_TEST_SECRET;
  throw new Error("AUTH_SECRET is required to create rate-limit identity keys");
}

/**
 * Derive a non-reversible key for module-memory rate limiting. The purpose is
 * included in the HMAC input so a subject cannot be correlated across route
 * families by inspecting warm-instance Map keys.
 */
export function rateLimitKeyForIdentity(identity: string, purpose: string): string {
  return createHmac("sha256", getRateLimitSecret())
    .update(`asset-tracker/rate-limit/${purpose}/v1\u0000${identity}`)
    .digest("base64url");
}

export function rateLimitKeyForClientIp(request: Request, purpose: string): string {
  return rateLimitKeyForIdentity(getClientIp(request), `ip/${purpose}`);
}

export function rateLimitKeyForSubject(subject: string, purpose: string): string {
  return rateLimitKeyForIdentity(subject, `subject/${purpose}`);
}

type RateLimitDecision = {
  retryAfter: number;
  resetAt: number;
};

function checkRateLimit(options: RateLimitOptions): RateLimitDecision | null {
  const { limit, windowMs = 60_000, prefix = "rl" } = options;
  if (!options.key) throw new Error("Rate limiter requires an explicit key");
  const key = `${prefix}:${options.key}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // First request in window (or expired window) — initialise.
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      resetAt: entry.resetAt,
    };
  }

  return null;
}

/**
 * Check the rate limit for the incoming request.
 *
 * @returns A 429 Response if the limit is exceeded, otherwise `null`.
 */
function rateLimitCheck(request: Request, options: RateLimitOptions): Response | null {
  void request;
  const decision = checkRateLimit(options);
  if (decision === null) return null;

  const { limit } = options;
  return new Response(JSON.stringify({ error: { message: "Too many requests" } }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(decision.retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
    },
  });
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
export function rateLimitCheckWithPrune(
  request: Request,
  options: RateLimitOptions,
): Response | null {
  maybePrune();
  return rateLimitCheck(request, options);
}

export function rateLimitSubjectCheckWithPrune(
  subject: string,
  purpose: string,
  options: Omit<RateLimitOptions, "key">,
): boolean {
  maybePrune();
  return (
    checkRateLimit({
      ...options,
      key: rateLimitKeyForSubject(subject, purpose),
    }) !== null
  );
}

/**
 * Failure-counting variant: `isSubjectRateLimited` only reads the window, and
 * `recordSubjectHit` counts one event. Use when only some outcomes should count
 * (e.g. failed logins) but the limit must still be checked before acting.
 */
export function isSubjectRateLimited(
  subject: string,
  purpose: string,
  { limit, prefix = "rl" }: Omit<RateLimitOptions, "key">,
): boolean {
  maybePrune();
  const entry = store.get(`${prefix}:${rateLimitKeyForSubject(subject, purpose)}`);
  return entry !== undefined && Date.now() < entry.resetAt && entry.count >= limit;
}

export function recordSubjectHit(
  subject: string,
  purpose: string,
  options: Omit<RateLimitOptions, "key">,
): void {
  checkRateLimit({ ...options, key: rateLimitKeyForSubject(subject, purpose) });
}

/** Test-only inspection that proves raw request identity values never enter the store. */
export function __getRateLimitStoreKeysForTest(): string[] {
  return [...store.keys()];
}
