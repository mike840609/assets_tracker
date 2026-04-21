import { revalidateTag } from "next/cache";
import { refreshAllPrices } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";

export async function POST() {
  const result = await refreshAllPrices();
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag("net-worth", "max");
  revalidateTag("prices:crypto", "max");
  return ok(result);
}
