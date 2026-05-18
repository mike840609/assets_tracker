import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { log } from "@/lib/logger";

function invalidateUserCaches(userId: string) {
  // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
  revalidateTag(`accounts:${userId}`, "max");
  revalidateTag(`net-worth:${userId}`, "max");
}

// Fire-and-forget rate refresh for a currency that doesn't yet exist in
// ExchangeRate. Keeps render paths read-only against the rates table.
async function maybeWarmExchangeRate(currency: string) {
  try {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: currency },
      select: { id: true },
    });
    if (existing) return;
    await refreshExchangeRates(currency);
    revalidateTag("exchange-rates", "max");
  } catch (error) {
    log.warn("rates.warm.failed", { currency, error: String(error) });
  }
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(accounts);
});

export const DELETE = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return failure("ids array required");
  }

  await prisma.account.deleteMany({
    where: {
      id: { in: ids },
      userId,
    },
  });
  invalidateUserCaches(userId);
  return ok({ ok: true });
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const account = await prisma.account.create({
    data: { ...parsed.data, userId },
  });
  invalidateUserCaches(userId);
  void maybeWarmExchangeRate(account.currency);
  return ok(account, { status: 201 });
});
