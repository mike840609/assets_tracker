import { describe, it, expect, vi, beforeEach } from "vitest";

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
  /** Rows behind the direct `prisma.exchangeRate` read the fresh path uses. */
  freshRates: new Map<string, number>(),
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
    exchangeRate: {
      findMany: vi.fn(async () =>
        [...h.freshRates].map(([key, rate]) => {
          const [fromCurrency, toCurrency] = key.split("_");
          return { fromCurrency, toCurrency, rate };
        }),
      ),
    },
  },
}));
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getAllExchangeRates: vi.fn(async () => h.rates) };
});

const { getCachedNetWorthSummary, computeNetWorthSummary, loadNetWorthInputsForUsers } =
  await import("@/lib/services/net-worth-service");

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

  it("tags the cached read with prices so a stock-only price refresh invalidates it", async () => {
    h.tags = [];
    h.rates = new Map([["USD_TWD", 30]]);
    h.prices = [{ symbol: "AAPL", price: 200, currency: "USD" }];
    h.accounts = [
      account({
        id: "A",
        type: "ASSET",
        currency: "USD",
        holdings: [holding({ id: "h1", symbol: "AAPL", quantity: 1, currency: "USD" })],
      }),
    ];

    await getCachedNetWorthSummary("u1", "USD");

    expect(h.tags).toContain("prices");
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

  it("resolves an unresolvable pair once per call, not once per holding", async () => {
    // A miss is the most expensive lookup: resolveRate walks direct, inverse
    // and the USD cross before giving up. Memoizing only hits would make every
    // holding in an unpriced currency repeat that whole walk.
    async function run(holdingCount: number) {
      h.warnings = [];
      h.rates = new Map([["USD_TWD", 30]]); // no XXX path
      const reads = vi.spyOn(h.rates, "get");
      const symbols = Array.from({ length: holdingCount }, (_, i) => `XXX${i}`);
      h.prices = symbols.map((symbol) => ({ symbol, price: 10, currency: "XXX" }));
      h.accounts = [
        account({
          id: "A",
          type: "ASSET",
          currency: "USD",
          holdings: symbols.map((symbol, i) =>
            holding({ id: `h${i}`, symbol, quantity: 1, currency: "XXX" }),
          ),
        }),
      ];

      await getCachedNetWorthSummary("u1", "USD");

      return {
        reads: reads.mock.calls.length,
        unresolved: h.warnings.filter((w) => w.msg === "rates.unresolved").length,
      };
    }

    const one = await run(1);
    const many = await run(5);

    // Five holdings cost the same rate lookups as one: XXX→USD resolves once.
    expect(one.reads).toBeGreaterThan(0);
    expect(many.reads).toBe(one.reads);
    expect(many.unresolved).toBe(1);
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

  it("values a crypto holding using the PriceCache's own currency, not the holding's mismatched stored currency (#550)", async () => {
    h.warnings = [];
    // BTC-EUR: the holding was created with currency USD (e.g. inferCurrency's
    // no-crypto-mapping default), but the cached price is genuinely EUR-quoted.
    // EURUSD = 1.1, i.e. 1 EUR = 1.1 USD -> USD_EUR resolves to 1/1.1.
    h.rates = new Map([["EUR_USD", 1.1]]);
    h.prices = [{ symbol: "BTC-EUR", price: 50000, currency: "EUR" }];
    h.accounts = [
      account({
        id: "A",
        type: "ASSET",
        currency: "USD",
        cashBalance: 0,
        holdings: [
          holding({
            id: "h1",
            symbol: "BTC-EUR",
            quantity: 1,
            currency: "USD", // mismatched: stored as USD, priced in EUR
            assetType: "CRYPTO",
          }),
        ],
      }),
    ];

    const summary = await getCachedNetWorthSummary("u1", "USD");

    // Correct: 50000 EUR * 1.1 (EUR->USD) = 55000 USD.
    // Buggy (trusting h.currency=USD, no conversion): would be 50000.
    expect(summary.totalAssets).toBeCloseTo(55000);
    expect(summary.accounts[0].holdings[0].marketValueInBaseCurrency).toBeCloseTo(55000);
    expect(summary.currencyExposure).toHaveLength(1);
    expect(summary.currencyExposure[0].currency).toBe("EUR");
    expect(summary.currencyExposure[0].value).toBeCloseTo(55000);
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

// Regression #640: the snapshot cron writes prices/FX and materializes recurring
// rows, then revalidates with `"max"` — stale-while-revalidate, so the cached
// account + FX readers hand back pre-refresh values. The `fresh` path must go
// straight to the DB for both.
describe("computeNetWorthSummary({ fresh: true })", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.warnings = [];
    h.tags = [];
    h.prices = [];
  });

  it("takes FX from the direct DB read, not the cached rate map", async () => {
    const { getAllExchangeRates } = await import("@/lib/services/exchange-rate-service");
    h.rates = new Map([["USD_TWD", 1]]); // stale: pre-refresh 1:1
    h.freshRates = new Map([["USD_TWD", 30]]); // post-refresh
    h.accounts = [account({ id: "B", type: "ASSET", currency: "TWD", cashBalance: 3000 })];

    const summary = await computeNetWorthSummary("u1", "USD", { fresh: true });

    // 3000 TWD / 30 = 100. The stale 1:1 map would have valued it at 3000.
    expect(summary.totalAssets).toBeCloseTo(100);
    expect(vi.mocked(getAllExchangeRates)).not.toHaveBeenCalled();
  });

  it("enters no cached reader at all, so no cache tag is registered", async () => {
    h.rates = new Map();
    h.freshRates = new Map();
    h.accounts = [account({ id: "A", type: "ASSET", currency: "USD", cashBalance: 100 })];

    const summary = await computeNetWorthSummary("u1", "USD", { fresh: true });

    expect(summary.totalAssets).toBeCloseTo(100);
    // The cached account reader calls cacheTag("accounts"); the fresh query does
    // not. An empty list proves neither `"use cache"` body ran.
    expect(h.tags).toEqual([]);
  });

  it("still uses the cached readers when fresh is not requested", async () => {
    const { getAllExchangeRates } = await import("@/lib/services/exchange-rate-service");
    h.rates = new Map([["USD_TWD", 1]]);
    h.freshRates = new Map([["USD_TWD", 30]]);
    h.accounts = [account({ id: "B", type: "ASSET", currency: "TWD", cashBalance: 3000 })];

    const summary = await computeNetWorthSummary("u1", "USD");

    expect(summary.totalAssets).toBeCloseTo(3000); // stale 1:1 map
    expect(vi.mocked(getAllExchangeRates)).toHaveBeenCalled();
    expect(h.tags).toContain("accounts");
  });
});

// Regression #641: the cron used to call computeNetWorthSummary once per user,
// so its DB round-trips grew linearly with the instance and ran unbounded in
// flight. Inputs are now bulk-loaded and injected. The refactor is only allowed
// to change WHERE the data comes from — never the arithmetic.
describe("loadNetWorthInputsForUsers (bulk path)", () => {
  const fixture = () => {
    h.rates = new Map();
    h.freshRates = new Map([["USD_TWD", 30]]);
    h.prices = [
      { symbol: "AAPL", price: 200, currency: "USD" },
      { symbol: "2330.TW", price: 900, currency: "TWD" },
    ];
    h.accounts = [
      account({
        id: "brokerage",
        type: "ASSET",
        currency: "USD",
        cashBalance: 500,
        holdings: [
          holding({ id: "h1", accountId: "brokerage", symbol: "AAPL", quantity: 3 }),
          holding({
            id: "h2",
            accountId: "brokerage",
            symbol: "2330.TW",
            quantity: 10,
            currency: "TWD",
          }),
        ],
      }),
      account({ id: "loan", type: "LIABILITY", currency: "TWD", cashBalance: 6000 }),
    ];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    h.warnings = [];
    h.tags = [];
  });

  it("produces byte-identical summaries to the per-user fresh path", async () => {
    fixture();
    const perUser = await computeNetWorthSummary("u1", "USD", { fresh: true });

    fixture();
    const { getFreshExchangeRates } = await import("@/lib/services/exchange-rate-service");
    const inputs = await loadNetWorthInputsForUsers(["u1"], await getFreshExchangeRates());
    const bulk = await computeNetWorthSummary("u1", "USD", {
      fresh: true,
      preloaded: inputs.get("u1"),
    });

    expect(bulk).toEqual(perUser);
    // Sanity: the fixture actually exercises FX + prices, so "identical" means
    // something. 500 cash + 3*200 AAPL + 10*900 TWD/30 = 1400.
    expect(bulk.totalAssets).toBeCloseTo(1400);
    expect(bulk.totalLiabilities).toBeCloseTo(200);
  });

  it("costs a fixed number of queries regardless of user count", async () => {
    fixture();
    const { prisma } = await import("@/lib/prisma");
    const { getFreshExchangeRates } = await import("@/lib/services/exchange-rate-service");
    const userIds = Array.from({ length: 50 }, (_, i) => `u${i}`);

    const ratesMap = await getFreshExchangeRates();
    vi.clearAllMocks();
    await loadNetWorthInputsForUsers(userIds, ratesMap);

    // One accounts query + one price query for all 50 users. The per-user path
    // would have issued 50 of each, plus 50 ExchangeRate scans.
    expect(vi.mocked(prisma.account.findMany)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.priceCache.findMany)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.exchangeRate.findMany)).not.toHaveBeenCalled();
  });

  it("gives users with no active accounts an entry, so they still get snapshotted", async () => {
    h.accounts = [];
    h.prices = [];
    h.freshRates = new Map();

    const inputs = await loadNetWorthInputsForUsers(["ghost"], new Map());

    expect(inputs.get("ghost")).toEqual({ accounts: [], ratesMap: new Map(), priceMap: {} });
    const summary = await computeNetWorthSummary("ghost", "USD", {
      fresh: true,
      preloaded: inputs.get("ghost"),
    });
    expect(summary.netWorth).toBe(0);
  });

  it("skips the price query entirely when no user holds anything", async () => {
    h.accounts = [account({ id: "cash", type: "ASSET", currency: "USD", cashBalance: 10 })];
    const { prisma } = await import("@/lib/prisma");
    vi.clearAllMocks();

    await loadNetWorthInputsForUsers(["u1"], new Map());

    expect(vi.mocked(prisma.priceCache.findMany)).not.toHaveBeenCalled();
  });
});
