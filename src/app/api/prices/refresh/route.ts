import { revalidateTag } from "next/cache";
import { withAuth } from "@/lib/api-handler";
import { refreshPricesForUser } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

export const POST = withAuth(async (request, _ctx, userId) => {
  const limited = rateLimitCheckWithPrune(request, { limit: 60, prefix: "prices-refresh" });
  if (limited) return limited;

  const result = await refreshPricesForUser(userId);
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag("net-worth", "max");
  revalidateTag("prices:crypto", "max");
  revalidateTag(`accounts:${userId}`, "max");
  return ok(result);
});
