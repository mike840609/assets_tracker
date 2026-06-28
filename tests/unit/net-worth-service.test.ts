import { describe, it, expect, vi } from "vitest";

// Net-worth computation is exercised through its public cached entry point.
// We neutralize the caching wrappers (React cache(), Next "use cache" tags)
// and feed deterministic accounts / prices / rates through mocked Prisma and
// exchange-rate reads. resolveRate stays real so the missing-rate fallback is
// genuinely tested.

const created = new Date("2026-01-01T00:00:00.000Z");

interface HoldingFixture {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  quantity: number;
  currency: string;
  assetType: string;
  underlyingSymbol: null;
  optionType: null;
  strike: null;
  expiration: null;
  contractMultiplier: number | null;
  createdAt: Date;
  updatedAt: Date;
}
interface AccountFixture {
  id: string;
  userId: string;
  name: string;
  type: "ASSET" | "LIABILITY";
  category: string;
  currency: string;
  cashBalance: number;
  isActive: boolean;
  isPinned: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  holdings: HoldingFixture[];
}

function holding(
  over: Partial<HoldingFixture> & Pick<HoldingFixture, "id" | "symbol">,
): HoldingFixture {
  return {
    accountId: "acc",
    name: over.symbol,
    quantity: 1,
    currency: "USD",
    assetType: "STOCK",
    underlyingSymbol: null,
    optionType: null,
    strike: null,
    expiration: null,
    contractMultiplier: null,
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}
function account(
  over: Partial<AccountFixture> & Pick<AccountFixture, "id" | "currency" | "type">,
): AccountFixture {
  return {
    userId: "u1",
    name: over.id,
    category: "INVESTMENT",
    cashBalance: 0,
    isActive: true,
    isPinned: false,
    sortOrder: 0,
    createdAt: created,
    updatedAt: created,
    holdings: [],
    ...over,
  };
}

const h = vi.hoisted(() => ({
  accounts: [] as unknown[],
  prices: [] as { symbol: string; price: number; currency: string }[],
  rates: new Map<string, number>(),
  warnings: [] as { msg: string; meta: unknown }[],
  tags: [] as string[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T): T => fn };
});
vi.mock("next/cache", () => ({
  cacheTag: (tag: string) => h.tags.push(tag),
  cacheLife: () => {},
}));
vi.mock("@/lib/logger", () => ({
  log: {
    info: () => {},
    warn: (msg: string, meta: unknown) => h.warnings.push({ msg, meta }),
    error: () => {},
    debug: () => {},
  },
  withTiming: <T>(_name: string, fn: () => T) => fn(),
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

const { getCachedNetWorthSummary } = await import("@/lib/services/net-worth-service");

describe("getCachedNetWorthSummary (two-pass valuation)", () => {
  it("prices holdings, converts currencies, and splits assets vs. liabilities", async () => {
    h.warnings = [];
    h.rates = new Map([["USD_TWD", 30]]); // TWD→USD = 1/30
    h.prices = [{ symbol: "AAPL", price: 200, currency: "USD" }];
    h.accounts = [
      account({
        id: "A",
        type: "ASSET",
        currency: "USD",
        cashBalance: 1000,
        holdings: [holding({ id: "h1", symbol: "AAPL", quantity: 10, currency: "USD" })],
      }),
      account({ id: "B", type: "ASSET", currency: "TWD", cashBalance: 3000 }),
      account({ id: "C", type: "LIABILITY", currency: "USD", cashBalance: 500 }),
    ];

    const summary = await getCachedNetWorthSummary("u1", "USD");

    // A: 1000 cash + (200 * 10) holding = 3000; B: 3000 TWD / 30 = 100.
    expect(summary.totalAssets).toBeCloseTo(3100);
    expect(summary.totalLiabilities).toBeCloseTo(500);
    expect(summary.netWorth).toBeCloseTo(2600);
    expect(summary.baseCurrency).toBe("USD");

    // Currency exposure (assets only), sorted by base-currency value desc.
    expect(summary.currencyExposure).toEqual([
      { currency: "USD", value: 3000 },
      { currency: "TWD", value: 100 },
    ]);
  });

  it("tags the cached read with exchange-rates so a warmed FX rate invalidates it", async () => {
    h.tags = [];
    h.rates = new Map([["USD_TWD", 30]]);
    h.prices = [];
    h.accounts = [account({ id: "A", type: "ASSET", currency: "USD", cashBalance: 100 })];

    await getCachedNetWorthSummary("u1", "USD");

    expect(h.tags).toContain("exchange-rates");
  });

  it("falls back to rate 1 and warns for an unresolvable currency", async () => {
    h.warnings = [];
    h.rates = new Map([["USD_TWD", 30]]); // no EUR path
    h.prices = [];
    h.accounts = [account({ id: "D", type: "ASSET", currency: "EUR", cashBalance: 50 })];

    const summary = await getCachedNetWorthSummary("u1", "USD");

    // EUR is unresolvable → rate 1 → value passes through unchanged.
    expect(summary.totalAssets).toBeCloseTo(50);
    expect(summary.currencyExposure).toEqual([{ currency: "EUR", value: 50 }]);
    expect(h.warnings.some((w) => w.msg === "rates.unresolved")).toBe(true);
  });

  it("leaves holdings unpriced (null market value) when no cached price exists", async () => {
    h.warnings = [];
    h.rates = new Map();
    h.prices = []; // no AAPL price cached
    h.accounts = [
      account({
        id: "A",
        type: "ASSET",
        currency: "USD",
        cashBalance: 100,
        holdings: [holding({ id: "h1", symbol: "AAPL", quantity: 10, currency: "USD" })],
      }),
    ];

    const summary = await getCachedNetWorthSummary("u1", "USD");

    // Only cash counts; the unpriced holding contributes nothing.
    expect(summary.totalAssets).toBeCloseTo(100);
    expect(summary.accounts[0].holdings[0].marketValue).toBeNull();
  });

  it("applies the option contract multiplier to market value", async () => {
    h.warnings = [];
    h.rates = new Map();
    h.prices = [{ symbol: "AAPL240119C00150000", price: 5, currency: "USD" }];
    h.accounts = [
      account({
        id: "A",
        type: "ASSET",
        currency: "USD",
        cashBalance: 0,
        holdings: [
          holding({
            id: "opt",
            symbol: "AAPL240119C00150000",
            quantity: 2,
            currency: "USD",
            assetType: "OPTION",
            contractMultiplier: 100,
          }),
        ],
      }),
    ];

    const summary = await getCachedNetWorthSummary("u1", "USD");

    // 5 * 2 contracts * 100 multiplier = 1000.
    expect(summary.totalAssets).toBeCloseTo(1000);
  });
});
