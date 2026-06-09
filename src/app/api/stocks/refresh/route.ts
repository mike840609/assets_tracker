import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { refreshTrackedStockPrices } from "@/lib/services/stock-watch-service";

export const POST = withAuth(async (request, _ctx, userId) => {
  // Tighter than the quote endpoint: each call fans out to Yahoo for every
  // tracked symbol.
  const limited = rateLimitCheckWithPrune(request, { limit: 10, prefix: "stocks-refresh" });
  if (limited) return limited;

  const result = await refreshTrackedStockPrices(userId);
  return ok(result);
});
