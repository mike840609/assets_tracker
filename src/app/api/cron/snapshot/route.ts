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
      await Promise.all(
        expiredOptions.map((h) =>
          prisma.$transaction([
            prisma.holdingTransaction.create({
              data: {
                holdingId: h.id,
                type: "SELL",
                quantity: Number(h.quantity),
                price: 0,
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
    const priceResult = await refreshAllPrices();
    if (priceResult.errors.length > 0) {
      // Snapshots still proceed on cached prices — a stale data point
      // beats a missing one.
      log.warn("cron.prices.refresh_errors", {
        updated: priceResult.updated,
        errors: priceResult.errors,
      });
    }
    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    revalidateTag("net-worth", "max");
    revalidateTag("prices", "max");
    revalidateTag("prices:crypto", "max");

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    type SnapshotUser = (typeof users)[number];

    // 3. Create snapshots for each user (in parallel), isolating failures —
    // one bad user must not cost everyone else their daily snapshot.
    const runSnapshots = async (batch: SnapshotUser[]) => {
      const settled = await Promise.allSettled(
        batch.map((user) => createSnapshot(user.id, user.appSettings?.baseCurrency ?? "USD")),
      );
      const ids: string[] = [];
      const failed: { user: SnapshotUser; reason: unknown }[] = [];
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") ids.push(result.value.id);
        else failed.push({ user: batch[i], reason: result.reason });
      });
      return { ids, failed };
    };

    const first = await runSnapshots(users);
    const snapshotIds = first.ids;
    let failures = first.failed;

    // One in-route retry: the Hobby plan allows a single daily cron, so
    // transient failures (DB hiccup, fetch blip) get their second chance
    // here rather than via a second scheduled run.
    if (failures.length > 0) {
      log.warn("cron.snapshot.retrying", { count: failures.length });
      const retry = await runSnapshots(failures.map((f) => f.user));
      snapshotIds.push(...retry.ids);
      failures = retry.failed;
    }

    const failedUserIds = failures.map((f) => f.user.id);
    for (const f of failures) {
      log.error("cron.snapshot.user_failed", { userId: f.user.id, error: String(f.reason) });
    }

    if (users.length > 0 && snapshotIds.length === 0) {
      // Total failure: 500 so cron monitoring flags the run as failed.
      log.error("cron.snapshot.all_failed", { userCount: users.length });
      return failure("All snapshots failed", 500);
    }

    // 4. Invalidate snapshot/history caches now that new rows exist
    revalidateTag("snapshots", "max");
    for (const user of users) {
      revalidateTag(`history:${user.id}`, "max");
    }

    return ok({
      success: failedUserIds.length === 0,
      snapshotIds,
      ...(failedUserIds.length > 0 && { failedUserIds }),
      priceRefresh: { updated: priceResult.updated, errors: priceResult.errors },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("cron.snapshot.failed", { error: String(error) });
    return failure("Internal Server Error", 500);
  }
}
