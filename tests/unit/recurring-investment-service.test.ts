import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  dueRules: [] as Array<Record<string, unknown>>,
  rates: new Map<string, number>(),
  prices: [] as Array<{ symbol: string; price: number; currency: string }>,
  existingHoldingCurrency: null as string | null,
  transactionalHoldingCurrency: "USD",
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

// Keep resolveRate real (pure); the service now reads rates straight from the
// DB (prisma.exchangeRate.findMany), so no data-loader override is needed.
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual };
});

// The service now reads PriceCache directly; fetch* are the new-symbol fallback.
vi.mock("@/lib/services/price-service", () => ({
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
    exchangeRate: {
      findMany: vi.fn(async () =>
        [...h.rates].map(([key, rate]) => {
          const [fromCurrency, toCurrency] = key.split("_");
          return { fromCurrency, toCurrency, rate };
        }),
      ),
    },
    priceCache: {
      findUnique: vi.fn(async (args: { where: { symbol: string } }) => {
        const p = h.prices.find((x) => x.symbol === args.where.symbol);
        return p ? { price: p.price, currency: p.currency } : null;
      }),
      upsert: vi.fn(async () => ({})),
    },
    holding: {
      findUnique: vi.fn(async () =>
        h.existingHoldingCurrency ? { currency: h.existingHoldingCurrency } : null,
      ),
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        h.upserts.push(args);
        return { id: "holding1", currency: h.transactionalHoldingCurrency };
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
    h.existingHoldingCurrency = null;
    h.transactionalHoldingCurrency = "USD";
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
    expect(Number(h.createManyCalls[0].data[0].unitPrice)).toBe(200);
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

  it("skips (no writes, no advance) when the cross-currency rate is unresolvable", async () => {
    // TWD account buying a USD-priced stock, but the rate map is empty.
    h.rates = new Map();
    h.prices = [{ symbol: "NVDA", price: 200, currency: "USD" }];
    h.dueRules = [rule({ amount: 30000, account: { currency: "TWD" } })];
    const result = await materializeDueInvestments(d("2026-06-14"));

    // Must NOT fall back to rate 1 (which would mint ~150 shares instead of ~5).
    expect(result.created).toBe(0);
    expect(h.createManyCalls).toHaveLength(0);
    expect(h.accountUpdates).toHaveLength(0);
    expect(h.ruleUpdates).toHaveLength(0); // nextRunDate untouched → retries next run
  });

  it("skips (no writes, no advance) when the holding and price currencies differ", async () => {
    h.existingHoldingCurrency = "TWD";
    h.dueRules = [rule()];

    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(h.upserts).toHaveLength(0);
    expect(h.createManyCalls).toHaveLength(0);
    expect(h.holdingUpdates).toHaveLength(0);
    expect(h.accountUpdates).toHaveLength(0);
    expect(h.ruleUpdates).toHaveLength(0); // nextRunDate untouched → retries after data is fixed
  });

  it("rolls back when a concurrent holding has a different currency", async () => {
    h.existingHoldingCurrency = null;
    h.transactionalHoldingCurrency = "TWD";
    h.dueRules = [rule()];

    const result = await materializeDueInvestments(d("2026-06-14"));

    expect(result).toEqual({ created: 0, rulesProcessed: 1 });
    expect(h.upserts).toHaveLength(1);
    expect(h.createManyCalls).toHaveLength(0);
    expect(h.holdingUpdates).toHaveLength(0);
    expect(h.accountUpdates).toHaveLength(0);
    expect(h.ruleUpdates).toHaveLength(0); // nextRunDate untouched → retries after data is fixed
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
