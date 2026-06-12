import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { refreshPricesForUser } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { ok } from "@/lib/api-responses";

/**
 * P5 — unified market-data refresh. One function invocation covers what used
 * to be two (POST /api/prices/refresh + POST /api/exchange-rates/refresh):
 * both service calls run in parallel inside a single handler, and the cache
 * invalidation is computed once from the combined result.
 */
export const POST = withAuth(async (request, _ctx, userId) => {
  // Per-user (not per-IP): each call fans out to Yahoo/CoinGecko + the FX
  // source. The service-level freshness gates are the primary defense; this
  // just stops request loops from reaching the DB queries.
  const limited = rateLimitCheckWithPrune(request, {
    limit: 5,
    prefix: "market-refresh",
    key: userId,
  });
  if (limited) return limited;

  // The user's currency universe: settings base currency plus every distinct
  // account currency (rates for both directions resolve via USD cross-rates).
  const [settings, accounts] = await Promise.all([
    prisma.setting.findUnique({ where: { userId } }),
    prisma.account.findMany({
      where: { userId },
      select: { currency: true },
      distinct: ["currency"],
    }),
  ]);
  const baseCurrency = settings?.baseCurrency ?? "USD";
  const otherCurrencies = accounts.map((a) => a.currency).filter((c) => c !== baseCurrency);
  const currencies = [baseCurrency, ...otherCurrencies];

  const [priceResult, rateResults] = await Promise.all([
    refreshPricesForUser(userId),
    Promise.all(currencies.map((currency) => refreshExchangeRates(currency))),
  ]);

  const ratesUpdated = rateResults.reduce((sum, r) => sum + r.updated, 0);
  const ratesSkippedFresh = rateResults.filter((r) => r.skippedFresh).length;
  // Any base whose external fetch failed (vs. skipped-fresh) means the user
  // may be looking at stale conversions — surface it so the client can warn.
  const ratesFetchFailed = rateResults.some((r) => r.fetchFailed);
  // Earliest moment a retry would actually fetch something.
  const ratesNextRefreshAt =
    rateResults
      .map((r) => r.nextRefreshAt)
      .filter((v): v is string => v !== null)
      .sort()[0] ?? null;
  const ratesRetryAfterSeconds = ratesNextRefreshAt
    ? Math.max(1, Math.ceil((Date.parse(ratesNextRefreshAt) - Date.now()) / 1000))
    : null;

  // Only bust caches when something actually changed — a fully-fresh refresh
  // shouldn't force every cached read to recompute. Per the convention in
  // src/app/api/accounts/route.ts: per-user tags expire immediately so this
  // user's next read is fresh; global tags (shared by all users) revalidate
  // with "max" (stale-while-revalidate) to avoid cross-user blocking reads.
  const pricesDirty = priceResult.updated > 0;
  const ratesDirty = ratesUpdated > 0;
  if (pricesDirty) {
    revalidateTag("prices", "max");
    revalidateTag("prices:crypto", "max");
  }
  if (ratesDirty) {
    revalidateTag("exchange-rates", "max");
    revalidateTag(`history:${userId}`, { expire: 0 });
  }
  if (pricesDirty || ratesDirty) {
    revalidateTag("net-worth", "max");
    revalidateTag(`net-worth:${userId}`, { expire: 0 });
    // Account-detail reads are keyed by this tag — see PR #414.
    revalidateTag(`accounts:${userId}`, { expire: 0 });
  }

  return ok({
    prices: {
      updated: priceResult.updated,
      skippedFresh: priceResult.skippedFresh,
      retryAfterSeconds: priceResult.retryAfterSeconds,
    },
    rates: {
      updated: ratesUpdated,
      skippedFresh: ratesSkippedFresh,
      retryAfterSeconds: ratesRetryAfterSeconds,
      fetchFailed: ratesFetchFailed,
    },
  });
});
