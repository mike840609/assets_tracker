import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-responses";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

export async function GET(request: Request) {
  await connection();
  const limited = await rateLimitCheckWithPrune(request, { limit: 30, prefix: "exchange-rates" });
  if (limited) return limited;

  const rates = await prisma.exchangeRate.findMany({
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });
  return ok(rates, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
