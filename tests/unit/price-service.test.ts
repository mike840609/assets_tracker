import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// price-service imports server-only modules and external clients.
// Stub them all so the unit suite needs no DB or network.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceCache: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    holding: { findMany: vi.fn() },
    stockWatchItem: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));
vi.mock("@/lib/logger", () => {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    log,
    withTiming: async <T>(label: string, fn: () => Promise<T>, meta?: Record<string, unknown>) => {
      try {
        return await fn();
      } catch (error) {
        log.error(label, { ...meta, error: String(error) });
        throw error;
      }
    },
  };
});
// Partial mock: only the client factory is stubbed. `getYahooErrorStatus` must
// stay real because price-service reads the upstream HTTP status through it to
// classify 429s, and a blanket auto-mock would make every status `undefined`.
vi.mock("@/lib/services/yahoo-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/yahoo-client")>()),
  getYahooClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const { prisma } = await import("@/lib/prisma");
const { getYahooClient } = await import("@/lib/services/yahoo-client");
const {
  fetchStockPrices,
  fetchCryptoPrices,
  refreshPricesForStockSymbols,
  refreshAllPrices,
  normalizeMinorCurrencyQuote,
} = await import("@/lib/services/price-service");
const {
  fetchEquityQuote,
  invalidateStockWatchCaches,
  refreshTrackedStockPrices,
  tryWarmStockPrice,
} = await import("@/lib/services/stock-watch-service");
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

