import { revalidateTag } from "next/cache";
import { refreshAllPrices } from "@/lib/services/price-service";
import { ok } from "@/lib/api-responses";

export async function POST() {
  const result = await refreshAllPrices();
  revalidateTag("net-worth");
  return ok(result);
}
