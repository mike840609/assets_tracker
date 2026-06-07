import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-responses";
import { refreshTrackedStockPrices } from "@/lib/services/stock-watch-service";

export const POST = withAuth(async (_request, _ctx, userId) => {
  const result = await refreshTrackedStockPrices(userId);
  return ok(result);
});
