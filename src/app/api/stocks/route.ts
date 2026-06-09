import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createStockWatchItemSchema } from "@/lib/validators";
import {
  fetchEquityQuote,
  getCachedTrackedStocks,
  invalidateStockWatchCaches,
  serializeStockWatchItem,
  tryWarmStockPrice,
} from "@/lib/services/stock-watch-service";

export const GET = withAuth(async (_request, _ctx, userId) => {
  const stocks = await getCachedTrackedStocks(userId);
  return ok(stocks);
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = createStockWatchItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const symbol = parsed.data.symbol;
  const existing = await prisma.stockWatchItem.findUnique({
    where: { userId_symbol: { userId, symbol } },
    select: { id: true },
  });
  if (existing) return failure("This stock is already tracked.", 409);

  const quote = await fetchEquityQuote(symbol);
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

  const item = await prisma.stockWatchItem.create({
    data: {
      userId,
      symbol: quote.symbol,
      name: quote.name || parsed.data.name,
      exchange: quote.exchange || parsed.data.exchange,
      currency: quote.currency || parsed.data.currency,
      recordPrice: parsed.data.recordPrice,
      recordDate: new Date(`${parsed.data.recordDate}T00:00:00.000Z`),
      note: parsed.data.note?.trim() || null,
    },
  });

  await tryWarmStockPrice(item.symbol);
  invalidateStockWatchCaches(userId);
  return ok(serializeStockWatchItem(item), { status: 201 });
});
