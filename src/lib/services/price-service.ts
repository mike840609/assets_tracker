import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getYahooClient } from "@/lib/services/yahoo-client";
import { PRICE_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log, withTiming } from "@/lib/logger";

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s

export type RefreshPricesResult = {
  updated: number;
  /**
   * Symbols whose persisted price actually differs from the previously cached
   * value (or had no cached row). Compared exactly after normalizing both
   * sides to the Decimal(18,8) column precision — no epsilon. Lets callers
   * (the cron) gate global cache revalidations on real change.
   */
  changed: number;
  /** Symbols skipped because their cached price was younger than the TTL. */
  skippedFresh: number;
  errors: string[];
  /** When the earliest skipped symbol becomes stale; null unless everything was skipped. */
  nextRefreshAt: string | null;
  retryAfterSeconds: number | null;
};

export type RefreshPricesOptions = {
  /** Bypass the freshness gate (cron path — snapshots need current prices). */
  force?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize to the Decimal(18,8) column precision so a freshly fetched float
 * and a value read back from the DB round-trip to the same number.
 */
function normalizeTo8dp(value: number): number {
  return Number(value.toFixed(8));
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("timed out") ||
    /\b5\d\d\b/.test(err.message)
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length && isRetryable(err)) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      } else {
        break;
      }
    }
  }
  throw lastError;
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ALGO: "algorand",
  FIL: "filecoin",
  NEAR: "near",
  APT: "aptos",
};

async function fetchYahooQuotes(
  symbols: string[],
): Promise<Map<string, { price: number; currency: string }>> {
  const results = new Map<string, { price: number; currency: string }>();
  if (symbols.length === 0) return results;

  const yahooFinance = await getYahooClient();

  const fetchSymbols = async (syms: string[]) => {
    const quotes = await withRetry(() =>
      Promise.race([
        yahooFinance.quote(syms),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Yahoo Finance request timed out")), FETCH_TIMEOUT_MS),
        ),
      ]),
    );
    for (const q of Array.isArray(quotes) ? quotes : [quotes]) {
      if (q?.regularMarketPrice && q.symbol) {
        results.set(q.symbol, {
          price: q.regularMarketPrice,
          currency: q.currency || "USD",
        });
      }
    }
  };

  try {
    await withTiming("price.yahoo.fetch", () => fetchSymbols(symbols), {
      symbolCount: symbols.length,
    });
  } catch (batchErr) {
    // Batch failed after retries — fall back to per-symbol to isolate bad tickers
    log.error("price.yahoo.batch_failed", { error: String(batchErr) });
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          await fetchSymbols([symbol]);
        } catch (err) {
          log.error("price.yahoo.symbol_failed", { symbol, error: String(err) });
        }
      }),
    );
  }

  return results;
}

export async function fetchStockPrices(
  symbols: string[],
): Promise<Map<string, { price: number; currency: string }>> {
  return fetchYahooQuotes(symbols);
}

// Strip currency suffix from crypto symbol (e.g. "BTC-USD" -> "BTC")
function stripCurrencySuffix(symbol: string): string {
  return symbol.replace(/-[A-Z]{3,4}$/, "");
}

export async function fetchCryptoPrices(
  symbols: string[],
): Promise<Map<string, { price: number; currency: string }>> {
  if (symbols.length === 0) return new Map();

  // Primary: Yahoo Finance (handles crypto pairs like BTC-USD)
  const results = await fetchYahooQuotes(symbols);

  // Fallback: CoinGecko for any symbols not found via Yahoo Finance
  const missing = symbols.filter((s) => !results.has(s));
  if (missing.length > 0) {
    const symbolMap = missing.map((s) => {
      const base = stripCurrencySuffix(s);
      const geckoId = COINGECKO_IDS[base] || base.toLowerCase();
      return { original: s, base, geckoId };
    });

    const ids = symbolMap.map((s) => s.geckoId).filter(Boolean);
    if (ids.length > 0) {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;
      try {
        const data = await withTiming(
          "price.coingecko.fetch",
          () =>
            withRetry(async () => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
              try {
                const res = await fetch(url, {
                  signal: controller.signal,
                  next: { revalidate: 60, tags: ["prices:crypto"] },
                } as RequestInit);
                if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
                return res.json() as Promise<Record<string, { usd: number }>>;
              } finally {
                clearTimeout(timeoutId);
              }
            }),
          { idCount: ids.length },
        );
        for (const { original, geckoId } of symbolMap) {
          if (data[geckoId]?.usd) {
            results.set(original, { price: data[geckoId].usd, currency: "USD" });
          }
        }
      } catch (error) {
        log.error("price.coingecko.failed", { error: String(error) });
      }
    }
  }

  return results;
}

// Fetch all cached prices once and hold in a single stable cache entry.
// Using unstable_cache (not "use cache") so slow-query logs from Neon cold
// starts are NOT replayed on cache hits.
const fetchAllCachedPrices = unstable_cache(
  async () => {
    const results = await prisma.priceCache.findMany({
      select: { symbol: true, price: true, currency: true },
    });
    return results.map((p) => ({
      symbol: p.symbol,
      price: Number(p.price),
      currency: p.currency,
    }));
  },
  ["all-prices"],
  { tags: ["prices"], revalidate: 300 },
);

export async function getCachedPricesForSymbols(
  symbols: string[],
): Promise<{ symbol: string; price: number; currency: string }[]> {
  if (symbols.length === 0) return [];
  const all = await fetchAllCachedPrices();
  const symbolSet = new Set(symbols);
  return all.filter((p) => symbolSet.has(p.symbol));
}

