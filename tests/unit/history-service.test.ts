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
  label: string | null;
  note: string | null;
}
const h = vi.hoisted(() => ({
  rows: [] as SnapshotRowFixture[],
  currentYearRows: [] as SnapshotRowFixture[],
  previousRows: [] as SnapshotRowFixture[],
  previousDateRow: null as { date: Date } | null,
  latestSnapshot: null as SnapshotRowFixture | null,
  accounts: [] as unknown[],
  prices: [] as { symbol: string; price: number; currency: string }[],
  rates: new Map<string, number>(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T): T => fn };
});
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  withTiming: <T>(_name: string, fn: () => T) => fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: { findMany: vi.fn(async () => h.accounts) },
    netWorthSnapshot: {
      findMany: vi.fn(async (args?: { where?: { date?: Date | { gte?: Date } } }) => {
        const dateWhere = args?.where?.date;
        if (dateWhere instanceof Date) return h.previousRows;
        if (dateWhere && "gte" in dateWhere) return h.currentYearRows;
        return h.rows;
      }),
      findFirst: vi.fn(async (args?: { where?: { date?: { lt?: Date } } }) => {
        if (args?.where?.date?.lt) return h.previousDateRow;
        return h.latestSnapshot;
      }),
    },
    priceCache: { findMany: vi.fn(async () => h.prices) },
  },
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

const {
  getCurrentYearNormalizedHistory,
  getFullNormalizedHistory,
  getSnapshotReconciliationWarning,
} = await import("@/lib/services/history-service");

function row(
  over: Partial<SnapshotRowFixture> & Pick<SnapshotRowFixture, "id" | "date">,
): SnapshotRowFixture {
  return {
    createdAt: over.date,
    netWorth: 100,
    totalAssets: 100,
    totalLiabilities: 0,
    baseCurrency: "USD",
    label: null,
    note: null,
    ...over,
  };
}

const created = new Date("2026-01-01T00:00:00.000Z");

function account(over: Record<string, unknown> = {}) {
  return {
    id: "acc",
    userId: "u1",
    name: "Cash",
    type: "ASSET",
    category: "BANK",
    currency: "USD",
    cashBalance: 1100,
    isActive: true,
    isPinned: false,
    sortOrder: 0,
    createdAt: created,
    updatedAt: created,
    holdings: [],
    ...over,
  };
}

beforeEach(() => {
  vi.useRealTimers();
  h.rows = [];
  h.currentYearRows = [];
  h.previousRows = [];
  h.previousDateRow = null;
  h.latestSnapshot = null;
  h.accounts = [];
  h.prices = [];
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

  it("preserves snapshot label and note through normalization", async () => {
    h.rows = [
      row({
        id: "labelled",
        date: new Date("2026-01-01T00:00:00.000Z"),
        label: "Bonus paid",
        note: "Annual bonus landed in brokerage cash.",
      }),
    ];

    const result = await getFullNormalizedHistory("u1", "USD");

    expect(result[0]).toMatchObject({
      id: "labelled",
      label: "Bonus paid",
      note: "Annual bonus landed in brokerage cash.",
    });
  });
});

describe("getCurrentYearNormalizedHistory", () => {
  it("returns current-year snapshots plus the latest prior day for delta context", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:00:00.000Z"));

    const priorDate = new Date("2025-12-31T00:00:00.000Z");
    h.previousDateRow = { date: priorDate };
    h.previousRows = [row({ id: "prior", date: priorDate, netWorth: 90 })];
    h.currentYearRows = [
      row({ id: "jan", date: new Date("2026-01-01T00:00:00.000Z"), netWorth: 100 }),
      row({ id: "today", date: new Date("2026-06-14T00:00:00.000Z"), netWorth: 120 }),
    ];

    const result = await getCurrentYearNormalizedHistory("u1", "USD");

    expect(result.map((s) => s.date)).toEqual(["2025-12-31", "2026-01-01", "2026-06-14"]);
  });

  it("returns only current-year snapshots when there is no prior history", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:00:00.000Z"));

    h.currentYearRows = [
      row({ id: "jan", date: new Date("2026-01-01T00:00:00.000Z"), netWorth: 100 }),
    ];

    const result = await getCurrentYearNormalizedHistory("u1", "USD");

    expect(result.map((s) => s.date)).toEqual(["2026-01-01"]);
  });
});

describe("getSnapshotReconciliationWarning", () => {
  it("returns a non-mutating warning when current balances drift past the threshold", async () => {
    h.latestSnapshot = row({
      id: "snap",
      date: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T06:00:00.000Z"),
      netWorth: 1000,
      label: "Manual correction",
      note: "Imported brokerage migration.",
    });
    h.accounts = [account()];

    const warning = await getSnapshotReconciliationWarning("u1", "USD");

    expect(warning).toMatchObject({
      difference: 100,
      baseCurrency: "USD",
    });
    expect(warning?.differencePercent).toBeCloseTo(0.1);
  });

  it("returns null when drift stays inside the threshold", async () => {
    h.latestSnapshot = row({
      id: "snap",
      date: new Date("2026-01-01T00:00:00.000Z"),
      netWorth: 1000,
    });
    h.accounts = [account({ cashBalance: 1030 })];

    await expect(getSnapshotReconciliationWarning("u1", "USD")).resolves.toBeNull();
  });
});
