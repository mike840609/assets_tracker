import { beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitRow = { count: number; resetAt: Date };

const { prisma } = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn<(...args: unknown[]) => Promise<RateLimitRow[]>>(),
    rateLimitBucket: {
      deleteMany: vi.fn<(...args: unknown[]) => Promise<{ count: number }>>(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const request = new Request("https://astt.app/api/search", {
  headers: { "x-forwarded-for": "203.0.113.7" },
});

describe("rateLimitCheckWithPrune", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps the bucket in the shared store across module reloads", async () => {
    const buckets = new Map<string, RateLimitRow>();

    prisma.$queryRawUnsafe.mockImplementation(async (...args: unknown[]) => {
      const [, key, resetAt, now] = args as [string, string, Date, Date];
      const existing = buckets.get(key);
      const next =
        !existing || existing.resetAt <= now
          ? { count: 1, resetAt }
          : { count: existing.count + 1, resetAt: existing.resetAt };
      buckets.set(key, next);
      return [next];
    });

    let rateLimit = await import("@/lib/rate-limit");

    const first = await rateLimit.rateLimitCheckWithPrune(request, {
      limit: 1,
      prefix: "durable",
      key: "user-1",
    });

    expect(first).toBeNull();

    vi.resetModules();
    rateLimit = await import("@/lib/rate-limit");

    const limited = await rateLimit.rateLimitCheckWithPrune(request, {
      limit: 1,
      prefix: "durable",
      key: "user-1",
    });

    expect(limited?.status).toBe(429);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it("returns 429 from the atomically incremented database count", async () => {
    const resetAt = new Date(Date.now() + 60_000);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: 3, resetAt }]);

    const { rateLimitCheckWithPrune } = await import("@/lib/rate-limit");

    const limited = await rateLimitCheckWithPrune(request, {
      limit: 2,
      prefix: "atomic",
      key: "user-2",
    });

    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("60");
    expect(limited?.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(limited?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(limited?.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(resetAt.getTime() / 1000)),
    );

    const [sql, key] = prisma.$queryRawUnsafe.mock.calls[0]!;
    expect(key).toBe("atomic:user-2");
    expect(String(sql)).toContain('ON CONFLICT ("key") DO UPDATE');
    expect(String(sql)).toContain('RETURNING "count", "resetAt"');
  });
});
