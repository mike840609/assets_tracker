import { withAuth } from "@/lib/api-handler";
import { ok, failure } from "@/lib/api-responses";
import {
  rateLimitCheckWithPrune,
  rateLimitKeyForClientIp,
  rateLimitKeyForSubject,
} from "@/lib/rate-limit";
import { cacheEquityQuote, fetchEquityQuote } from "@/lib/services/stock-watch-service";

export const GET = withAuth(
  async (request, _ctx, _userId, principal, consumeRefreshCredit) => {
    const key =
      principal.kind === "demo"
        ? rateLimitKeyForSubject(principal.userId, "public-demo-stocks-quote")
        : rateLimitKeyForClientIp(request, "stocks-quote");
    const limited = rateLimitCheckWithPrune(request, {
      limit: 60,
      prefix: "stocks-quote",
      key,
    });
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim().toUpperCase();
    if (!symbol) return failure("Symbol is required");
    const marketLogOptions = { redactIdentifiers: principal.kind === "demo" };

    if (!consumeRefreshCredit) return failure("Market data access is unavailable", 500);
    const limitedRefresh = await consumeRefreshCredit();
    if (limitedRefresh) return limitedRefresh;

    const quote = await fetchEquityQuote(symbol, marketLogOptions);
    if (!quote) return failure("Only stock symbols can be tracked.", 400);
    const cached = await cacheEquityQuote(quote);

    return ok({
      ...quote,
      updatedAt: cached?.updatedAt ?? new Date().toISOString(),
    });
  },
  { demo: "allow", marketData: "refresh-credit" },
);
