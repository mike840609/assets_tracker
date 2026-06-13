import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared fixtures, hoisted so the vi.mock factories (which are themselves
// hoisted above imports) can close over them.
interface SnapshotRowFixture {
  id: string;
  date: Date;
  createdAt: Date;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
}
const h = vi.hoisted(() => ({
  rows: [] as SnapshotRowFixture[],
  rates: new Map<string, number>(),
}));

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  withTiming: <T>(_name: string, fn: () => T) => fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { netWorthSnapshot: { findMany: vi.fn(async () => h.rows) } },
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

const { getFullNormalizedHistory } = await import("@/lib/services/history-service");

function row(
  over: Partial<SnapshotRowFixture> & Pick<SnapshotRowFixture, "id" | "date">,
): SnapshotRowFixture {
  return {
    createdAt: over.date,
    netWorth: 100,
    totalAssets: 100,
    totalLiabilities: 0,
    baseCurrency: "USD",
    ...over,
  };
}

beforeEach(() => {
  h.rows = [];
  h.rates = new Map<string, number>();
});

describe("getFullNormalizedHistory (normalize + dedupe — locks E2)", () => {
  it("sorts ascending by date", async () => {
    h.rows = [
      row({ id: "b", date: new Date("2026-02-01T00:00:00.000Z") }),
      row({ id: "a", date: new Date("2026-01-01T00:00:00.000Z") }),
    ];
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result.map((s) => s.date)).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("prefers the snapshot whose baseCurrency matches the target on same-day collisions", async () => {
    // The non-matching TWD row has the LATER createdAt, proving the
    // currency-match tie-break outranks recency.
    h.rows = [
      row({
        id: "usd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T06:00:00.000Z"),
        netWorth: 1000,
        baseCurrency: "USD",
      }),
      row({
        id: "twd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        netWorth: 30000,
        baseCurrency: "TWD",
      }),
    ];
    h.rates = new Map([["USD_TWD", 30]]);
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("usd");
    expect(result[0].netWorth).toBe(1000);
  });

  it("breaks same-currency same-day ties by greatest createdAt", async () => {
    h.rows = [
      row({
        id: "early",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T01:00:00.000Z"),
        netWorth: 100,
      }),
      row({
        id: "late",
        date: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T23:00:00.000Z"),
        netWorth: 200,
      }),
    ];
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("late");
    expect(result[0].netWorth).toBe(200);
  });

  it("renormalizes a non-target-currency snapshot using the current rate map", async () => {
    h.rows = [
      row({
        id: "twd",
        date: new Date("2026-01-01T00:00:00.000Z"),
        netWorth: 3000,
        totalAssets: 3300,
        totalLiabilities: 300,
        baseCurrency: "TWD",
      }),
    ];
    h.rates = new Map([["USD_TWD", 30]]); // TWD→USD = 1/30
    const result = await getFullNormalizedHistory("u1", "USD");
    expect(result[0].netWorth).toBeCloseTo(100);
    expect(result[0].totalAssets).toBeCloseTo(110);
    expect(result[0].totalLiabilities).toBeCloseTo(10);
    expect(result[0].baseCurrency).toBe("USD");
  });
});
