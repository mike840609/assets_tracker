import "server-only";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { computeDueOccurrences, utcDateOnly } from "./recurring-cash-service";
import { resolveRate } from "./exchange-rate-service";
import { fetchStockPrices, fetchCryptoPrices } from "./price-service";

/**
 * Recurring investments (F6 — dollar-cost averaging).
 *
 * A rule invests a fixed `amount` (in the account's currency) into `symbol`
 * every period. The same daily snapshot cron materializes due rules — **no new
 * cron** — by converting the amount to shares at the run-time price, posting a
 * BUY `HoldingTransaction`, incrementing the holding quantity, and debiting the
 * account's cash balance. The catch-up loop + `(recurringId, occurrenceDate)`
 * unique index mirror the cash-recurring design (see `recurring-cash-service`).
 *
 * Known limitation: catch-up occurrences for missed cron days are priced at the
 * *current* price, not the historical price of each occurrence day. Under
 * normal daily operation each occurrence is same-day, so this only affects
 * recovery after a cron outage.
 *
 * Price and FX are read DIRECTLY from the DB here (not via the cached
 * `getCachedPricesForSymbols` / `getAllExchangeRates`): the cron writes fresh
 * prices/rates just before this runs but only revalidates the `prices` /
 * `exchange-rates` cache tags afterward, so the cached readers would return
 * pre-refresh values and the buys would use stale price/FX.
 */

/** Loads all exchange rates straight from the DB as a "FROM_TO" → rate map. */
async function loadFreshRateMap(): Promise<Map<string, number>> {
  const rows = await prisma.exchangeRate.findMany({
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.fromCurrency}_${r.toCurrency}`, Number(r.rate));
  return map;
}

/** Resolves a usable market price (value + currency) for the rule's symbol. */
async function resolvePrice(
  symbol: string,
  assetType: string,
): Promise<{ price: number; currency: string } | null> {
  // Direct read (see file header) so a freshly-refreshed price isn't masked by
  // the still-stale `prices` cache during the cron run.
  const cached = await prisma.priceCache.findUnique({
    where: { symbol },
    select: { price: true, currency: true },
  });
  if (cached && Number(cached.price) > 0) {
    return { price: Number(cached.price), currency: cached.currency };
  }
  // Brand-new symbol with no holding yet won't be in PriceCache (the cron only
  // refreshes held symbols), so fetch + cache it here.
  try {
    const fetched =
      assetType === "CRYPTO" ? await fetchCryptoPrices([symbol]) : await fetchStockPrices([symbol]);
    const result = fetched.get(symbol);
    if (!result || !(result.price > 0)) return null;
    await prisma.priceCache.upsert({
      where: { symbol },
      update: { price: result.price, currency: result.currency, updatedAt: new Date() },
      create: { symbol, price: result.price, currency: result.currency },
    });
    return { price: result.price, currency: result.currency };
  } catch (error) {
    log.error("cron.investment.price_failed", { symbol, error: String(error) });
    return null;
  }
}

/**
 * Materializes all due recurring investment rules. For each due rule: posts a
 * BUY for the shares bought with `amount` of cash, increments the holding (auto-
 * creating it if needed), and debits the account's cash — all in one atomic
 * `$transaction`. Balance/quantity are scaled by the number of rows actually
 * inserted (`createMany().count`) so an idempotent skip can't double-apply.
 */
export async function materializeDueInvestments(
  now: Date = new Date(),
): Promise<{ created: number; rulesProcessed: number }> {
  const today = utcDateOnly(now);
  const dueRules = await prisma.recurringInvestment.findMany({
    where: { isActive: true, nextRunDate: { lte: today } },
    include: { account: { select: { currency: true } } },
  });
  if (dueRules.length === 0) return { created: 0, rulesProcessed: 0 };

  const rateMap = await loadFreshRateMap();
  let created = 0;

  for (const rule of dueRules) {
    const { occurrences, nextRunDate } = computeDueOccurrences(rule, today);
    const endUtc = rule.endDate ? utcDateOnly(rule.endDate) : null;
    const stillActive = !endUtc || nextRunDate.getTime() <= endUtc.getTime();

    if (occurrences.length === 0) {
      await prisma.recurringInvestment.update({
        where: { id: rule.id },
        data: { nextRunDate, isActive: stillActive },
      });
      continue;
    }

    const priced = await resolvePrice(rule.symbol, rule.assetType);
    if (!priced) {
      // No price available — leave nextRunDate untouched so it retries next run
      // rather than silently posting nothing and advancing past the occurrence.
      log.warn("cron.investment.skip_no_price", { ruleId: rule.id, symbol: rule.symbol });
      continue;
    }

    // amount is in account currency; convert to the price's currency for shares.
    const accountCurrency = rule.account.currency;
    const fxRate = resolveRate(rateMap, accountCurrency, priced.currency);
    if (fxRate === undefined) {
      // Cross-currency rate is genuinely unresolvable (same-currency returns 1).
      // Skip rather than silently assume 1, which would mint a wildly wrong
      // share count and debit cash for a position that's off by the FX factor.
      // nextRunDate is left untouched so it retries once the rate is warmed.
      log.warn("cron.investment.skip_no_rate", {
        ruleId: rule.id,
        from: accountCurrency,
        to: priced.currency,
      });
      continue;
    }
    const amountInPriceCcy = new Decimal(rule.amount).times(fxRate);
    const sharesPerOccurrence = amountInPriceCcy.div(priced.price);

    try {
      const inserted = await prisma.$transaction(async (tx) => {
        // Ensure the target holding exists (auto-create on first run).
        const holding = await tx.holding.upsert({
          where: { accountId_symbol: { accountId: rule.accountId, symbol: rule.symbol } },
          update: {},
          create: {
            accountId: rule.accountId,
            symbol: rule.symbol,
            name: rule.name,
            assetType: rule.assetType,
            currency: priced.currency,
            quantity: 0,
          },
          select: { id: true },
        });

        const res = await tx.holdingTransaction.createMany({
          data: occurrences.map((d) => ({
            holdingId: holding.id,
            type: "BUY" as const,
            quantity: sharesPerOccurrence,
            note: rule.note,
            recurringId: rule.id,
            occurrenceDate: d,
            createdAt: d,
          })),
          skipDuplicates: true,
        });

        if (res.count > 0) {
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: { increment: sharesPerOccurrence.times(res.count) } },
          });
          // Debit the cash that funded the buys, in the account's currency.
          await tx.account.update({
            where: { id: rule.accountId },
            data: { cashBalance: { decrement: new Decimal(rule.amount).times(res.count) } },
          });
        }

        await tx.recurringInvestment.update({
          where: { id: rule.id },
          data: { nextRunDate, isActive: stillActive },
        });
        return res.count;
      });
      created += inserted;
      log.info("cron.investment.materialize", {
        ruleId: rule.id,
        symbol: rule.symbol,
        posted: inserted,
      });
    } catch (error) {
      log.error("cron.investment.materialize_failed", { ruleId: rule.id, error: String(error) });
    }
  }

  return { created, rulesProcessed: dueRules.length };
}

/** Lists an account's recurring investment rules (newest first). */
export function listInvestmentsForAccount(accountId: string) {
  return prisma.recurringInvestment.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
}
