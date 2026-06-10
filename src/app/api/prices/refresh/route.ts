import { revalidateTag } from "next/cache";
import { withAuth } from "@/lib/api-handler";
import { refreshPricesForUser } from "@/lib/services/price-service";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { ok } from "@/lib/api-responses";

export const POST = withAuth(async (request, _ctx, userId) => {
  // Per-user (not per-IP): each call fans out to Yahoo/CoinGecko for every
  // holding symbol. The service-level freshness gate is the primary defense;
  // this just stops request loops from reaching the DB queries.
  const limited = rateLimitCheckWithPrune(request, {
    limit: 5,
    prefix: "prices-refresh",
    key: userId,
  });
  if (limited) return limited;

  const result = await refreshPricesForUser(userId);

  // Only bust caches when something actually changed — a fully-fresh refresh
  // shouldn't force every cached read to recompute.
  if (result.updated > 0) {
    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    revalidateTag("net-worth", "max");
    revalidateTag(`net-worth:${userId}`, "max");
    revalidateTag("prices", "max");
    revalidateTag("prices:crypto", "max");
  }
  return ok(result);
});
