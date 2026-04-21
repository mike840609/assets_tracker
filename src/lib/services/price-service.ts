import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  try {
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yahooFinance = new YahooFinance();
    const quotes = await yahooFinance.quote(symbols);
    for (const q of Array.isArray(quotes) ? quotes : [quotes]) {
      if (q?.regularMarketPrice && q.symbol) {
        results.set(q.symbol, {
          price: q.regularMarketPrice,
          currency: q.currency || "USD",
        });
      }
    }
  } catch (error) {
    console.error("Yahoo Finance fetch failed:", error);
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
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
          { next: { revalidate: 60, tags: ["prices:crypto"] } }
        );
        if (res.ok) {
          const data = await res.json();
          for (const { original, geckoId } of symbolMap) {
            if (data[geckoId]?.usd) {
              results.set(original, { price: data[geckoId].usd, currency: "USD" });
            }
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

export async function refreshAllPrices(): Promise<{
  updated: number;
  errors: string[];
}> {
  const holdings = await prisma.holding.findMany({
    select: { symbol: true, assetType: true },
    distinct: ["symbol"],
  });

  const stockSymbols = holdings
    .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND"].includes(h.assetType))
    .map((h) => h.symbol);

  const cryptoSymbols = holdings
    .filter((h) => h.assetType === "CRYPTO")
    .map((h) => h.symbol);

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