describe("stock-watch cache invalidation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates only the owned stock tag for Demo and never churns prices", async () => {
    const { revalidateTag } = await import("next/cache");
    invalidateStockWatchCaches("demo-user", {
      kind: "demo",
      userId: "demo-user",
      expiresAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    expect(revalidateTag).toHaveBeenCalledOnce();
    expect(revalidateTag).toHaveBeenCalledWith("stocks:demo-user", { expire: 0 });
  });

  it("preserves broad and owned stock invalidation for formal users without churning prices", async () => {
    const { revalidateTag } = await import("next/cache");
    invalidateStockWatchCaches("formal-user", { kind: "formal", userId: "formal-user" });

    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      ["stocks", { expire: 0 }],
      ["stocks:formal-user", { expire: 0 }],
    ]);
  });

  it("does not revalidate stock caches after a price-only tracked-stock refresh", async () => {
    const { revalidateTag } = await import("next/cache");
    vi.mocked(prisma.stockWatchItem.findMany).mockResolvedValue([{ symbol: "AAPL" }] as never);
    vi.mocked(prisma.priceCache.findMany).mockResolvedValue([
      { symbol: "AAPL", updatedAt: new Date() },
    ] as never);

    const result = await refreshTrackedStockPrices("formal-user");

    expect(result.outcome).toBe("no_due_symbols");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("Demo market log redaction", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("redacts Yahoo batch and fallback identifiers and raw provider errors", async () => {
    const { log } = await import("@/lib/logger");
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi.fn().mockRejectedValue(new Error("private provider SENTINEL_RAW")),
    } as never);

    await fetchStockPrices(["SENTINEL_A", "SENTINEL_B"], [], { redactIdentifiers: true });

    const logged = JSON.stringify(vi.mocked(log.error).mock.calls);
    expect(logged).not.toContain("SENTINEL_A");
    expect(logged).not.toContain("SENTINEL_B");
    expect(logged).not.toContain("SENTINEL_RAW");
  });

  it("redacts CoinGecko transport errors", async () => {
    const { log } = await import("@/lib/logger");
    vi.mocked(getYahooClient).mockResolvedValue({ quote: vi.fn().mockResolvedValue([]) } as never);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("private transport SENTINEL_RAW"));

    await fetchCryptoPrices(["SENTINEL-USD"], [], { redactIdentifiers: true });

    const logged = JSON.stringify(vi.mocked(log.error).mock.calls);
    expect(logged).not.toContain("SENTINEL");
    expect(logged).not.toContain("SENTINEL_RAW");
  });

  it("rethrows quote failures without provider causes and redacts warm failures", async () => {
    const { log } = await import("@/lib/logger");
    vi.mocked(prisma.priceCache.findUnique).mockResolvedValue(null);
    vi.mocked(getYahooClient).mockRejectedValue(
      new Error("private quote SENTINEL_SYMBOL SENTINEL_RAW"),
    );

    await expect(fetchEquityQuote("SENTINEL_SYMBOL", { redactIdentifiers: true })).rejects.toThrow(
      "Market quote lookup failed",
    );
    await expect(
      tryWarmStockPrice("SENTINEL_SYMBOL", { redactIdentifiers: true }),
    ).resolves.toBeNull();

    const logged = JSON.stringify(vi.mocked(log.warn).mock.calls);
    expect(logged).not.toContain("SENTINEL_SYMBOL");
    expect(logged).not.toContain("SENTINEL_RAW");
  });

  it("redacts claim-cleanup failures", async () => {
    const { log } = await import("@/lib/logger");
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ] as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    vi.mocked(getYahooClient).mockRejectedValueOnce(new Error("provider unavailable"));
    vi.mocked(prisma.$executeRawUnsafe).mockRejectedValueOnce(
      new Error("private database SENTINEL_DB"),
    );

    await refreshPricesForStockSymbols(["AAPL"], { redactIdentifiers: true });

    const logged = JSON.stringify(vi.mocked(log.error).mock.calls);
    expect(logged).not.toContain("SENTINEL_DB");
    expect(logged).not.toContain("private database");
  });

  it("redacts cache-revalidation failures", async () => {
    const { log } = await import("@/lib/logger");
    const { revalidateTag } = await import("next/cache");
    vi.mocked(prisma.priceCache.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 100, currency: "USD" }]),
    } as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1 as never);
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error("private cache SENTINEL_CACHE");
    });

    await refreshPricesForStockSymbols(["AAPL"], { redactIdentifiers: true });

    const logged = JSON.stringify(vi.mocked(log.error).mock.calls);
    expect(logged).not.toContain("SENTINEL_CACHE");
    expect(logged).not.toContain("private cache");
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

  it("discovers symbols only through formal-user relations", async () => {
    vi.mocked(prisma.holding.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.stockWatchItem.findMany).mockResolvedValueOnce([] as never);

    await refreshAllPrices();

    expect(prisma.holding.findMany).toHaveBeenCalledWith({
      where: { account: { user: { demoWorkspace: null } } },
      select: { symbol: true, assetType: true },
      distinct: ["symbol"],
    });
    expect(prisma.stockWatchItem.findMany).toHaveBeenCalledWith({
      where: { user: { demoWorkspace: null } },
      select: { symbol: true },
      distinct: ["symbol"],
    });
  });

  it("treats unpriceable holdings as no due symbols", async () => {
    vi.mocked(prisma.holding.findMany).mockResolvedValueOnce([
      { symbol: "PRIVATE-LOAN", assetType: "OTHER" },
    ] as never);
    vi.mocked(prisma.stockWatchItem.findMany).mockResolvedValueOnce([] as never);

    const result = await refreshAllPrices();

    expect(result.outcome).toBe("no_due_symbols");
    expect(result.updated).toBe(0);
    expect(getYahooClient).not.toHaveBeenCalled();
  });

  it("reports success when supported due symbols refresh alongside unsupported or duplicate holdings", async () => {
    vi.mocked(prisma.holding.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", assetType: "STOCK" },
      { symbol: "AAPL", assetType: "STOCK" },
      { symbol: "PRIVATE-LOAN", assetType: "OTHER" },
    ] as never);
    vi.mocked(prisma.stockWatchItem.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 100, currency: "USD" }]),
    } as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1 as never);

    const result = await refreshAllPrices();

    expect(result.updated).toBe(1);
    expect(result.outcome).toBe("success");
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

  it("reports no_due_symbols when every requested symbol is still fresh", async () => {
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: new Date() },
    ] as never);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(result.outcome).toBe("no_due_symbols");
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([]);
    expect(getYahooClient).not.toHaveBeenCalled();
  });

  it("reports no_due_symbols when there are no requested symbols", async () => {
    const result = await refreshPricesForStockSymbols([]);

    expect(result.outcome).toBe("no_due_symbols");
    expect(result.updated).toBe(0);
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
    expect(result.outcome).toBe("total_failure");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Yahoo Finance batch failed")]),
    );
  });

  it("releases the claim when the Yahoo client fails to initialize", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ] as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    vi.mocked(getYahooClient).mockRejectedValueOnce(new Error("client initialization failed"));
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    const cleanupCall = vi
      .mocked(prisma.$executeRawUnsafe)
      .mock.calls.find(
        ([sql]) => typeof sql === "string" && /refreshingAt/i.test(sql) && /NULL/i.test(sql),
      );
    expect(cleanupCall).toBeDefined();
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([expect.stringContaining("client initialization failed")]);
  });

  it("returns total_failure when the bulk price upsert fails", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);
    vi.mocked(prisma.priceCache.findMany)
      .mockResolvedValueOnce([{ symbol: "AAPL", updatedAt: staleDate }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 100, currency: "USD" }]),
    } as never);
    vi.mocked(prisma.$executeRawUnsafe)
      .mockRejectedValueOnce(new Error("database write unavailable"))
      .mockResolvedValueOnce(1 as never);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(result.outcome).toBe("total_failure");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Bulk upsert failed")]),
    );
  });

  it("keeps a persisted refresh successful when cache revalidation throws", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);
    vi.mocked(prisma.priceCache.findMany)
      .mockResolvedValueOnce([{ symbol: "AAPL", updatedAt: staleDate }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi
        .fn()
        .mockResolvedValue([{ symbol: "AAPL", regularMarketPrice: 100, currency: "USD" }]),
    } as never);
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1 as never);
    const { revalidateTag } = await import("next/cache");
    const { log } = await import("@/lib/logger");
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(result).toMatchObject({ outcome: "success", updated: 1, changed: 1 });
    expect(log.error).toHaveBeenCalledWith(
      "price.refresh.revalidate_failed",
      expect.objectContaining({ error: expect.stringContaining("cache unavailable") }),
    );
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
    expect(result.outcome).toBe("partial_success");

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

