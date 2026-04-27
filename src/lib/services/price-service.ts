import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s
// Cached prices younger than this are served without re-fetching from the
// upstream provider — primary defense against yahoo-finance2 rate limits.
const PRICE_CACHE_TTL_MS = 15 * 60 * 1_000;

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
  symbols: string[]
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
          setTimeout(
            () => reject(new Error("Yahoo Finance request timed out")),
            FETCH_TIMEOUT_MS
          )
        ),
      ])
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
    await fetchSymbols(symbols);
  } catch (batchErr) {
    // Batch failed after retries — fall back to per-symbol to isolate bad tickers
    console.error("Yahoo Finance batch fetch failed, retrying per-symbol:", batchErr);
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          await fetchSymbols([symbol]);
        } catch (err) {
          console.error(`Yahoo Finance fetch failed for ${symbol}:`, err);
        }
      })
    );
  }

  return results;
}

export async function fetchStockPrices(
  symbols: string[]
): Promise<Map<string, { price: number; currency: string }>> {
  return fetchYahooQuotes(symbols);
}

// Strip currency suffix from crypto symbol (e.g. "BTC-USD" -> "BTC")
function stripCurrencySuffix(symbol: string): string {
  return symbol.replace(/-[A-Z]{3,4}$/, "");
}

export async function fetchCryptoPrices(
  symbols: string[]
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
        const data = await withRetry(async () => {
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
        });
        for (const { original, geckoId } of symbolMap) {
          if (data[geckoId]?.usd) {
            results.set(original, { price: data[geckoId].usd, currency: "USD" });
          }
        }
      } catch (error) {
        console.error("CoinGecko fallback failed:", error);
      }
    }
  }

  return results;
}

export async function getCachedPricesForSymbols(
  symbols: string[]
): Promise<{ symbol: string; price: number; currency: string }[]> {
  "use cache";
  cacheTag("prices");
  cacheLife("minutes");
  if (symbols.length === 0) return [];
  const results = await prisma.priceCache.findMany({
    where: { symbol: { in: symbols } },
  });
  return results.map((p) => ({
    symbol: p.symbol,
    price: Number(p.price),
    currency: p.currency,
  }));
}

// Freshness-aware fetch: returns cached prices for any symbol whose PriceCache
// row is younger than PRICE_CACHE_TTL_MS, and only calls the upstream provider
// for the stale/missing remainder. Upserts the freshly fetched rows.
export async function getOrFetchPrices(
  symbols: string[],
  kind: "stock" | "crypto"
): Promise<Map<string, { price: number; currency: string }>> {
  const merged = new Map<string, { price: number; currency: string }>();
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return merged;

  const cached = await prisma.priceCache.findMany({
    where: { symbol: { in: unique } },
  });
  const cutoff = Date.now() - PRICE_CACHE_TTL_MS;
  const stale: string[] = [];
  const seen = new Set<string>();

  for (const row of cached) {
    seen.add(row.symbol);
    if (row.updatedAt.getTime() >= cutoff) {
      merged.set(row.symbol, {
        price: Number(row.price),
        currency: row.currency,
      });
    } else {
      stale.push(row.symbol);
    }
  }
  for (const s of unique) if (!seen.has(s)) stale.push(s);

  if (stale.length === 0) return merged;

  let fresh: Map<string, { price: number; currency: string }>;
  try {
    fresh = kind === "crypto"
      ? await fetchCryptoPrices(stale)
      : await fetchStockPrices(stale);
  } catch (error) {
    console.error(
      `getOrFetchPrices: provider fetch failed for ${stale.length} symbols`,
      error
    );
    return merged;
  }

  for (const [symbol, value] of fresh) {
    merged.set(symbol, value);
    try {
      await prisma.priceCache.upsert({
        where: { symbol },
        update: { price: value.price, currency: value.currency, updatedAt: new Date() },
        create: { symbol, price: value.price, currency: value.currency },
      });
    } catch (error) {
      console.error(`getOrFetchPrices: upsert failed for ${symbol}`, error);
    }
  }
  return merged;
}

export async function refreshAllPrices(): Promise<{
  updated: number;
  errors: string[];
}> {
  const holdings = await prisma.holding.findMany({
    where: {
      quantity: { gt: 0 },
      account: { isActive: true },
    },
    select: { symbol: true, assetType: true },
    distinct: ["symbol"],
  });

  const stockSymbols = [...new Set(
    holdings
      .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType))
      .map((h) => h.symbol)
  )];

  const cryptoSymbols = [...new Set(
    holdings
      .filter((h) => h.assetType === "CRYPTO")
      .map((h) => h.symbol)
  )];

  const errors: string[] = [];
  let updated = 0;

  const [stockPrices, cryptoPrices] = await Promise.all([
    fetchStockPrices(stockSymbols),
    fetchCryptoPrices(cryptoSymbols),
  ]);

  const allPrices = new Map([...stockPrices, ...cryptoPrices]);

  const entries = [...allPrices];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const upserts = chunk.map(([symbol, { price, currency }]) =>
      prisma.priceCache.upsert({
        where: { symbol },
        update: { price, currency, updatedAt: new Date() },
        create: { symbol, price, currency },
      })
    );
    try {
      await prisma.$transaction(upserts);
      updated += chunk.length;
    } catch (error) {
      const symbols = chunk.map(([s]) => s).join(", ");
      errors.push(`Batch upsert failed for [${symbols}]: ${String(error)}`);
    }
  }

  return { updated, errors };
}
