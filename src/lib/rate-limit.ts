/**
 * R3 — fixed-window route-handler rate limiter.
 *
 * Route handlers use a Prisma-backed bucket so limits are shared across
 * serverless instances and survive cold starts. The write path is a single
 * PostgreSQL upsert that increments or resets the bucket atomically.
 *
 * `getClientIp` intentionally stays dependency-free because `src/proxy.ts`
 * imports it for the edge/proxy inline limiter.
 *
 * Usage:
 *   const limited = await rateLimitCheckWithPrune(request, { limit: 60, windowMs: 60_000 });
 *   if (limited) return limited;          // 429 response
 */

interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Sliding-window duration in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
  /** Identifier prefix to namespace the key in the shared store. */
  prefix?: string;
  /**
   * Explicit identity to limit on (e.g. userId for authenticated routes).
   * Falls back to the client IP when omitted.
   */
  key?: string;
}

interface RateLimitRow {
  count: number;
  resetAt: Date;
}

/** Extract the best available IP from the request headers. */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Check the rate limit for the incoming request.
 *
 * @returns A 429 Response if the limit is exceeded, otherwise `null`.
 */
async function rateLimitCheck(
  request: Request,
  options: RateLimitOptions,
): Promise<Response | null> {
  const { limit, windowMs = 60_000, prefix = "rl" } = options;
  const id = options.key ?? getClientIp(request);
  const key = `${prefix}:${id}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    const rows = await incrementBucket(key, resetAt, now);
    const entry = rows[0];

    if (!entry) {
      throw new Error("Rate limit increment returned no rows");
    }

    if (entry.count > limit) {
      return rateLimitedResponse(limit, entry.resetAt, now);
    }

    return null;
  } catch (error) {
    await logLimiterError(error);
    return new Response(
      JSON.stringify({ error: { message: "Rate limit is temporarily unavailable" } }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      },
    );
  }
}

async function incrementBucket(key: string, resetAt: Date, now: Date): Promise<RateLimitRow[]> {
  const { prisma } = await import("@/lib/prisma");

  return prisma.$queryRawUnsafe<RateLimitRow[]>(
    `
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES ($1, 1, $2, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= $3 THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= $3 THEN $2
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = NOW()
      RETURNING "count", "resetAt"
    `,
    key,
    resetAt,
    now,
  );
}

function rateLimitedResponse(limit: number, resetAt: Date, now: Date): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
  return new Response(JSON.stringify({ error: { message: "Too many requests" } }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(resetAt.getTime() / 1000)),
    },
  });
}

/**
 * Periodically prune expired buckets to prevent unbounded table growth.
 * Called lazily on each check; runs at most once per minute.
 */
let lastPruned = 0;
async function maybePrune(): Promise<void> {
  const now = Date.now();
  if (now - lastPruned < 60_000) return;
  lastPruned = now;

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.rateLimitBucket.deleteMany({
      where: {
        resetAt: {
          lte: new Date(now),
        },
      },
    });
  } catch (error) {
    await logLimiterError(error, "rate_limit.prune_failed");
  }
}

async function logLimiterError(error: unknown, message = "rate_limit.check_failed"): Promise<void> {
  try {
    const { log } = await import("@/lib/logger");
    log.error(message, { error: error instanceof Error ? error.message : String(error) });
  } catch {
    // Logging should never change rate-limit behavior.
  }
}

// Attach prune to the check function so callers don't need to think about it.
export async function rateLimitCheckWithPrune(
  request: Request,
  options: RateLimitOptions,
): Promise<Response | null> {
  await maybePrune();
  return rateLimitCheck(request, options);
}
