import { describe, it, expect, vi, beforeEach } from "vitest";

// price-service imports server-only modules and external clients.
// Stub them all so the unit suite needs no DB or network.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceCache: { findMany: vi.fn() },
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
const { refreshPricesForStockSymbols } = await import("@/lib/services/price-service");
const { PRICE_REFRESH_TTL_MS } = await import("@/lib/refresh-policy");

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
