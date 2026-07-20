import { beforeEach, describe, expect, it, vi } from "vitest";

const created = new Date("2026-01-01T00:00:00.000Z");

interface TransactionFixture {
  id: string;
  type: "BUY" | "SELL" | "EDIT";
  quantity: number;
  unitPrice: number | null;
  createdAt: Date;
  occurrenceDate: Date | null;
}

interface HoldingFixture {
  symbol: string;
  quantity: number;
  currency: string;
  assetType: "STOCK" | "OPTION";
  contractMultiplier: number | null;
  transactions: TransactionFixture[];
}

interface AccountFixture {
  currency: string;
  holdings: HoldingFixture[];
}

const h = vi.hoisted(() => ({
  accounts: [] as AccountFixture[],
  prices: [] as { symbol: string; price: number; currency: string }[],
  rates: new Map<string, number>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: { findMany: vi.fn(async () => h.accounts) },
    priceCache: { findMany: vi.fn(async () => h.prices) },
  },
}));

vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

const { getInvestmentCostBasisSummary } =
  await import("@/lib/services/investment-cost-basis-service");

function tx(
  over: Partial<TransactionFixture> & Pick<TransactionFixture, "id" | "type" | "quantity">,
): TransactionFixture {
  return {
    unitPrice: null,
    createdAt: created,
    occurrenceDate: null,
    ...over,
  };
}

function holding(
  over: Partial<HoldingFixture> &
    Pick<HoldingFixture, "symbol" | "quantity" | "currency" | "assetType">,
): HoldingFixture {
  return {
    contractMultiplier: null,
    transactions: [],
    ...over,
  };
}

function account(over: Partial<AccountFixture> = {}): AccountFixture {
  return {
    currency: "USD",
    holdings: [],
    ...over,
  };
}

beforeEach(() => {
  h.accounts = [];
  h.prices = [];
  h.rates = new Map<string, number>();
});

