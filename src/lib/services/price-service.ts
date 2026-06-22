import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getYahooClient } from "@/lib/services/yahoo-client";
import { PRICE_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log, withTiming } from "@/lib/logger";

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s
const CLAIM_LOCK_TTL_MS = 30_000; // dead-instance TTL for refreshingAt claim

export type RefreshPricesResult = {
  updated: number;
  /** Persisted rows whose price/currency changed compared with the previous value. */
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

function decimalChangedAtDbScale(current: unknown, next: number): boolean {
  const currentNumber = Number(current);
  return (
    !Number.isFinite(currentNumber) ||
    !Number.isFinite(next) ||
    currentNumber.toFixed(8) !== next.toFixed(8)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

async function releaseClaims(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  const placeholders = symbols.map((_, i) => `$${i + 1}`).join(", ");
  await prisma
    .$executeRawUnsafe(
      `UPDATE "PriceCache" SET "refreshingAt" = NULL WHERE symbol IN (${placeholders})`,
      ...symbols,
    )
    .catch((err) => {
      log.error("price.refresh.claim_cleanup_failed", { error: String(err) });
    });
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

  let skippedFresh = 0;
  let earliestFreshUpdatedAt: Date | null = null;
  let claimedSymbols: string[] = [];

  if (!opts.force) {
    // Single query: load all existing PriceCache rows for these symbols so we
    // can derive fresh / stale-existing / stale-new in one round-trip.
    const existingRows = await prisma.priceCache.findMany({
      where: { symbol: { in: holdings.map((h) => h.symbol) } },
      select: { symbol: true, updatedAt: true },
    });

    const freshThreshold = new Date(Date.now() - PRICE_REFRESH_TTL_MS);
    const freshSymbols = new Set<string>();
    const existingSymbols = new Set<string>();

    for (const row of existingRows) {
      existingSymbols.add(row.symbol);
      if (row.updatedAt >= freshThreshold) {
        freshSymbols.add(row.symbol);
        if (!earliestFreshUpdatedAt || row.updatedAt < earliestFreshUpdatedAt) {
          earliestFreshUpdatedAt = row.updatedAt;
        }
      }
    }

    skippedFresh = freshSymbols.size;
    if (skippedFresh > 0) {
      log.info("price.refresh.skipped_fresh", { count: skippedFresh });
    }

    holdings = holdings.filter((h) => !freshSymbols.has(h.symbol));

    if (holdings.length === 0) {
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

    // Split stale symbols: existing rows can be claimed; new symbols bypass the claim.
    const staleExisting = holdings
      .filter((h) => existingSymbols.has(h.symbol))
      .map((h) => h.symbol);
    const staleNew = holdings.filter((h) => !existingSymbols.has(h.symbol));

    if (staleExisting.length > 0) {
      // Atomic claim: set refreshingAt = NOW() only for symbols that are stale
      // and not currently being refreshed (or whose claim has expired after 30s).
      // $1 = lockCutoff (refreshingAt expiry), $2 = freshThreshold (updatedAt gate),
      // $3...$N = symbol values — all positional, no string interpolation of values.
      const lockCutoff = new Date(Date.now() - CLAIM_LOCK_TTL_MS);
      const symbolPlaceholders = staleExisting.map((_, i) => `$${i + 3}`).join(", ");
      const claimed = await prisma.$queryRawUnsafe<{ symbol: string }[]>(
        `UPDATE "PriceCache"
         SET "refreshingAt" = NOW()
         WHERE symbol IN (${symbolPlaceholders})
           AND ("refreshingAt" IS NULL OR "refreshingAt" < $1)
           AND "updatedAt" < $2
         RETURNING symbol`,
        lockCutoff,
        freshThreshold,
        ...staleExisting,
      );
      claimedSymbols = claimed.map((r) => r.symbol);
    }

    if (claimedSymbols.length === 0 && staleNew.length === 0) {
      // All existing stale symbols are being refreshed by another instance.
      // Tell the client when the claim lock expires so it knows when to retry.
      return {
        updated: 0,
        changed: 0,
        skippedFresh,
        errors: [],
        nextRefreshAt: null,
        retryAfterSeconds: Math.ceil(CLAIM_LOCK_TTL_MS / 1000),
      };
    }

    // Narrow holdings to only the symbols this instance will fetch.
    const fetchable = new Set([...claimedSymbols, ...staleNew.map((h) => h.symbol)]);
    holdings = holdings.filter((h) => fetchable.has(h.symbol));
  }

  const stockSymbols = holdings
    .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND", "OPTION"].includes(h.assetType))
    .map((h) => h.symbol);

  const cryptoSymbols = holdings.filter((h) => h.assetType === "CRYPTO").map((h) => h.symbol);

  const errors: string[] = [];
  let updated = 0;
  let changed = 0;

  const [stockPrices, cryptoPrices] = await Promise.all([
    fetchStockPrices(stockSymbols),
    fetchCryptoPrices(cryptoSymbols),
  ]);

  const allPrices = new Map([...stockPrices, ...cryptoPrices]);

  const entries = [...allPrices];
  if (entries.length === 0) {
    // No prices came back (all fetches failed). Release claims so the next
    // request can retry rather than waiting for the 30s dead-instance TTL.
    await releaseClaims(claimedSymbols);
    return {
      updated: 0,
      changed: 0,
      skippedFresh,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  try {
    const currentRows = await prisma.priceCache.findMany({
      where: { symbol: { in: entries.map(([symbol]) => symbol) } },
      select: { symbol: true, price: true, currency: true },
    });
    const currentBySymbol = new Map(currentRows.map((row) => [row.symbol, row]));
    const pendingChanged = entries.reduce((count, [symbol, { price, currency }]) => {
      const current = currentBySymbol.get(symbol);
      return current === undefined ||
        current.currency !== currency ||
        decimalChangedAtDbScale(current.price, price)
        ? count + 1
        : count;
    }, 0);

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
         price          = EXCLUDED.price,
         currency       = EXCLUDED.currency,
         "updatedAt"    = NOW(),
         "refreshingAt" = NULL`,
      ...params,
    );
    updated = entries.length;
    changed = pendingChanged;
    if (changed > 0) revalidateTag("prices", "max");
  } catch (error) {
    errors.push(`Bulk upsert failed: ${String(error)}`);
    // Release claims so the next request can retry immediately.
    await releaseClaims(claimedSymbols);
  }

  return { updated, changed, skippedFresh, errors, nextRefreshAt: null, retryAfterSeconds: null };
}
