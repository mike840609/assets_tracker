import { NextResponse } from "next/server";
import { refreshAllPrices } from "@/lib/services/price-service";

export async function POST() {
  const result = await refreshAllPrices();
  return NextResponse.json(result);
}
