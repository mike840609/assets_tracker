import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  refreshPricesForStockSymbols,
  type PriceRefreshResult,
} from "@/lib/services/price-service";
import { getYahooClient } from "@/lib/services/yahoo-client";
import { log } from "@/lib/logger";
import type { StockWatchItem } from "@/generated/prisma/client";

export type SerializedStockWatchItem = {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  recordPrice: number;
  recordDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedTrackedStock = SerializedStockWatchItem & {
  latestPrice: number | null;
  latestPriceCurrency: string | null;
  latestPriceUpdatedAt: string | null;
  change: number | null;
  changePercent: number | null;
};

export function serializeStockWatchItem(item: StockWatchItem): SerializedStockWatchItem {
  return {
    id: item.id,
    userId: item.userId,
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    currency: item.currency,
    recordPrice: Number(item.recordPrice),
    recordDate: item.recordDate.toISOString().slice(0, 10),
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function withLatestPrice(
  item: SerializedStockWatchItem,
  price?: { price: number; currency: string; updatedAt: Date },
): SerializedTrackedStock {
  const latestPrice = price?.price ?? null;
  // Change math is only meaningful when the cached quote is denominated in the
  // same currency the record price was captured in (PriceCache is shared with
  // the holdings pipeline, so the currencies can diverge).
  const comparable = latestPrice !== null && price?.currency === item.currency;
  const change = comparable ? latestPrice - item.recordPrice : null;
  const changePercent =
    change === null || item.recordPrice === 0 ? null : (change / item.recordPrice) * 100;

  return {
    ...item,
    latestPrice,
    latestPriceCurrency: price?.currency ?? null,
    latestPriceUpdatedAt: price?.updatedAt.toISOString() ?? null,
    change,
    changePercent,
  };
}

export async function getCachedTrackedStocks(userId: string): Promise<SerializedTrackedStock[]> {
  "use cache";
  cacheTag("stocks");
  cacheTag(`stocks:${userId}`);
  // Also reads PriceCache, so any price refresh (cron, holdings, manual) must
  // invalidate this read via the shared "prices" tag.
  cacheTag("prices");
  cacheLife("hours");
  const items = await prisma.stockWatchItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { symbol: "asc" }],
  });
  const symbols = items.map((item) => item.symbol);
  const prices =
    symbols.length === 0
      ? []
      : await prisma.priceCache.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, price: true, currency: true, updatedAt: true },
        });
  const priceMap = new Map(
    prices.map((price) => [
      price.symbol,
      {
        price: Number(price.price),
        currency: price.currency,
        updatedAt: price.updatedAt,
      },
    ]),
  );

  return items.map((item) =>
    withLatestPrice(serializeStockWatchItem(item), priceMap.get(item.symbol)),
  );
}

export function invalidateStockWatchCaches(userId: string) {
  revalidateTag("stocks", { expire: 0 });
  revalidateTag(`stocks:${userId}`, { expire: 0 });
  revalidateTag("prices", "max");
}

export async function fetchEquityQuote(symbol: string): Promise<{
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
} | null> {
  const normalized = symbol.toUpperCase();
  const yahooFinance = await getYahooClient();
  const quote = await yahooFinance.quote(normalized);

  if (Array.isArray(quote) || quote.quoteType !== "EQUITY" || !quote.regularMarketPrice) {
    return null;
  }

  return {
    symbol: quote.symbol || normalized,
    name: quote.longName || quote.shortName || normalized,
    exchange: quote.fullExchangeName || quote.exchange || "",
    currency: quote.currency || "USD",
    price: quote.regularMarketPrice,
  };
}

export async function warmStockPrice(symbol: string): Promise<{
  price: number;
  currency: string;
  updatedAt: string;
} | null> {
  const normalized = symbol.toUpperCase();
  const quote = await fetchEquityQuote(normalized);
  const result = quote ? { price: quote.price, currency: quote.currency } : null;
  if (!result) return null;

  await prisma.priceCache.upsert({
    where: { symbol: normalized },
    update: { price: result.price, currency: result.currency, updatedAt: new Date() },
    create: { symbol: normalized, price: result.price, currency: result.currency },
  });
  revalidateTag("prices", "max");

  const cached = await prisma.priceCache.findUnique({
    where: { symbol: normalized },
    select: { price: true, currency: true, updatedAt: true },
  });

  if (!cached) return null;
  return {
    price: Number(cached.price),
    currency: cached.currency,
    updatedAt: cached.updatedAt.toISOString(),
  };
}

export async function refreshTrackedStockPrices(userId: string): Promise<PriceRefreshResult> {
  const stocks = await prisma.stockWatchItem.findMany({
    where: { userId },
    select: { symbol: true },
    distinct: ["symbol"],
  });
  const result = await refreshPricesForStockSymbols(stocks.map((stock) => stock.symbol));
  invalidateStockWatchCaches(userId);
  return result;
}

export async function tryWarmStockPrice(symbol: string) {
  try {
    return await warmStockPrice(symbol);
  } catch (error) {
    log.warn("stocks.price_warm.failed", { symbol, error: String(error) });
    return null;
  }
}