describe("getInvestmentCostBasisSummary", () => {
  it("replays transactions by effective date, then createdAt, then id", async () => {
    h.accounts = [
      account({
        holdings: [
          holding({
            symbol: "AAPL",
            quantity: 5,
            currency: "USD",
            assetType: "STOCK",
            transactions: [
              tx({
                id: "buy-late-created",
                type: "BUY",
                quantity: 10,
                unitPrice: 100,
                createdAt: new Date("2026-01-03T00:00:00.000Z"),
                occurrenceDate: new Date("2026-01-01T00:00:00.000Z"),
              }),
              tx({
                id: "sell-early-created",
                type: "SELL",
                quantity: 5,
                createdAt: new Date("2026-01-02T00:00:00.000Z"),
                occurrenceDate: new Date("2026-01-02T00:00:00.000Z"),
              }),
            ],
          }),
        ],
      }),
    ];
    h.prices = [{ symbol: "AAPL", price: 120, currency: "USD" }];

    const summary = await getInvestmentCostBasisSummary("u1", "USD");

    expect(summary.marketValue).toBeCloseTo(600);
    expect(summary.costBasis).toBeCloseTo(500);
    expect(summary.unrealizedGain).toBeCloseTo(100);
    expect(summary.unrealizedGainPct).toBeCloseTo(0.2);
    expect(summary.pricedHoldingCount).toBe(1);
    expect(summary.costedHoldingCount).toBe(1);
  });

  it("applies option multiplier and FX conversion to market value and cost basis", async () => {
    h.accounts = [
      account({
        holdings: [
          holding({
            symbol: "AAPL240119C00150000",
            quantity: 2,
            currency: "USD",
            assetType: "OPTION",
            contractMultiplier: 100,
            transactions: [
              tx({
                id: "buy-option",
                type: "BUY",
                quantity: 2,
                unitPrice: 2,
              }),
            ],
          }),
        ],
      }),
    ];
    h.prices = [{ symbol: "AAPL240119C00150000", price: 5, currency: "USD" }];
    h.rates = new Map([["USD_TWD", 30]]);

    const summary = await getInvestmentCostBasisSummary("u1", "TWD");

    expect(summary.marketValue).toBeCloseTo(30000);
    expect(summary.costBasis).toBeCloseTo(12000);
    expect(summary.unrealizedGain).toBeCloseTo(18000);
    expect(summary.unrealizedGainPct).toBeCloseTo(1.5);
    expect(summary.pricedHoldingCount).toBe(1);
    expect(summary.costedHoldingCount).toBe(1);
  });

  it("excludes uncosted holdings' market value from unrealized gain", async () => {
    h.accounts = [
      account({
        holdings: [
          holding({
            symbol: "COSTED",
            quantity: 10,
            currency: "USD",
            assetType: "STOCK",
            transactions: [tx({ id: "b1", type: "BUY", quantity: 10, unitPrice: 800 })],
          }),
          holding({
            symbol: "UNCOSTED",
            quantity: 10,
            currency: "USD",
            assetType: "STOCK",
            // Quantity-only import: BUY without a unit price → no cost basis.
            transactions: [tx({ id: "b2", type: "BUY", quantity: 10 })],
          }),
        ],
      }),
    ];
    h.prices = [
      { symbol: "COSTED", price: 1000, currency: "USD" },
      { symbol: "UNCOSTED", price: 1000, currency: "USD" },
    ];

    const summary = await getInvestmentCostBasisSummary("u1", "USD");

    expect(summary.marketValue).toBeCloseTo(20000); // total stays total
    expect(summary.costedMarketValue).toBeCloseTo(10000); // only the costed holding
    expect(summary.costBasis).toBeCloseTo(8000);
    expect(summary.unrealizedGain).toBeCloseTo(2000); // NOT 12000
    expect(summary.unrealizedGainPct).toBeCloseTo(0.25);
    expect(summary.pricedHoldingCount).toBe(2);
    expect(summary.costedHoldingCount).toBe(1);
  });

  it("returns null gain when no holding has cost basis", async () => {
    h.accounts = [
      account({
        holdings: [
          holding({
            symbol: "UNCOSTED",
            quantity: 10,
            currency: "USD",
            assetType: "STOCK",
            transactions: [tx({ id: "b1", type: "BUY", quantity: 10 })],
          }),
        ],
      }),
    ];
    h.prices = [{ symbol: "UNCOSTED", price: 1000, currency: "USD" }];

    const summary = await getInvestmentCostBasisSummary("u1", "USD");

    expect(summary.unrealizedGain).toBeNull();
    expect(summary.unrealizedGainPct).toBeNull();
    expect(summary.costedMarketValue).toBe(0);
  });

  it("converts market value using the price-cache currency, not the stale holding currency", async () => {
    // Holding says USD, but the provider actually quotes BTC-EUR in EUR.
    h.accounts = [
      account({
        currency: "USD",
        holdings: [
          holding({
            symbol: "BTC-EUR",
            quantity: 1,
            currency: "USD",
            assetType: "STOCK",
            transactions: [tx({ id: "t1", type: "BUY", quantity: 1, unitPrice: 10000 })],
          }),
        ],
      }),
    ];
    h.prices = [{ symbol: "BTC-EUR", price: 20000, currency: "EUR" }];
    h.rates = new Map([
      ["EUR_USD", 2], // deliberately extreme so a wrong leg is obvious
      ["USD_USD", 1],
    ]);

    const summary = await getInvestmentCostBasisSummary("user1", "USD");

    // Market value must cross the EUR leg: 20000 * 2 = 40000 (not 20000).
    expect(summary.marketValue).toBeCloseTo(40000, 6);
    // Cost basis stays in the holding's stored currency (USD): 10000.
    expect(summary.costBasis).toBeCloseTo(10000, 6);
  });
});
