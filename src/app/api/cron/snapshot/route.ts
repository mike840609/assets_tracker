import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { ok, failure } from "@/lib/api-responses";
import { CRON_SECRET } from "@/lib/env";
import { log } from "@/lib/logger";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 0. Sweep expired option contracts so the snapshot doesn't include them
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expiredOptions = await prisma.holding.findMany({
      where: {
        assetType: "OPTION",
        expiration: { lt: today },
        quantity: { gt: 0 },
      },
    });
    if (expiredOptions.length > 0) {
      log.info("cron.options.expire", { count: expiredOptions.length });
      await prisma.$transaction([
        prisma.holdingTransaction.createMany({
          data: expiredOptions.map((h) => ({
            holdingId: h.id,
            type: "SELL" as const,
            quantity: Number(h.quantity),
            note: "Expired",
          })),
        }),
        prisma.holding.updateMany({
          where: { id: { in: expiredOptions.map((h) => h.id) } },
          data: { quantity: 0 },
        }),
      ]);
      revalidateTag("accounts", "max");
    }

    // 1. Warm the ExchangeRate cache (so render paths never need to fetch
    // live rates inline) and refresh all prices, in parallel. Rates cover
    // every source currency in use across users (account.currency,
    // holding.currency, baseCurrency). The two refreshes hit independent
    // external APIs (FX providers vs Yahoo/CoinGecko) and neither reads the
    // other's output, so overlapping them buys headroom under maxDuration.
    const [accountCurrencies, holdingCurrencies, settings] = await Promise.all([
      prisma.account.findMany({ select: { currency: true }, distinct: ["currency"] }),
      prisma.holding.findMany({ select: { currency: true }, distinct: ["currency"] }),
      prisma.setting.findMany({ select: { baseCurrency: true }, distinct: ["baseCurrency"] }),
    ]);
    const sourceCurrencies = new Set<string>(["USD"]);
    for (const row of accountCurrencies) sourceCurrencies.add(row.currency);
    for (const row of holdingCurrencies) if (row.currency) sourceCurrencies.add(row.currency);
    for (const row of settings) sourceCurrencies.add(row.baseCurrency);
    log.info("cron.rates.refresh", { count: sourceCurrencies.size });
    log.info("cron.prices.refresh");
    // force: snapshots must be computed from current rates; the manual-refresh
    // freshness gate doesn't apply to the cron.
    const [rateResults, priceResult] = await Promise.all([
      Promise.all([...sourceCurrencies].map((c) => refreshExchangeRates(c, { force: true }))),
      refreshAllPrices(),
    ]);

    // Gate the global cache revalidations on actual value changes (P6): the
    // forced refreshes above rewrite rows even when every value is identical
    // (weekends/holidays), so `updated` is nearly always > 0 — only evict the
    // warm caches when a price or rate really moved.
    const ratesChanged = rateResults.reduce((sum, r) => sum + r.changed, 0);
    const pricesChanged = priceResult.changed;
    log.info("cron.revalidate.gate", { ratesChanged, pricesChanged });
    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    if (ratesChanged > 0) {
      revalidateTag("exchange-rates", "max");
    }
    if (pricesChanged > 0) {
      revalidateTag("prices", "max");
      revalidateTag("prices:crypto", "max");
    }
    if (ratesChanged > 0 || pricesChanged > 0) {
      revalidateTag("net-worth", "max");
    }

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    // 3. Create snapshots for each user (in parallel)
    const snapshots = await Promise.all(
      users.map((user) => {
        const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
        log.info("cron.snapshot.create", { userId: user.id, baseCurrency });
        return createSnapshot(user.id, baseCurrency);
      }),
    );

    // 4. Invalidate snapshot/history caches now that new rows exist
    revalidateTag("snapshots", "max");
    for (const user of users) {
      revalidateTag(`history:${user.id}`, "max");
    }

    return ok({
      success: true,
      snapshotIds: snapshots.map((s) => s.id),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("cron.snapshot.failed", { error: String(error) });
    return failure("Internal Server Error", 500);
  }
}
