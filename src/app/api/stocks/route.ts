import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createStockWatchItemSchema } from "@/lib/validators";
import {
  fetchEquityQuote,
  getCachedTrackedStocks,
  invalidateStockWatchCaches,
  serializeStockWatchItem,
  tryCacheEquityQuote,
} from "@/lib/services/stock-watch-service";

export const GET = withAuth(
  async (_request, _ctx, userId) => {
    const stocks = await getCachedTrackedStocks(userId);
    return ok(stocks);
  },
  { demo: "allow" },
);

export const POST = withAuth(
  async (request, _ctx, userId, principal, consumeRefreshCredit) => {
    const body = await request.json();
    const parsed = createStockWatchItemSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const symbol = parsed.data.symbol;
    const marketLogOptions = { redactIdentifiers: principal.kind === "demo" };
    const existing = await prisma.stockWatchItem.findUnique({
      where: { userId_symbol: { userId, symbol } },
      select: { id: true },
    });
    if (existing) return failure("This stock is already tracked.", 409);

    if (!consumeRefreshCredit) return failure("Market data access is unavailable", 500);
    const limitedRefresh = await consumeRefreshCredit();
    if (limitedRefresh) return limitedRefresh;

    const quote = await fetchEquityQuote(symbol, marketLogOptions);
    if (!quote) return failure("Only stock symbols can be tracked.", 400);

    // Yahoo may canonicalize the symbol (e.g. BRK.B → BRK-B); the row is created
    // with quote.symbol, so the dedupe check must cover that form too.
    if (quote.symbol !== symbol) {
      const existingCanonical = await prisma.stockWatchItem.findUnique({
        where: { userId_symbol: { userId, symbol: quote.symbol } },
        select: { id: true },
      });
      if (existingCanonical) return failure("This stock is already tracked.", 409);
    }

    // Append new stocks to the bottom so a manually saved order stays intact.
    const { _max } = await prisma.stockWatchItem.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (_max.sortOrder ?? -1) + 1;

    let item;
    try {
      item = await prisma.stockWatchItem.create({
        data: {
          userId,
          symbol: quote.symbol,
          name: quote.name || parsed.data.name,
          exchange: quote.exchange || parsed.data.exchange,
          currency: quote.currency || parsed.data.currency,
          recordPrice: parsed.data.recordPrice,
          recordDate: new Date(`${parsed.data.recordDate}T00:00:00.000Z`),
          note: parsed.data.note?.trim() || null,
          sortOrder: nextSortOrder,
        },
      });
    } catch (error) {
      // Concurrent duplicate adds can both pass the findUnique pre-checks, then
      // the second create violates the userId_symbol unique index (P2002).
      // Map that race to the same 409 the pre-checks return.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return failure("This stock is already tracked.", 409);
      }
      throw error;
    }

    await tryCacheEquityQuote(quote, marketLogOptions);
    invalidateStockWatchCaches(userId, principal);
    return ok(serializeStockWatchItem(item), { status: 201 });
  },
  { demo: "allow", marketData: "refresh-credit" },
);
