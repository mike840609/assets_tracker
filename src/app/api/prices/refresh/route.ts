import { revalidateTag } from "next/cache";
import { refreshAllPrices } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimitCheckWithPrune(request, { limit: 5, prefix: "prices-refresh" });
  if (limited) return limited;

  const result = await refreshAllPrices();
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag("net-worth", "max");
  revalidateTag("prices:crypto", "max");
  return ok(result);
}
