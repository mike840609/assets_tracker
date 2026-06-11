import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { withAuth } from "@/lib/api-handler";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { ok } from "@/lib/api-responses";

export const POST = withAuth(async (request, _ctx, userId) => {
  // Per-user secondary defense; the service-level FX freshness gate is the
  // primary one (upstream sources update at day grain anyway).
  const limited = rateLimitCheckWithPrune(request, {
    limit: 5,
    prefix: "rates-refresh",
    key: userId,
  });
  if (limited) return limited;

  const settings = await prisma.setting.findUnique({ where: { userId } });
  const baseCurrency = settings?.baseCurrency ?? "USD";

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { currency: true },
    distinct: ["currency"],
  });
  const otherCurrencies = accounts.map((a) => a.currency).filter((c) => c !== baseCurrency);

  const results = await Promise.all([
    refreshExchangeRates(baseCurrency),
    ...otherCurrencies.map((currency) => refreshExchangeRates(currency)),
  ]);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const skippedFresh = results.filter((r) => r.skippedFresh).length;
  // Earliest moment a retry would actually fetch something.
  const nextRefreshAt =
    results
      .map((r) => r.nextRefreshAt)
      .filter((v): v is string => v !== null)
      .sort()[0] ?? null;
  const retryAfterSeconds = nextRefreshAt
    ? Math.max(1, Math.ceil((Date.parse(nextRefreshAt) - Date.now()) / 1000))
    : null;

  // Only bust caches when something actually changed.
  if (totalUpdated > 0) {
    // User-initiated refresh: expire immediately so the next read is fresh.
    revalidateTag("exchange-rates", { expire: 0 });
    revalidateTag("net-worth", { expire: 0 });
    revalidateTag(`net-worth:${userId}`, { expire: 0 });
    revalidateTag(`history:${userId}`, { expire: 0 });
  }
  return ok({
    updated: totalUpdated,
    skippedFresh,
    baseCurrency,
    nextRefreshAt,
    retryAfterSeconds,
  });
});
