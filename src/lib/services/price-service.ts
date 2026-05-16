import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { log, withTiming } from "@/lib/logger";

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s

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

  const YahooFinance = (await import("yahoo-finance2")).default;
  const yahooFinance = new YahooFinance();

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

export async function refreshAllPrices(): Promise<{
  updated: number;
  errors: string[];
}> {
  const holdings = await prisma.holding.findMany({
    select: { symbol: true, assetType: true },
    distinct: ["symbol"],
  });

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
  if (entries.length === 0) return { updated: 0, errors: [] };

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
  } catch (error) {
    errors.push(`Bulk upsert failed: ${String(error)}`);
  }

  return { updated, errors };
}
