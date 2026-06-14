import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  dueRules: [] as Array<Record<string, unknown>>,
  rates: new Map<string, number>(),
  prices: [] as Array<{ symbol: string; price: number; currency: string }>,
  upserts: [] as Array<Record<string, unknown>>,
  createManyCalls: [] as Array<{ data: Array<Record<string, unknown>> }>,
  holdingUpdates: [] as Array<{ where: unknown; data: { quantity: { increment: unknown } } }>,
  accountUpdates: [] as Array<{ where: unknown; data: { cashBalance: { decrement: unknown } } }>,
  ruleUpdates: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
  createManyCount: null as number | null,
}));

vi.mock("@/lib/logger", () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

// Keep resolveRate real (pure), override only the data loader.
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

vi.mock("@/lib/services/price-service", () => ({
  getCachedPricesForSymbols: vi.fn(async () => h.prices),
  fetchStockPrices: vi.fn(async () => new Map()),
  fetchCryptoPrices: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recurringInvestment: {
      findMany: vi.fn(async () => h.dueRules),
      update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
        h.ruleUpdates.push(args);
        return {};
      }),
    },
    priceCache: { upsert: vi.fn(async () => ({})) },
    holding: {
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        h.upserts.push(args);
        return { id: "holding1" };
      }),
      update: vi.fn(
        async (args: { where: unknown; data: { quantity: { increment: unknown } } }) => {
          h.holdingUpdates.push(args);
          return {};
        },
      ),
    },
    account: {
      update: vi.fn(
        async (args: { where: unknown; data: { cashBalance: { decrement: unknown } } }) => {
          h.accountUpdates.push(args);
          return {};
        },
      ),
    },
    holdingTransaction: {
      createMany: vi.fn(async (args: { data: Array<Record<string, unknown>> }) => {
        h.createManyCalls.push(args);
        return { count: h.createManyCount ?? args.data.length };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import("@/lib/prisma");
      return fn(prisma);
    }),
  },
}));

import { materializeDueInvestments } from "@/lib/services/recurring-investment-service";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

function rule(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    accountId: "acc1",
    symbol: "NVDA",
    name: "NVIDIA",
    assetType: "STOCK",
    holdingCurrency: "USD",
    amount: 1000,
    frequency: "MONTHLY",
    note: null,
    startDate: d("2026-06-10"),
    endDate: null,
    nextRunDate: d("2026-06-10"),
    account: { currency: "USD" },
    ...over,
  };
}

describe("materializeDueInvestments", () => {
  beforeEach(() => {
    h.dueRules = [];
    h.rates = new Map();
    h.prices = [{ symbol: "NVDA", price: 200, currency: "USD" }];
    h.upserts = [];
    h.createManyCalls = [];
    h.holdingUpdates = [];
    h.accountUpdates = [];
    h.ruleUpdates = [];
    h.createManyCount = null;
  });

  it("buys amount÷price shares and debits cash (same currency)", async () => {
    h.dueRules = [rule()];
    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result).toEqual({ created: 1, rulesProcessed: 1 });
    // 1000 / 200 = 5 shares
    expect(Number(h.createManyCalls[0].data[0].quantity)).toBe(5);
    expect(h.createManyCalls[0].data[0].type).toBe("BUY");
    expect(Number(h.holdingUpdates[0].data.quantity.increment)).toBe(5);
    expect(Number(h.accountUpdates[0].data.cashBalance.decrement)).toBe(1000);
  });

  it("scales shares + cash by occurrence count on catch-up", async () => {
    // Monthly rule due since April → June 10, 14 occurrences: Apr/May/Jun.
    h.dueRules = [rule({ startDate: d("2026-04-10"), nextRunDate: d("2026-04-10") })];
    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result.created).toBe(3);
    expect(h.createManyCalls[0].data).toHaveLength(3);
    expect(Number(h.holdingUpdates[0].data.quantity.increment)).toBe(15); // 5 * 3
    expect(Number(h.accountUpdates[0].data.cashBalance.decrement)).toBe(3000); // 1000 * 3
  });

  it("converts the amount when account and price currencies differ", async () => {
    // Account in TWD, NVDA priced in USD. 30000 TWD * (USD per TWD) ÷ price.
    h.rates = new Map([["USD_TWD", 30]]); // resolveRate(TWD→USD) = 1/30
    h.prices = [{ symbol: "NVDA", price: 200, currency: "USD" }];
    h.dueRules = [rule({ amount: 30000, account: { currency: "TWD" } })];

    await materializeDueInvestments(d("2026-06-14"));

    // 30000 TWD → 1000 USD → 1000/200 = 5 shares (approx: the 1/30 FX rate is a
    // JS float, and the stored quantity is Decimal(18,8), so this is precise to
    // well beyond display granularity).
    expect(Number(h.createManyCalls[0].data[0].quantity)).toBeCloseTo(5, 6);
    // Cash debited in the account's own currency (TWD), not converted.
    expect(Number(h.accountUpdates[0].data.cashBalance.decrement)).toBe(30000);
  });

  it("auto-creates the holding with the resolved price currency", async () => {
    h.dueRules = [rule()];
    await materializeDueInvestments(d("2026-06-14"));

    const create = (h.upserts[0].create as Record<string, unknown>) ?? {};
    expect(create.symbol).toBe("NVDA");
    expect(create.assetType).toBe("STOCK");
    expect(create.currency).toBe("USD");
    expect(Number(create.quantity)).toBe(0);
  });

  it("skips (no writes, no advance) when no price is available", async () => {
    h.prices = [];
    h.dueRules = [rule()];
    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result.created).toBe(0);
    expect(h.createManyCalls).toHaveLength(0);
    expect(h.accountUpdates).toHaveLength(0);
    expect(h.ruleUpdates).toHaveLength(0); // nextRunDate untouched → retries next run
  });

  it("increments by inserted count, not occurrence count, on idempotent skip", async () => {
    h.dueRules = [rule({ startDate: d("2026-04-10"), nextRunDate: d("2026-04-10") })];
    h.createManyCount = 1; // one occurrence already existed
    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result.created).toBe(1);
    expect(Number(h.holdingUpdates[0].data.quantity.increment)).toBe(5); // 5 * 1
    expect(Number(h.accountUpdates[0].data.cashBalance.decrement)).toBe(1000);
  });
});
