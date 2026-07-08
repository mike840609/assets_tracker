import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { refreshAllPrices } from "@/lib/services/price-service";
import { refreshExchangeRates } from "@/lib/services/exchange-rate-service";
import { materializeDueRecurringTransactions } from "@/lib/services/recurring-cash-service";
import { materializeDueInvestments } from "@/lib/services/recurring-investment-service";
import { ok, failure } from "@/lib/api-responses";
import { CRON_SECRET } from "@/lib/env";
import { log } from "@/lib/logger";
import { finishSnapshotCronCheckIn, startSnapshotCronCheckIn } from "@/lib/sentry-cron";

function hasValidCronSecret(authHeader: string | null): boolean {
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  const actual = Buffer.from(authHeader ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Name used for this cron's CronRun audit rows; E18's /api/health alarm keys on it. */
const CRON_NAME = "snapshot";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!hasValidCronSecret(authHeader)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = new Date();
  const checkIn = startSnapshotCronCheckIn();
  let cronRun: { id: string } | null = null;

  try {
    // E18 — audit trail. Record the run start up front so a crash mid-flight still
    // leaves an `ok: false` row that /api/health can read. Both the success and
    // failure paths below close it out with finishedAt/durationMs.
    cronRun = await prisma.cronRun.create({
      data: { name: CRON_NAME, startedAt, ok: false },
      select: { id: true },
    });

    // 0. Sweep expired option contracts so the snapshot doesn't include them
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let expiredOptionsChanged = false;
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
      expiredOptionsChanged = true;
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
    const ratesUpdated = rateResults.reduce((sum, result) => sum + result.updated, 0);
    const ratesChanged = rateResults.reduce((sum, result) => sum + result.changed, 0);
    log.info("cron.revalidate.gate", {
      pricesUpdated: priceResult.updated,
      pricesChanged: priceResult.changed,
      ratesUpdated,
      ratesChanged,
    });

    // 1b. Materialize due recurring cash transactions (F6) before snapshots, so
    // the day's snapshot reflects the posted cash. This piggybacks on the daily
    // cron — no dedicated cron is added (Free-plan compatible). The catch-up
    // loop inside also covers any days a prior cron run was skipped/failed.
    const recurring = await materializeDueRecurringTransactions();
    if (recurring.rulesProcessed > 0) {
      log.info("cron.recurring.summary", recurring);
    }
    // Recurring investments (DCA) — runs after cash so cash deposits land before
    // they're spent on buys; prices are already refreshed above.
    const investments = await materializeDueInvestments();
    if (investments.rulesProcessed > 0) {
      log.info("cron.investment.summary", investments);
    }
    const recurringChanged = recurring.created > 0 || investments.created > 0;

    // "max" is the cacheComponents revalidation scope required by Next.js 16 cacheComponents: true
    if (ratesChanged > 0) revalidateTag("exchange-rates", "max");
    if (priceResult.changed > 0) {
      revalidateTag("prices", "max");
      revalidateTag("prices:crypto", "max");
    }
    // New recurring cash/buy rows changed balances + holdings → net-worth +
    // accounts must drop even when prices/rates were unchanged (otherwise list
    // pages and the snapshot below would read stale data).
    const structuralChanged = expiredOptionsChanged || recurringChanged;
    if (ratesChanged > 0 || priceResult.changed > 0 || structuralChanged) {
      revalidateTag("net-worth", "max");
    }
    if (structuralChanged) {
      revalidateTag("accounts", "max");
    }

    // 2. Get all users and their settings
    const users = await prisma.user.findMany({
      include: { appSettings: true },
    });

    // 3. Create snapshots for each user (in parallel)
    const snapshotResults = await Promise.allSettled(
      users.map(async (user) => {
        const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
        log.info("cron.snapshot.create", { userId: user.id, baseCurrency });
        const snapshot = await createSnapshot(user.id, baseCurrency);
        return { userId: user.id, snapshot };
      }),
    );
    const snapshots: Awaited<ReturnType<typeof createSnapshot>>[] = [];
    const successfulUserIds: string[] = [];
    const failedUserIds: string[] = [];
    for (let i = 0; i < snapshotResults.length; i++) {
      const result = snapshotResults[i];
      const userId = users[i].id;
      if (result.status === "fulfilled") {
        snapshots.push(result.value.snapshot);
        successfulUserIds.push(result.value.userId);
      } else {
        failedUserIds.push(userId);
        log.warn("cron.snapshot.user_failed", { userId, error: String(result.reason) });
      }
    }
    if (users.length > 0 && failedUserIds.length === users.length) {
      throw new Error(`Snapshot failed for users: ${failedUserIds.join(", ")}`);
    }

    // 4. Invalidate snapshot/history caches now that new rows exist
    if (snapshots.length > 0) revalidateTag("snapshots", "max");
    for (const userId of successfulUserIds) {
      revalidateTag(`history:${userId}`, "max");
    }

    const finishedAt = new Date();
    const snapshotError =
      failedUserIds.length > 0 ? `Snapshot failed for users: ${failedUserIds.join(", ")}` : null;
    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: {
        ok: true,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ...(snapshotError && { error: snapshotError }),
      },
    });
    finishSnapshotCronCheckIn(checkIn, "ok");

    return ok({
      success: true,
      snapshotIds: snapshots.map((s) => s.id),
      failedUserIds,
      timestamp: finishedAt.toISOString(),
    });
  } catch (error) {
    log.error("cron.snapshot.failed", { error: String(error) });
    const finishedAt = new Date();
    // Best-effort: record the failure row before returning. Swallow any error
    // from this write so it can't mask the original failure.
    try {
      if (!cronRun) return failure("Internal Server Error", 500);
      await prisma.cronRun.update({
        where: { id: cronRun.id },
        data: {
          ok: false,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: String(error),
        },
      });
    } catch (auditError) {
      log.error("cron.snapshot.audit_failed", { error: String(auditError) });
    } finally {
      finishSnapshotCronCheckIn(checkIn, "error");
    }
    return failure("Internal Server Error", 500);
  }
}
