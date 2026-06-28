import { connection } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ok, failure } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { fetchEquityQuote, warmStockPrice } from "@/lib/services/stock-watch-service";

export const GET = withAuth(async (request) => {
  await connection();
  const limited = await rateLimitCheckWithPrune(request, { limit: 60, prefix: "stocks-quote" });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return failure("Symbol is required");

  const quote = await fetchEquityQuote(symbol);
  if (!quote) return failure("Only stock symbols can be tracked.", 400);
  const cached = await warmStockPrice(symbol);

  return ok({
    ...quote,
    updatedAt: cached?.updatedAt ?? new Date().toISOString(),
  });
});
