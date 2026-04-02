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

export async function fetchStockPrices(
  symbols: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  if (symbols.length === 0) return results;

  try {
    const yahooFinance = (await import("yahoo-finance2")).default;
    for (const symbol of symbols) {
      try {
        const quote = await yahooFinance.quote(symbol);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = quote as any;
        if (q.regularMarketPrice && q.symbol) {
          results.set(q.symbol, q.regularMarketPrice);
        }
      } catch {
        console.error(`Failed to fetch price for ${symbol}`);
      }
    }
  } catch (error) {
    console.error("Failed to fetch stock prices:", error);
  }

  return results;
}

export async function fetchCryptoPrices(
  symbols: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  if (symbols.length === 0) return results;

  const ids = symbols
    .map((s) => COINGECKO_IDS[s] || s.toLowerCase())
    .filter(Boolean);

  if (ids.length === 0) return results;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    for (const symbol of symbols) {
      const geckoId = COINGECKO_IDS[symbol] || symbol.toLowerCase();
      if (data[geckoId]?.usd) {
        results.set(symbol, data[geckoId].usd);
      }
    }
  } catch (error) {
    console.error("Failed to fetch crypto prices:", error);
  }

  return results;
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

  for (const [symbol, price] of allPrices) {
    try {
      await prisma.priceCache.upsert({
        where: { symbol },
        update: { price, updatedAt: new Date() },
        create: { symbol, price, currency: "USD" },
      });
      updated++;
    } catch (error) {
      errors.push(`Failed to update ${symbol}: ${error}`);
    }
  }

  return { updated, errors };
}