// --- Batching / fan-out control (issue #642) -------------------------------
// Numbers below mirror the constants in price-service.ts: chunk size 50, 3
// chunks in flight, 4 per-symbol fallback requests in flight.

/** No PriceCache rows => every symbol is "stale new", so the claim UPDATE is
 *  skipped and the whole list goes to the fetcher. */
function stubAllSymbolsFetchable() {
  vi.mocked(prisma.priceCache.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(1 as never);
}

const quoteFor = (symbol: string) => ({ symbol, regularMarketPrice: 100, currency: "USD" });

describe("fetchYahooQuotes — request chunking and bounded concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits a multi-chunk symbol list into several quote calls, none over the chunk size", async () => {
    stubAllSymbolsFetchable();
    const symbols = Array.from({ length: 120 }, (_, i) => `SYM${i}`);
    const quote = vi.fn(async (syms: string[]) => syms.map(quoteFor));
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(symbols);

    expect(result.updated).toBe(120);
    // 120 symbols at a chunk size of 50 => 50 + 50 + 20
    expect(quote).toHaveBeenCalledTimes(3);
    for (const [syms] of quote.mock.calls) {
      expect(syms.length).toBeLessThanOrEqual(50);
    }
    // Every symbol is still requested, exactly once, across the chunks
    expect(quote.mock.calls.flatMap(([syms]) => syms).sort()).toEqual([...symbols].sort());
  });

  it("holds chunk requests at the concurrency cap without serialising them", async () => {
    stubAllSymbolsFetchable();
    const symbols = Array.from({ length: 250 }, (_, i) => `SYM${i}`); // 5 chunks
    let inFlight = 0;
    let peak = 0;
    const quote = vi.fn(async (syms: string[]) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return syms.map(quoteFor);
    });
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    expect((await refreshPricesForStockSymbols(symbols)).updated).toBe(250);
    expect(quote).toHaveBeenCalledTimes(5);
    expect(peak).toBeLessThanOrEqual(3); // never exceeds the cap
    expect(peak).toBeGreaterThanOrEqual(3); // ...and reaches it, so the pool really overlaps
  });

  it("falls back per-symbol only for the chunk that failed, within the fallback cap", async () => {
    stubAllSymbolsFetchable();
    const symbols = Array.from({ length: 120 }, (_, i) => `SYM${i}`);
    const failingChunk = symbols.slice(50, 100); // the middle chunk
    const poison = "SYM60";
    let inFlight = 0;
    let peak = 0;
    const quote = vi.fn(async (syms: string[]) => {
      if (syms.length > 1) {
        if (syms.includes(poison)) throw new Error("Quote not found for symbol");
        return syms.map(quoteFor);
      }
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      if (syms[0] === poison) throw new Error("Quote not found for symbol");
      return syms.map(quoteFor);
    });
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(symbols);

    const perSymbol = quote.mock.calls
      .filter(([syms]) => syms.length === 1)
      .map(([syms]) => syms[0]);
    // The other 70 symbols are never dragged into the per-symbol path
    expect(perSymbol.sort()).toEqual([...failingChunk].sort());
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThanOrEqual(4);
    // 50 + 20 from the healthy chunks, plus 49 of 50 recovered from the failed one
    expect(result.updated).toBe(119);
  });

  it("keeps prices from the chunks that succeeded when another chunk fails outright", async () => {
    stubAllSymbolsFetchable();
    const symbols = Array.from({ length: 120 }, (_, i) => `SYM${i}`);
    const failingChunk = new Set(symbols.slice(50, 100));
    // Every call touching the middle chunk fails, batch or per-symbol
    const quote = vi.fn(async (syms: string[]) => {
      if (syms.some((s) => failingChunk.has(s))) throw new Error("upstream unavailable");
      return syms.map(quoteFor);
    });
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(symbols);

    // 50 from the first chunk + 20 from the last survive the middle chunk's loss
    expect(result.updated).toBe(70);
    const perSymbol = quote.mock.calls
      .filter(([syms]) => syms.length === 1)
      .map(([syms]) => syms[0]);
    expect(perSymbol).toHaveLength(50);
    expect(perSymbol.every((s) => failingChunk.has(s))).toBe(true);
  });
});

