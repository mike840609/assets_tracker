import { revalidateTag } from "next/cache";
import { withAuth } from "@/lib/api-handler";
import { refreshPricesForUser } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";

export const POST = withAuth(async (_request, _ctx, userId) => {
  const result = await refreshPricesForUser(userId);
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag("net-worth", "max");
  revalidateTag("prices:crypto", "max");
  return ok(result);
});
