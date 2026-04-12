import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshAllPrices } from "@/lib/services/price-service";

export async function POST() {
  const result = await refreshAllPrices();
  revalidateTag("net-worth", "max");
  return NextResponse.json(result);
}
