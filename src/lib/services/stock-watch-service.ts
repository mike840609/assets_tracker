import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  normalizeMinorCurrencyQuote,
  refreshPricesForStockSymbols,
  type RefreshPricesOptions,
} from "@/lib/services/price-service";
import { getYahooClient } from "@/lib/services/yahoo-client";
import { PRICE_REFRESH_TTL_MS } from "@/lib/refresh-policy";
import { log } from "@/lib/logger";
import type { StockWatchItem } from "@/generated/prisma/client";
import type { AuthPrincipal } from "@/lib/auth-principal";
import { invalidateScopedTag } from "@/lib/demo/demo-cache";

type MarketLogOptions = { redactIdentifiers?: boolean };

export type EquityQuote = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
};

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
  sortOrder: number;
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
    sortOrder: item.sortOrder,
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
    // Manual order first; createdAt keeps a stable newest-first tiebreak for
    // rows that share a sortOrder (e.g. before the user has reordered).
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { symbol: "asc" }],
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

export function invalidateStockWatchCaches(userId: string, principal: AuthPrincipal) {
  invalidateScopedTag({
    globalTag: "stocks",
    userTag: `stocks:${userId}`,
    principal,
  });
}

export async function fetchEquityQuote(
  symbol: string,
  options: MarketLogOptions = {},
): Promise<EquityQuote | null> {
  const normalized = symbol.toUpperCase();
  let quote;
  try {
    const yahooFinance = await getYahooClient();
    quote = await yahooFinance.quote(normalized);
  } catch (error) {
    if (options.redactIdentifiers) throw new Error("Market quote lookup failed");
    throw error;
  }

  if (Array.isArray(quote) || quote.quoteType !== "EQUITY" || !quote.regularMarketPrice) {
    return null;
  }

  // Normalize minor-unit quotes (LSE pence "GBp", JSE cents "ZAc") to the major
  // ISO unit so both the PriceCache write in warmStockPrice and the watch item's
  // stored currency stay consistent with the holdings pipeline.
  const { price, currency } = normalizeMinorCurrencyQuote(
    quote.regularMarketPrice,
    quote.currency || "USD",
  );

  return {
    symbol: quote.symbol || normalized,
    name: quote.longName || quote.shortName || normalized,
    exchange: quote.fullExchangeName || quote.exchange || "",
    currency,
    price,
  };
}

/** Persist an already-fetched quote without making another provider request. */
export async function cacheEquityQuote(quote: EquityQuote): Promise<{
  price: number;
  currency: string;
  updatedAt: string;
}> {
  const cached = await prisma.priceCache.upsert({
    where: { symbol: quote.symbol.toUpperCase() },
    update: { price: quote.price, currency: quote.currency, updatedAt: new Date() },
    create: {
      symbol: quote.symbol.toUpperCase(),
      price: quote.price,
      currency: quote.currency,
    },
    select: { price: true, currency: true, updatedAt: true },
  });
  revalidateTag("prices", "max");

  return {
    price: Number(cached.price),
    currency: cached.currency,
    updatedAt: cached.updatedAt.toISOString(),
  };
}

export async function warmStockPrice(
  symbol: string,
  options: MarketLogOptions = {},
): Promise<{
  price: number;
  currency: string;
  updatedAt: string;
} | null> {
  const normalized = symbol.toUpperCase();

  // Freshness gate: serve the cached price without a Yahoo round-trip when
  // it's younger than the shared TTL.
  const existing = await prisma.priceCache.findUnique({
    where: { symbol: normalized },
    select: { price: true, currency: true, updatedAt: true },
  });
  if (existing && Date.now() - existing.updatedAt.getTime() < PRICE_REFRESH_TTL_MS) {
    return {
      price: Number(existing.price),
      currency: existing.currency,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const quote = await fetchEquityQuote(normalized, options);
  return quote ? cacheEquityQuote(quote) : null;
}

export async function refreshTrackedStockPrices(
  userId: string,
  options: RefreshPricesOptions = {},
) {
  const stocks = await prisma.stockWatchItem.findMany({
    where: { userId },
    select: { symbol: true },
    distinct: ["symbol"],
  });
  return refreshPricesForStockSymbols(
    stocks.map((stock) => stock.symbol),
    options,
  );
}

export async function tryWarmStockPrice(symbol: string, options: MarketLogOptions = {}) {
  try {
    return await warmStockPrice(symbol, options);
  } catch (error) {
    log.warn(
      "stocks.price_warm.failed",
      options.redactIdentifiers
        ? {
            operation: "warm-stock-price",
            errorType: error instanceof Error ? error.name : "unknown",
          }
        : { symbol, error: String(error) },
    );
    return null;
  }
}

export async function tryCacheEquityQuote(quote: EquityQuote, options: MarketLogOptions = {}) {
  try {
    return await cacheEquityQuote(quote);
  } catch (error) {
    log.warn(
      "stocks.price_cache.failed",
      options.redactIdentifiers
        ? {
            operation: "cache-stock-price",
            errorType: error instanceof Error ? error.name : "unknown",
          }
        : { symbol: quote.symbol, error: String(error) },
    );
    return null;
  }
}
