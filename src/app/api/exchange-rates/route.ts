import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-responses";

export async function GET() {
  const rates = await prisma.exchangeRate.findMany();
  return ok(rates, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
