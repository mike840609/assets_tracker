import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Hoisted fixtures so the vi.mock factories can close over them.
interface SnapshotFixture {
  date: Date;
  createdAt: Date;
  netWorth: number;
  baseCurrency: string;
}
const h = vi.hoisted(() => ({
  snapshots: [] as SnapshotFixture[],
}));

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    netWorthSnapshot: {
      findMany: vi.fn(async () =>
        h.snapshots.map((s) => ({
          date: s.date,
          createdAt: s.createdAt,
          netWorth: s.netWorth,
          baseCurrency: s.baseCurrency,
        })),
      ),
    },
    account: { findMany: vi.fn(async () => []) },
    cashTransaction: { findMany: vi.fn(async () => []) },
  },
}));
// Keep resolveRate real (identity path returns 1 for same-currency); only stub
// the bulk loader so no DB/network is hit.
vi.mock("@/lib/services/exchange-rate-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => new Map<string, number>()) };
});

import { getProjectionData } from "@/lib/services/projection-service";

describe("getProjectionData annual bucketing", () => {
  // Regression for #514: snapshots are stored at UTC-midnight and deduped by
  // their UTC date (`toISOString().split("T")[0]`), so the per-year bucket key
  // must also be UTC. Read with a local getter, a Jan-1-UTC snapshot lands in
  // the prior year for a west-of-UTC server. Force America/New_York (UTC-5) so
  // this fails with the old local-getter code and passes with the fix,
  // regardless of the CI runner's own timezone (UTC).
  describe("under a west-of-UTC timezone (America/New_York)", () => {
    const originalTz = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "America/New_York";
    });
    afterAll(() => {
      process.env.TZ = originalTz;
    });

    it("buckets a 2026-01-01T00:00:00Z snapshot into year 2026", async () => {
      h.snapshots = [
        {
          date: new Date("2025-06-01T00:00:00.000Z"),
          createdAt: new Date("2025-06-01T00:00:00.000Z"),
          netWorth: 500,
          baseCurrency: "USD",
        },
        {
          date: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          netWorth: 1000,
          baseCurrency: "USD",
        },
      ];
      const result = await getProjectionData("u1", "USD");
      const years = result.annualSnapshots.map((a) => a.year);
      expect(years).toContain(2026);
      expect(years).not.toContain(2025.5); // sanity
      const y2026 = result.annualSnapshots.find((a) => a.year === 2026);
      expect(y2026?.netWorth).toBe(1000);
    });
  });

  it("dedupes same-day snapshots by target base currency, then latest createdAt", async () => {
    h.snapshots = [
      {
        date: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        netWorth: 500,
        baseCurrency: "USD",
      },
      {
        date: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T13:00:00.000Z"),
        netWorth: 999,
        baseCurrency: "EUR",
      },
      {
        date: new Date("2026-03-01T00:00:00.000Z"),
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        netWorth: 300,
        baseCurrency: "USD",
      },
    ];

    const result = await getProjectionData("u1", "USD");

    expect(result.latestNetWorth).toBe(500);
    expect(result.annualSnapshots).toEqual([{ year: 2026, netWorth: 500 }]);
  });
});
