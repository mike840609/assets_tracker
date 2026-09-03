import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSnapshot } from "@/lib/services/snapshot-service";
import { fetchStockPrices, refreshAllPrices } from "@/lib/services/price-service";
import {
  getFreshExchangeRates,
  refreshExchangeRates,
  resolveRate,
} from "@/lib/services/exchange-rate-service";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { loadNetWorthInputsForUsers } from "@/lib/services/net-worth-service";
import { materializeDueRecurringTransactions } from "@/lib/services/recurring-cash-service";
import { materializeDueInvestments } from "@/lib/services/recurring-investment-service";
import { taiwanCalendarDay } from "@/lib/app-day";
import { chunk, mapSettled } from "@/lib/batch";
import { ok, failure } from "@/lib/api-responses";
import { CRON_SECRET } from "@/lib/env";
import { log } from "@/lib/logger";
import { finishSnapshotCronCheckIn, startSnapshotCronCheckIn } from "@/lib/sentry-cron";
import { cleanupExpiredDemoUsers } from "@/lib/demo/demo-service";
import {
  DEMO_CLEANUP_BATCH_SIZE,
  DEMO_CLEANUP_BUDGET_MS,
  DEMO_CLEANUP_MAX_USERS,
} from "@/lib/demo/demo-policy";