describe("fetchYahooQuotes — a rate limit is not amplified by the retry ladder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Long timeouts so that on the pre-fix code these fail on the call-count
  // assertion rather than on the ~4 s of retry backoff they would sit through.
  it("does not retry a 429 reported through the error's numeric code", async () => {
    stubAllSymbolsFetchable();
    // yahoo-finance2's HTTPError shape. The message deliberately carries no 429
    // text, only tokens the retryable-error test matches ("fetch failed", 503),
    // so the rate limit is recognised solely from `code`.
    const rateLimited = Object.assign(new Error("edge fetch failed (backend 503)"), { code: 429 });
    const quote = vi.fn().mockRejectedValue(rateLimited);
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    // Exactly one attempt: no retry ladder, and no per-symbol fallback for a
    // chunk that is already a single symbol.
    expect(quote).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(0);
  }, 20_000);

  it("does not retry a 429 reported only in the message text", async () => {
    stubAllSymbolsFetchable();
    // No numeric code — just the wire text, whose Retry-After hint contains a
    // 5xx-looking token that the bare /\b5\d\d\b/ test would treat as retryable.
    const quote = vi
      .fn()
      .mockRejectedValue(new Error("Request failed: 429 Too Many Requests (retry after 500 s)"));
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(0);
  }, 20_000);

  it("does not fan a rate-limited batch out into per-symbol requests", async () => {
    stubAllSymbolsFetchable();
    const symbols = Array.from({ length: 50 }, (_, i) => `SYM${i}`);
    const quote = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("edge fetch failed"), { code: 429 }));
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(symbols);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(0);
  });

  it("does not start a retry after its backoff crosses the wall-clock budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    stubAllSymbolsFetchable();
    const quote = vi
      .fn()
      .mockImplementationOnce(() => {
        vi.setSystemTime(new Date(Date.now() + 14_800));
        return Promise.reject(new Error("Yahoo returned HTTP 503"));
      })
      .mockResolvedValueOnce([quoteFor("AAPL")]);
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const pending = refreshPricesForStockSymbols(["AAPL"]);
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(quote).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(0);
  });

  it("still retries a genuine 5xx", async () => {
    stubAllSymbolsFetchable();
    const quote = vi
      .fn()
      .mockRejectedValueOnce(new Error("Yahoo returned HTTP 503"))
      .mockResolvedValueOnce([quoteFor("AAPL")]);
    vi.mocked(getYahooClient).mockResolvedValue({ quote } as never);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    // The 429 short-circuit must not have disarmed the ladder for real outages
    expect(quote).toHaveBeenCalledTimes(2);
    expect(result.updated).toBe(1);
  }, 20_000);
});

function currencyCode(index: number): string {
  return [2, 1, 0]
    .map((power) => String.fromCharCode(65 + (Math.floor(index / 26 ** power) % 26)))
    .join("");
}

function coinGeckoPayload(url: URL, price = 100): Record<string, Record<string, number>> {
  const ids = url.searchParams.get("ids")?.split(",") ?? [];
  const currencies = url.searchParams.get("vs_currencies")?.split(",") ?? [];
  return Object.fromEntries(
    ids.map((id) => [id, Object.fromEntries(currencies.map((currency) => [currency, price]))]),
  );
}

describe("fetchCryptoPrices — bounded CoinGecko requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bounds both ids and quote currencies while keeping at most two requests in flight", async () => {
    const symbols = Array.from({ length: 55 }, (_, i) => `COIN${i}-${currencyCode(i)}`);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi.fn().mockResolvedValue([]),
    } as never);

    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight--;
      const url = new URL(String(input));
      return {
        ok: true,
        status: 200,
        json: async () => coinGeckoPayload(url),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCryptoPrices(symbols);

    expect(result.size).toBe(55);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThanOrEqual(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.searchParams.get("ids")?.split(",").length).toBeLessThanOrEqual(50);
      expect(url.searchParams.get("vs_currencies")?.split(",").length).toBeLessThanOrEqual(50);
    }
  });

  it("keeps healthy CoinGecko chunks when one chunk is rate-limited without retrying it", async () => {
    const symbols = Array.from({ length: 120 }, (_, i) => `COIN${i}-USD`);
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi.fn().mockResolvedValue([]),
    } as never);

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get("ids")?.split(",") ?? [];
      if (ids.includes("coin50")) {
        return { ok: false, status: 429, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => coinGeckoPayload(url),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCryptoPrices(symbols);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.size).toBe(70);
    expect(result.has("COIN0-USD")).toBe(true);
    expect(result.has("COIN50-USD")).toBe(false);
    expect(result.has("COIN119-USD")).toBe(true);
  });
});
