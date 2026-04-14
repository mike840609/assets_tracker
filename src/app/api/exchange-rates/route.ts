import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-responses";

export async function GET() {
  const rates = await prisma.exchangeRate.findMany();
  return ok(rates);
}