function hasValidCronSecret(authHeader: string | null): boolean {
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  const actual = Buffer.from(authHeader ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Name used for this cron's CronRun audit rows; E18's /api/health alarm keys on it. */
const CRON_NAME = "snapshot";

// Fan-out bounds for the sweep (#641). Each is a ceiling, not a target: a small
// instance never reaches them, so nothing gets slower until the point where the
// unbounded version would have fallen over.
// ponytail: fixed numbers, not config — tune here if a real instance outgrows
// them rather than adding env plumbing nobody sets.
/** Concurrent external FX round-trips. Low: the source throttles by IP. */
const RATE_REFRESH_CONCURRENCY = 5;
/** Concurrent snapshot upserts. Bounds writes against the Neon pool. */
const SNAPSHOT_CONCURRENCY = 10;
/** Users whose accounts/holdings are held in memory at once. */
const USER_PAGE_SIZE = 200;
/** Stop scheduling work before Vercel's 60 s hard kill so audit writes can finish. */
const SNAPSHOT_BUDGET_MS = 50_000;

/**
 * Business-day distance at which an expired contract may still be settled
 * automatically. `businessDay` and `Holding.expiration` are both UTC-midnight
 * dates, so exactly one day apart means this run is the first sweep after
 * expiry — see the settlement comment below.
 */
const EXPIRY_SETTLEMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!hasValidCronSecret(authHeader)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = new Date();
  const businessDay = taiwanCalendarDay(startedAt);
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

    try {
      const cleanup = await cleanupExpiredDemoUsers({
        now: startedAt,
        batchSize: DEMO_CLEANUP_BATCH_SIZE,
        maxUsers: DEMO_CLEANUP_MAX_USERS,
        budgetMs: DEMO_CLEANUP_BUDGET_MS,
      });
      log.info("cron.public_demo.cleanup", {
        deleted: cleanup.deleted,
        budgetExhausted: cleanup.budgetExhausted,
      });
    } catch (error) {
      log.warn("cron.public_demo.cleanup_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    // 0. Sweep contracts that expired before this run's Taiwan business day so
    // the snapshot does not carry yesterday's options into today's valuation.
    // A contract expiring on businessDay remains active through that day.
    //
    // #732 — settlement value comes from the expiration-day close of the
    // UNDERLYING and the contract's intrinsic value (`max(S-K, 0)` for a call,
    // `max(K-S, 0)` for a put), never from the option's own cached premium. An
    // in-the-money contract is exercised or assigned at expiry, so zeroing it
    // with no counter-entry made its intrinsic value vanish from net worth
    // overnight with no user action; but the option's `PriceCache` row is not a
    // trustworthy source for that value. The sweep runs before the price
    // refresh, so for a Friday-expiring US contract the Saturday-Taipei run
    // reads whatever the PREVIOUS cycle stored — Thursday's premium. A contract
    // worth $1 on Thursday that expired worthless on Friday would then credit
    // $100/contract of cash that never existed. Intrinsic value cannot drift
    // that way: it is a function of the underlying's close and the strike.
    //
    // Auto-exercise into the underlying shares is deliberately NOT modelled: it
    // would mint share lots the user never confirmed, at a cost basis nobody
    // chose. Cash equal to the intrinsic value is the closest faithful summary.
    //
    // Trustworthiness gate: settle only when `businessDay - expiration` is
    // exactly one day. `taiwanCalendarDay(21:30 UTC on day D) === D+1`, and
    // that run happens after day D's US close (20:00 UTC EDT / 21:00 UTC EST),
    // so a diff of exactly one day means this is the first sweep after expiry
    // and the live quote below IS the expiration-day close. A larger diff means
    // a cron cycle was missed and the underlying has traded since — the
    // expiration-day price can no longer be established, so the contract is
    // left for the user to close manually.
    //
    // Deferral (a deliberate change from the always-zero behaviour that shipped
    // before): when the gate fails, the underlying quote is missing, the quote
    // is denominated in a different currency than the option (strike and spot
    // must agree), or the FX pair to the account is unresolvable, the holding is
    // left COMPLETELY untouched — no zeroing, no SELL, no cash. The position
    // stays visible so the user can settle it by hand, and each skip is logged
    // with its reason. Only a contract whose expiration-day intrinsic value is
    // genuinely 0 is written off as worthless.
    let expiredOptionsChanged = false;
    const expiredOptions = await prisma.holding.findMany({
      where: {
        assetType: "OPTION",
        expiration: { lt: businessDay },
        quantity: { gt: 0 },
        account: { user: { demoWorkspace: null } },
      },
      include: { account: { select: { id: true, currency: true } } },
    });
    if (expiredOptions.length > 0) {
      log.info("cron.options.expire", { count: expiredOptions.length });
      const underlyingSymbols = [
        ...new Set(
          expiredOptions
            .map((h) => h.underlyingSymbol)
            .filter((symbol): symbol is string => Boolean(symbol)),
        ),
      ];
      // Both reads are bulk and happen once for the whole sweep. The quotes are
      // fetched LIVE rather than read from PriceCache (see above); a provider
      // failure yields no quotes, which defers every contract instead of
      // aborting the run. The FX map is read straight from the DB: the cron's
      // cache tags are stale-while-revalidate, so a cached read could hand back
      // the previous cycle's rates.
      const emptyQuotes = new Map<string, { price: number; currency: string }>();
      const [underlyingQuotes, sweepRates] = await Promise.all([
        underlyingSymbols.length > 0
          ? fetchStockPrices(underlyingSymbols).catch((error: unknown) => {
              log.warn("cron.options.expire_quotes_failed", { error: String(error) });
              return emptyQuotes;
            })
          : Promise.resolve(emptyQuotes),
        getFreshExchangeRates(),
      ]);
      for (const h of expiredOptions) {
        const defer = (reason: string) =>
          log.warn("cron.options.expire_deferred", { symbol: h.symbol, reason });
        if (
          h.expiration === null ||
          businessDay.getTime() - h.expiration.getTime() !== EXPIRY_SETTLEMENT_WINDOW_MS
        ) {
          defer("expiry_window");
          continue;
        }
        // Imported rows can lack the OCC fields the POST route derives, and
        // intrinsic value is undefined without them.
        if (!h.underlyingSymbol || !h.optionType || h.strike === null) {
          defer("missing_option_terms");
          continue;
        }
        const quote = underlyingQuotes.get(h.underlyingSymbol);
        if (quote === undefined) {
          defer("underlying_unavailable");
          continue;
        }
        // Spot and strike must be the same unit before they are subtracted.
        if (quote.currency !== h.currency) {
          defer("underlying_currency_mismatch");
          continue;
        }
        const rate = resolveRate(sweepRates, h.currency, h.account.currency);
        if (rate === undefined) {
          defer("rate_unresolved");
          continue;
        }
        const spot = new Decimal(quote.price);
        const strike = new Decimal(h.strike);
        const moneyness = h.optionType === "CALL" ? spot.sub(strike) : strike.sub(spot);
        // gt(0), not isPositive(): decimal.js reports positive-zero as positive.
        const intrinsic = moneyness.gt(0) ? moneyness : new Decimal(0);
        // unitPrice is the per-share intrinsic value, the same convention as
        // manual option transactions — the cost-basis path multiplies it by the
        // contract multiplier itself. It stays null (never 0) for a worthless
        // contract: importHoldingTransactionUnitPrice rejects a non-null
        // unitPrice <= 0, so a stored 0 would make backups unimportable.
        let unitPrice: Decimal | null = null;
        let cashCredit: Decimal | null = null;
        if (intrinsic.gt(0)) {
          // Legacy rows may predate server-derived multipliers; the OCC
          // standard 100 is assumed, same fallback as net-worth-service.
          const multiplier = h.contractMultiplier ?? 100;
          unitPrice = intrinsic.toDecimalPlaces(8);
          // Decimal throughout, snapped to the Decimal(28, 8) column scale —
          // float noise must never reach cashBalance (see toDbMoneyDelta).
          cashCredit = intrinsic.mul(h.quantity).mul(multiplier).mul(rate).toDecimalPlaces(8);
        }
        // Guard the zeroing on the quantity we read: if the user traded this
        // contract between the read and the write, skip it (it is re-checked
        // on the next run) instead of minting a SELL for a stale quantity.
        await prisma.$transaction(async (tx) => {
          const res = await tx.holding.updateMany({
            where: { id: h.id, quantity: h.quantity },
            data: { quantity: 0 },
          });
          if (res.count === 1) {
            await tx.holdingTransaction.create({
              data: {
                holdingId: h.id,
                type: "SELL",
                quantity: h.quantity,
                note: "Expired",
                ...(unitPrice !== null && { unitPrice }),
              },
            });
            // Only ever inside the guarded branch: cash must not move for a
            // contract this run did not actually close.
            if (cashCredit !== null) {
              await tx.account.update({
                where: { id: h.account.id },
                data: { cashBalance: { increment: cashCredit } },
              });
            }
            expiredOptionsChanged = true;
          }
        });
      }
    }

    // 1. Warm the ExchangeRate cache (so render paths never need to fetch
    // live rates inline) and refresh all prices, in parallel. Rates cover
    // every source currency in use across users (account.currency,
    // holding.currency, baseCurrency). The two refreshes hit independent
    // external APIs (FX providers vs Yahoo/CoinGecko) and neither reads the
    // other's output, so overlapping them buys headroom under maxDuration.
    const [accountCurrencies, holdingCurrencies, settings] = await Promise.all([
      prisma.account.findMany({
        where: { user: { demoWorkspace: null } },
        select: { currency: true },
        distinct: ["currency"],
      }),
      prisma.holding.findMany({
        where: { account: { user: { demoWorkspace: null } } },
        select: { currency: true },
        distinct: ["currency"],
      }),
      prisma.setting.findMany({
        where: { user: { demoWorkspace: null } },
        select: { baseCurrency: true },
        distinct: ["baseCurrency"],
      }),
    ]);
    const sourceCurrencies = new Set<string>(["USD"]);
    for (const row of accountCurrencies) sourceCurrencies.add(row.currency);
    for (const row of holdingCurrencies) if (row.currency) sourceCurrencies.add(row.currency);
    for (const row of settings) sourceCurrencies.add(row.baseCurrency);
    log.info("cron.rates.refresh", { count: sourceCurrencies.size });
    log.info("cron.prices.refresh");
    // force: snapshots must be computed from current rates; the manual-refresh
    // freshness gate doesn't apply to the cron.
    //
    // Bounded concurrency (#641): every currency here is an external FX
    // round-trip, and the count grows with the instance. Firing them all at once
    // is what gets the source IP throttled, and a throttled source is worse than
    // a slightly longer sweep — each call is capped at RATE_FETCH_TIMEOUT_MS, so
    // the wall-clock cost of waves is bounded and small. Settled rather than
    // all-or-nothing so one currency's failure can't abort the whole run.
    const [rateSettled, priceResult] = await Promise.all([
      mapSettled([...sourceCurrencies], RATE_REFRESH_CONCURRENCY, (c) =>
        refreshExchangeRates(c, { force: true }),
      ),
      refreshAllPrices(),
    ]);
    const rateResults = rateSettled.flatMap((result) => {
      if (result.status === "fulfilled") return [result.value];
      log.warn("cron.rates.currency_failed", { error: String(result.reason) });
      return [];
    });
    const ratesUpdated = rateResults.reduce((sum, result) => sum + result.updated, 0);
    const ratesChanged = rateResults.reduce((sum, result) => sum + result.changed, 0);
    log.info("cron.revalidate.gate", {
      pricesUpdated: priceResult.updated,
      pricesChanged: priceResult.changed,
      ratesUpdated,
      ratesChanged,
    });
    // A total refresh failure means every snapshot below would be calculated
    // from stale PriceCache rows. Abort before any snapshot write so neither the
    // CronRun audit nor /api/health can mistake stale valuations for success.
    if (priceResult.outcome === "total_failure") {
      const details = priceResult.errors.join(" | ") || "no usable prices returned";
      log.error("cron.prices.refresh_failed", { errors: priceResult.errors });
      throw new Error(`Price refresh failed: ${details}`);
    }

    // 1b. Materialize due recurring cash transactions (F6) before snapshots, so
    // the day's snapshot reflects the posted cash. This piggybacks on the daily
    // cron — no dedicated cron is added (Free-plan compatible). The catch-up
    // loop inside also covers any days a prior cron run was skipped/failed.
    // Materialize against the TAIWAN business day so a rule due "today"
    // (Taipei) posts in the same run whose snapshot is stamped with that day —
    // at 21:30 UTC the raw UTC day is still yesterday in Taipei.
    const recurring = await materializeDueRecurringTransactions(businessDay);
    if (recurring.rulesProcessed > 0) {
      log.info("cron.recurring.summary", recurring);
    }
    // Recurring investments (DCA) — runs after cash so cash deposits land before
    // they're spent on buys; prices are already refreshed above.
    const investments = await materializeDueInvestments(businessDay);
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

    // 2. Snapshot users page by page.
    //
    // All reads are bulk (#641): the FX map is global so it is loaded once for
    // the whole run, and each page of users costs one accounts+holdings query
    // plus one price query — not three queries per user, unbounded in flight,
    // which exhausted the connection pool and the 60 s budget as the instance
    // grew. Paging also bounds how many users' holdings are held in memory.
    //
    // Everything here reads directly, never through a cached reader. The tag
    // bumps above are stale-while-revalidate ("max"), so a cached net-worth read
    // would persist the PREVIOUS cycle's prices/FX/balances and shift the whole
    // history one day (#640).
    const ratesMap = await getFreshExchangeRates();
    const snapshots: Awaited<ReturnType<typeof createSnapshot>>[] = [];
    const successfulUserIds: string[] = [];
    const failedUserIds: string[] = [];
    let usersDiscovered = 0;
    let userCursor: string | undefined;
    let budgetExhausted = false;

    while (true) {
      if (Date.now() - startedAt.getTime() >= SNAPSHOT_BUDGET_MS) {
        budgetExhausted = true;
        break;
      }
      const page = await prisma.user.findMany({
        where: { demoWorkspace: null },
        select: { id: true, appSettings: { select: { baseCurrency: true } } },
        orderBy: { id: "asc" },
        take: USER_PAGE_SIZE,
        ...(userCursor && { cursor: { id: userCursor }, skip: 1 }),
      });
      if (page.length === 0) break;
      usersDiscovered += page.length;

      const inputs = await loadNetWorthInputsForUsers(
        page.map((user) => user.id),
        ratesMap,
      );

      // Only the upsert is left per user. Fixed waves bound concurrent writes
      // and give the wall-clock guard a chance to stop between waves.
      for (const wave of chunk(page, SNAPSHOT_CONCURRENCY)) {
        if (Date.now() - startedAt.getTime() >= SNAPSHOT_BUDGET_MS) {
          budgetExhausted = true;
          break;
        }
        const waveResults = await mapSettled(wave, SNAPSHOT_CONCURRENCY, async (user) => {
          const baseCurrency = user.appSettings?.baseCurrency ?? "USD";
          const snapshot = await createSnapshot(user.id, baseCurrency, {
            fresh: true,
            preloaded: inputs.get(user.id),
            businessDay,
          });
          return { userId: user.id, snapshot };
        });

        for (let i = 0; i < waveResults.length; i++) {
          const result = waveResults[i];
          if (result.status === "fulfilled") {
            snapshots.push(result.value.snapshot);
            successfulUserIds.push(result.value.userId);
          } else {
            failedUserIds.push(wave[i].id);
            log.warn("cron.snapshot.user_failed", {
              userId: wave[i].id,
              error: String(result.reason),
            });
          }
        }
      }
      if (budgetExhausted) break;
      if (page.length < USER_PAGE_SIZE) break;
      userCursor = page[page.length - 1].id;
    }
    log.info("cron.snapshot.summary", {
      users: usersDiscovered,
      created: snapshots.length,
      failed: failedUserIds.length,
      budgetExhausted,
    });
    if (!budgetExhausted && usersDiscovered > 0 && failedUserIds.length === usersDiscovered) {
      throw new Error(`Snapshot failed for users: ${failedUserIds.join(", ")}`);
    }

    // 4. Invalidate snapshot/history caches now that new rows exist
    if (snapshots.length > 0) revalidateTag("snapshots", "max");
    for (const userId of successfulUserIds) {
      revalidateTag(`history:${userId}`, "max");
    }

    const finishedAt = new Date();
    const processedUsers = successfulUserIds.length + failedUserIds.length;
    const snapshotError = budgetExhausted
      ? `Snapshot budget exhausted after processing ${processedUsers} of at least ${usersDiscovered} users`
      : failedUserIds.length > 0
        ? `Snapshot failed for users: ${failedUserIds.join(", ")}`
        : null;
    const partiallyFailed = failedUserIds.length > 0;
    await prisma.cronRun.update({
      where: { id: cronRun.id },
      data: {
        ok: !budgetExhausted && !partiallyFailed,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ...(snapshotError && { error: snapshotError }),
      },
    });
    finishSnapshotCronCheckIn(checkIn, budgetExhausted || partiallyFailed ? "error" : "ok");

    if (budgetExhausted) {
      return failure(snapshotError ?? "Snapshot budget exhausted", 503);
    }
    const result = {
      success: !partiallyFailed,
      snapshotIds: snapshots.map((s) => s.id),
      failedUserIds,
      timestamp: finishedAt.toISOString(),
    };
    return partiallyFailed
      ? Response.json(
          {
            error: { message: "Snapshot partially completed" },
            data: result,
          },
          { status: 503 },
        )
      : ok({
          success: true,
          snapshotIds: result.snapshotIds,
          failedUserIds,
          timestamp: result.timestamp,
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
