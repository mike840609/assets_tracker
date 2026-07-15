import { describe, it, expect, vi, beforeEach } from "vitest";

// price-service imports server-only modules and external clients.
// Stub them all so the unit suite needs no DB or network.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceCache: { findMany: vi.fn() },
    holding: { findMany: vi.fn() },
    stockWatchItem: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  withTiming: <T>(_: string, fn: () => Promise<T>) => fn(),
}));
vi.mock("@/lib/services/yahoo-client");
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const { prisma } = await import("@/lib/prisma");
const { getYahooClient } = await import("@/lib/services/yahoo-client");
const { refreshPricesForStockSymbols, refreshAllPrices, normalizeMinorCurrencyQuote } =
  await import("@/lib/services/price-service");
const { PRICE_REFRESH_TTL_MS } = await import("@/lib/refresh-policy");

describe("normalizeMinorCurrencyQuote — minor-unit (pence/cents) normalization", () => {
  it("converts a London GBp (pence) quote to major GBP", () => {
    // Yahoo quotes .L symbols in pence tagged "GBp": 7000p = £70.00
    expect(normalizeMinorCurrencyQuote(7000, "GBp")).toEqual({ price: 70, currency: "GBP" });
  });

  it("converts a GBX quote identically to GBp", () => {
    expect(normalizeMinorCurrencyQuote(7000, "GBX")).toEqual({ price: 70, currency: "GBP" });
    // Lowercase X variant is unambiguous too
    expect(normalizeMinorCurrencyQuote(7000, "GBx")).toEqual({ price: 70, currency: "GBP" });
  });

  it("converts a Johannesburg ZAc (cents) quote to major ZAR", () => {
    // 1500c = R15.00
    expect(normalizeMinorCurrencyQuote(1500, "ZAc")).toEqual({ price: 15, currency: "ZAR" });
    expect(normalizeMinorCurrencyQuote(1500, "ZAX")).toEqual({ price: 15, currency: "ZAR" });
  });

  it("passes a major GBP quote through untouched (guards the GBp/GBP collision)", () => {
    // "GBP" (all-caps, major) must NOT be divided by 100
    expect(normalizeMinorCurrencyQuote(70, "GBP")).toEqual({ price: 70, currency: "GBP" });
  });

  it("passes a USD quote through unchanged", () => {
    expect(normalizeMinorCurrencyQuote(123.45, "USD")).toEqual({
      price: 123.45,
      currency: "USD",
    });
  });
});

describe("fetchYahooQuotes — persists normalized minor-unit quotes to PriceCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a London GBp quote of 7000 as 70 GBP in the upsert params", async () => {
    // AAPL-style existence/fresh gate: LSE.L exists and is stale so it is fetched
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);
    vi.mocked(prisma.priceCache.findMany)
      .mockResolvedValueOnce([{ symbol: "VOD.L", updatedAt: staleDate }] as never)
      // currentRows lookup before the upsert
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "VOD.L" }]);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "VOD.L", regularMarketPrice: 7000, currency: "GBp" }]),
    } as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const result = await refreshPricesForStockSymbols(["VOD.L"]);
    expect(result.updated).toBe(1);

    const upsertCall = vi
      .mocked(prisma.$executeRawUnsafe)
      .mock.calls.find(([sql]) => typeof sql === "string" && /INSERT INTO "PriceCache"/i.test(sql));
    expect(upsertCall).toBeDefined();
    // Params are [symbol, price(string), currency, ...] per row
    const params = upsertCall!.slice(1);
    expect(params).toContain("70"); // 7000 / 100, stringified
    expect(params).toContain("GBP"); // GBp normalized to major ISO code
    expect(params).not.toContain("GBp");
    expect(params).not.toContain("7000");
  });
});

describe("refreshAllPrices — cron-wide symbol collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes watch-only symbols and deduplicates held symbols", async () => {
    vi.mocked(prisma.holding.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", assetType: "STOCK" },
    ] as never);
    vi.mocked(prisma.stockWatchItem.findMany).mockResolvedValueOnce([
      { symbol: "TSLA" },
      { symbol: "AAPL" },
    ] as never);
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([] as never);
    const quote = vi.fn().mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: 100, currency: "USD" },
      { symbol: "TSLA", regularMarketPrice: 200, currency: "USD" },
    ]);
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(2 as never);

    expect((await refreshAllPrices()).updated).toBe(2);
    const fetched = quote.mock.calls.flatMap(([symbols]) => symbols as string[]);
    expect(fetched).toContain("TSLA");
    expect(fetched.filter((symbol) => symbol === "AAPL")).toHaveLength(1);
  });
});

describe("refreshPricesForStockSymbols — claim deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns retryAfterSeconds 30 when all existing stale symbols are claimed by another instance", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    // Existence+freshness check: AAPL exists in PriceCache but is stale
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ] as never);
    // Claim UPDATE: returns [] — another instance already holds the claim
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([]);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(result.retryAfterSeconds).toBe(30);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(getYahooClient).not.toHaveBeenCalled();
  });

  it("releases the claim when Yahoo returns no prices (fetch failure)", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    // Existence+freshness check: AAPL exists and is stale
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ] as never);
    // Claim UPDATE: AAPL claimed by this instance
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    // Yahoo always throws — fetchYahooQuotes will catch and return an empty Map
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi.fn().mockRejectedValue(new Error("network error")),
    } as never);
    // Cleanup UPDATE
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    // Cleanup must be called: SET "refreshingAt" = NULL for claimed symbols
    const cleanupCall = vi
      .mocked(prisma.$executeRawUnsafe)
      .mock.calls.find(
        ([sql]) => typeof sql === "string" && /refreshingAt/i.test(sql) && /NULL/i.test(sql),
      );
    expect(getYahooClient).toHaveBeenCalled();
    expect(cleanupCall).toBeDefined();
    expect(result.updated).toBe(0);
  });

  it("releases only the unfetched claim on a partial fetch (one ticker missing)", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    // Existence+freshness check: both stale and existing
    vi.mocked(prisma.priceCache.findMany)
      .mockResolvedValueOnce([
        { symbol: "AAPL", updatedAt: staleDate },
        { symbol: "MSFT", updatedAt: staleDate },
      ] as never)
      // currentRows lookup before the upsert (no prior values needed here)
      .mockResolvedValueOnce([] as never);
    // Claim UPDATE: both claimed by this instance
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      { symbol: "AAPL" },
      { symbol: "MSFT" },
    ]);
    // Yahoo returns a price for AAPL only — MSFT is the partial miss
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 100, currency: "USD" }]),
    } as never);
    // 1st $executeRawUnsafe = upsert, 2nd = releaseClaims for the unfetched
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);

    const result = await refreshPricesForStockSymbols(["AAPL", "MSFT"]);

    expect(result.updated).toBe(1);

    // The release call must target MSFT only, never AAPL (whose claim the
    // upsert already cleared).
    const releaseCall = vi
      .mocked(prisma.$executeRawUnsafe)
      .mock.calls.find(
        ([sql]) =>
          typeof sql === "string" &&
          /^\s*UPDATE\s+"PriceCache"/i.test(sql) &&
          /symbol IN/i.test(sql),
      );
    expect(releaseCall).toBeDefined();
    const releasedSymbols = releaseCall!.slice(1);
    expect(releasedSymbols).toContain("MSFT");
    expect(releasedSymbols).not.toContain("AAPL");
  });
});