export async function refreshAllPrices(): Promise<RefreshPricesResult> {
  const holdings = await prisma.holding.findMany({
    select: { symbol: true, assetType: true },
    distinct: ["symbol"],
  });
  return refreshPricesForHoldings(holdings, { force: true });
}

export async function refreshPricesForUser(
  userId: string,
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  const [holdings, trackedStocks] = await Promise.all([
    prisma.holding.findMany({
      where: { account: { userId } },
      select: { symbol: true, assetType: true },
      distinct: ["symbol"],
    }),
    prisma.stockWatchItem.findMany({
      where: { userId },
      select: { symbol: true },
      distinct: ["symbol"],
    }),
  ]);

  const holdingKeys = new Set(holdings.map((holding) => holding.symbol));
  const stockWatchHoldings = trackedStocks
    .filter((stock) => !holdingKeys.has(stock.symbol))
    .map((stock) => ({ symbol: stock.symbol, assetType: "STOCK" }));

  return refreshPricesForHoldings([...holdings, ...stockWatchHoldings], opts);
}

export async function refreshPricesForStockSymbols(
  symbols: string[],
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  if (uniqueSymbols.length === 0) {
    return {
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }
  return refreshPricesForHoldings(
    uniqueSymbols.map((symbol) => ({ symbol, assetType: "STOCK" })),
    opts,
  );
}

async function refreshPricesForHoldings(
  holdings: { symbol: string; assetType: string }[],
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  if (holdings.length === 0) {
    return {
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  // Freshness gate: drop symbols whose cached price is younger than the TTL
  // so repeated manual refreshes don't re-hit Yahoo/CoinGecko. The DB
  // updatedAt is the shared source of truth across serverless instances.
  let skippedFresh = 0;
  let earliestFreshUpdatedAt: Date | null = null;
  if (!opts.force) {
    const freshRows = await prisma.priceCache.findMany({
      where: {
        symbol: { in: holdings.map((h) => h.symbol) },
        updatedAt: { gte: new Date(Date.now() - PRICE_REFRESH_TTL_MS) },
      },
      select: { symbol: true, updatedAt: true },
    });
    if (freshRows.length > 0) {
      const freshSymbols = new Set(freshRows.map((row) => row.symbol));
      skippedFresh = freshSymbols.size;
      log.info("price.refresh.skipped_fresh", { count: skippedFresh });
      for (const row of freshRows) {
        if (!earliestFreshUpdatedAt || row.updatedAt < earliestFreshUpdatedAt) {
          earliestFreshUpdatedAt = row.updatedAt;
        }
      }
      holdings = holdings.filter((h) => !freshSymbols.has(h.symbol));
      if (holdings.length === 0) {
        // Everything is fresh. Tell the caller when a retry will actually do
        // something, in server-computed seconds so clients don't have to
        // trust their own clock.
        const nextRefreshAt = earliestFreshUpdatedAt
          ? new Date(earliestFreshUpdatedAt.getTime() + PRICE_REFRESH_TTL_MS)
          : null;
        return {
          updated: 0,
          changed: 0,
          skippedFresh,
          errors: [],
          nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
          retryAfterSeconds: nextRefreshAt
            ? Math.max(1, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 1000))
            : null,
        };
      }
    }
  }

  const stockSymbols = holdings
    .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND", "OPTION"].includes(h.assetType))
    .map((h) => h.symbol);

  const cryptoSymbols = holdings.filter((h) => h.assetType === "CRYPTO").map((h) => h.symbol);

  const errors: string[] = [];
  let updated = 0;

  const [stockPrices, cryptoPrices] = await Promise.all([
    fetchStockPrices(stockSymbols),
    fetchCryptoPrices(cryptoSymbols),
  ]);

  const allPrices = new Map([...stockPrices, ...cryptoPrices]);

  const entries = [...allPrices];
  if (entries.length === 0) {
    return {
      updated: 0,
      changed: 0,
      skippedFresh,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  // Count real value changes before the write so callers (the cron) can gate
  // global cache revalidations. Reading the existing rows first is one cheap
  // indexed SELECT; the upsert below still bumps updatedAt on every write so
  // the freshness gate and FreshnessBadge keep working.
  const existingRows = await prisma.priceCache.findMany({
    where: { symbol: { in: entries.map(([symbol]) => symbol) } },
    select: { symbol: true, price: true },
  });
  const existingPriceBySymbol = new Map(
    existingRows.map((row) => [row.symbol, normalizeTo8dp(Number(row.price))]),
  );
  const changedCount = entries.filter(([symbol, { price }]) => {
    const previous = existingPriceBySymbol.get(symbol);
    return previous === undefined || previous !== normalizeTo8dp(price);
  }).length;

  let changed = 0;
  try {
    const params: unknown[] = [];
    const placeholders = entries.map(([symbol, { price, currency }]) => {
      const base = params.length;
      params.push(symbol, String(price), currency);
      return `($${base + 1}, $${base + 2}::numeric, $${base + 3}, NOW())`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt")
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (symbol) DO UPDATE SET
         price       = EXCLUDED.price,
         currency    = EXCLUDED.currency,
         "updatedAt" = NOW()`,
      ...params,
    );
    updated = entries.length;
    changed = changedCount;
    // Only bust the cached price reads when a value actually changed — a
    // write that rewrites identical values leaves cache contents identical.
    if (changed > 0) {
      revalidateTag("prices", "max");
    }
  } catch (error) {
    errors.push(`Bulk upsert failed: ${String(error)}`);
  }

  return { updated, changed, skippedFresh, errors, nextRefreshAt: null, retryAfterSeconds: null };
}
