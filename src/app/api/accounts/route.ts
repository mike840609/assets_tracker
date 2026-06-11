import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { log } from "@/lib/logger";

// revalidateTag convention (applies to all mutation routes): direct
// user-initiated mutations use `{ expire: 0 }` so the very next read is fresh
// (blocking revalidate); background jobs (cron) use `"max"` for
// stale-while-revalidate semantics. See node_modules/next/dist/docs revalidateTag.
function invalidateUserCaches(userId: string) {
  revalidateTag(`accounts:${userId}`, { expire: 0 });
  revalidateTag(`net-worth:${userId}`, { expire: 0 });
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
    revalidateTag("exchange-rates", { expire: 0 });
  } catch (error) {
    log.warn("rates.warm.failed", { currency, error: String(error) });
  }
}

export const GET = withAuth(async (_req, _ctx, userId) => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: [
      { isActive: "desc" },
      { isPinned: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
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

  const maxSortOrder = await prisma.account.aggregate({
    where: {
      userId,
      type: parsed.data.type,
      isActive: true,
    },
    _max: { sortOrder: true },
  });

  const account = await prisma.account.create({
    data: {
      ...parsed.data,
      userId,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });
  invalidateUserCaches(userId);
  void maybeWarmExchangeRate(account.currency);
  return ok(account, { status: 201 });
});
