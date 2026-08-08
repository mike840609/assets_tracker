import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dbError: false,
  latestSnapshotAt: null as Date | null,
  cronRuns: [] as Array<{ startedAt: Date; finishedAt: Date | null; ok: boolean }>,
  latestPriceAt: null as Date | null,
  hasPriceableHolding: false,
  hasPriceableWatch: false,
  assetExistenceError: false,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: vi.fn(() => null),
  rateLimitKeyForClientIp: vi.fn(() => "hmac:health"),
}));
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => {
      if (h.dbError) throw new Error("database unavailable");
      return [{ "?column?": 1 }];
    }),
    netWorthSnapshot: {
      findFirst: vi.fn(async () => (h.latestSnapshotAt ? { createdAt: h.latestSnapshotAt } : null)),
    },
    cronRun: {
      findFirst: vi.fn(
        async (args?: {
          where?: { name?: string; ok?: boolean };
          select?: { startedAt?: boolean; finishedAt?: boolean; ok?: boolean };
        }) => {
          const matchingRuns =
            args?.where?.ok === undefined
              ? h.cronRuns
              : h.cronRuns.filter((run) => run.ok === args.where?.ok);
          const latest = [...matchingRuns].sort(
            (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
          )[0];
          if (!latest) return null;
          return {
            ...(args?.select?.startedAt && { startedAt: latest.startedAt }),
            ...(args?.select?.finishedAt && { finishedAt: latest.finishedAt }),
            ...(args?.select?.ok && { ok: latest.ok }),
          };
        },
      ),
    },
    priceCache: {
      aggregate: vi.fn(async () => ({ _max: { updatedAt: h.latestPriceAt } })),
    },
    holding: {
      findFirst: vi.fn(async () => {
        if (h.assetExistenceError) throw new Error("holding existence query unavailable");
        return h.hasPriceableHolding ? { id: "holding-1" } : null;
      }),
    },
    stockWatchItem: {
      findFirst: vi.fn(async () => (h.hasPriceableWatch ? { id: "watch-1" } : null)),
    },
  },
}));

describe("health route", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    h.dbError = false;
    h.latestSnapshotAt = now;
    h.cronRuns = [
      {
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        ok: false,
      },
      { startedAt: now, finishedAt: now, ok: true },
    ];
    h.latestPriceAt = now;
    h.hasPriceableHolding = false;
    h.hasPriceableWatch = false;
    h.assetExistenceError = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports fresh price-cache health without exposing sensitive market or user data", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", priceCache: "ok", priceAgeMs: 0 });
    expect(body).not.toHaveProperty("symbol");
    expect(body).not.toHaveProperty("symbols");
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("prices");
    expect(body).not.toHaveProperty("holdings");
    expect(body).not.toHaveProperty("users");
    expect(body).not.toHaveProperty("userId");
  });

  it("degrades when cached prices are stale", async () => {
    h.latestPriceAt = new Date(now.getTime() - 36 * 60 * 60 * 1000 - 1);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      priceCache: "stale",
    });
  });

  it("degrades for the latest completed failed attempt despite an older recent success", async () => {
    const olderSuccess = new Date(now.getTime() - 60 * 60 * 1000);
    h.cronRuns = [
      { startedAt: olderSuccess, finishedAt: olderSuccess, ok: true },
      { startedAt: now, finishedAt: now, ok: false },
    ];
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      cron: "error",
      latestCronAt: now.toISOString(),
      latestCronAgeMs: 0,
      lastCronSuccessAt: olderSuccess.toISOString(),
      cronAgeMs: 60 * 60 * 1000,
    });
    expect(body).not.toHaveProperty("users");
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("failedUserIds");
  });

  it("reports a recent unfinished attempt as running while a previous success keeps health fresh", async () => {
    const previousSuccess = new Date(now.getTime() - 60 * 60 * 1000);
    const activeStartedAt = new Date(now.getTime() - 60 * 1000);
    h.cronRuns = [
      { startedAt: previousSuccess, finishedAt: previousSuccess, ok: true },
      { startedAt: activeStartedAt, finishedAt: null, ok: false },
    ];
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      cron: "running",
      latestCronAt: activeStartedAt.toISOString(),
      latestCronAgeMs: 60 * 1000,
      lastCronSuccessAt: previousSuccess.toISOString(),
      cronAgeMs: 60 * 60 * 1000,
    });
  });

  it("keeps a first-ever unfinished attempt degraded while reporting it as running", async () => {
    const activeStartedAt = new Date(now.getTime() - 60 * 1000);
    h.cronRuns = [{ startedAt: activeStartedAt, finishedAt: null, ok: false }];
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      cron: "running",
      latestCronAt: activeStartedAt.toISOString(),
      lastCronSuccessAt: null,
      cronAgeMs: null,
    });
  });

  it("degrades an unfinished attempt that has exceeded the operational grace period", async () => {
    const previousSuccess = new Date(now.getTime() - 60 * 60 * 1000);
    const overdueStartedAt = new Date(now.getTime() - 5 * 60 * 1000 - 1);
    h.cronRuns = [
      { startedAt: previousSuccess, finishedAt: previousSuccess, ok: true },
      { startedAt: overdueStartedAt, finishedAt: null, ok: false },
    ];
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      cron: "error",
      latestCronAt: overdueStartedAt.toISOString(),
      latestCronAgeMs: 5 * 60 * 1000 + 1,
      lastCronSuccessAt: previousSuccess.toISOString(),
    });
  });

  it("degrades an empty cache when a priceable holding exists", async () => {
    h.latestPriceAt = null;
    h.hasPriceableHolding = true;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      priceCache: "stale",
      latestPriceAt: null,
      priceAgeMs: null,
    });
  });

  it("reports an empty cache without degrading an installation with no priceable assets", async () => {
    h.latestPriceAt = null;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      priceCache: "empty",
      latestPriceAt: null,
      priceAgeMs: null,
    });
  });

  it("returns unhealthy when an empty-cache asset-existence query fails", async () => {
    h.latestPriceAt = null;
    h.assetExistenceError = true;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unhealthy",
      db: "error",
      priceCache: "unknown",
    });
  });

  it("returns unhealthy when the lightweight health query fails", async () => {
    h.dbError = true;
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unhealthy",
      db: "error",
      priceCache: "unknown",
    });
  });
});
