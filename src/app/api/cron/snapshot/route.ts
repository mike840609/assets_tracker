import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { ok, failure } from "@/lib/api-responses";
import { CRON_SECRET } from "@/lib/env";
import { log } from "@/lib/logger";

function isAuthorized(request: Request): boolean {
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
      await Promise.all(
        expiredOptions.map((h) =>
          prisma.$transaction([
            prisma.holdingTransaction.create({
              data: {
                holdingId: h.id,
                type: "SELL",
                quantity: Number(h.quantity),
                note: "Expired",
              },
            }),
            prisma.holding.update({
              where: { id: h.id },
              data: { quantity: 0 },
            }),
          ]),
        ),
      );
      revalidateTag("accounts", "max");
    }

    // 1a. Warm the ExchangeRate cache so render paths never need to fetch
    // live rates inline. Refresh in parallel for every source currency in
    // use across users (account.currency, holding.currency, baseCurrency).
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
    await Promise.all([...sourceCurrencies].map((c) => refreshExchangeRates(c)));
    revalidateTag("exchange-rates", "max");
    revalidateTag("net-worth", "max");

    // 1b. Refresh all prices to ensure the snapshot is accurate
    log.info("cron.prices.refresh");
    await refreshAllPrices();
    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    revalidateTag("net-worth", "max");
    revalidateTag("prices", "max");
    revalidateTag("prices:crypto", "max");

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    // 3. Create snapshots for each user (in parallel, isolated so one
    // user's failure — e.g. unresolved exchange rates — doesn't reject
    // snapshots already written for everyone else)
    const results = await Promise.allSettled(
      users.map((user) => {
        const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
        log.info("cron.snapshot.create", { userId: user.id, baseCurrency });
        return createSnapshot(user.id, baseCurrency);
      }),
    );

    const snapshotIds: string[] = [];
    const failures: { userId: string; error: string }[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        snapshotIds.push(result.value.id);
      } else {
        failures.push({ userId: users[i].id, error: String(result.reason) });
        log.error("cron.snapshot.user_failed", {
          userId: users[i].id,
          error: String(result.reason),
        });
      }
    });

    // 4. Invalidate snapshot/history caches now that new rows exist
    revalidateTag("snapshots", "max");
    for (const user of users) {
      revalidateTag(`history:${user.id}`, "max");
    }

    return ok({
      success: failures.length === 0,
      snapshotIds,
      failures,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("cron.snapshot.failed", { error: String(error) });
    return failure("Internal Server Error", 500);
  }
}
