import { refreshAllPrices } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";
import { invalidatePriceData } from "@/lib/cache-invalidation";

export async function POST() {
  const result = await refreshAllPrices();
  invalidatePriceData();
  return ok(result);
}
