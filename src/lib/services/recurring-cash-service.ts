import "server-only";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type { RecurringFrequency } from "@/generated/prisma/client";

/**
 * Recurring cash transactions (F6).
 *
 * Rules are materialized into `CashTransaction` rows by the existing daily
 * snapshot cron (`/api/cron/snapshot`) — **no dedicated cron is added**, which
 * keeps the feature compatible with Vercel's Free-plan one-cron limit. The
 * cron calls {@link materializeDueRecurringTransactions} once per run; the
 * catch-up loop posts every occurrence whose date has arrived since the last
 * successful run, so a skipped/failed cron day self-heals on the next run.
 *
 * All date math is in UTC and operates on calendar days only — `@db.Date`
 * columns come back as UTC-midnight `Date`s, and occurrences post at the cron's
 * run time (the `createdAt` is backdated to the occurrence day so history
 * groups them on the correct calendar date).
 */

/** Floors a Date to UTC midnight (calendar-day granularity). */
export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const next = utcDateOnly(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of `monthIndex`.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds whole months while anchoring to `anchorDay` (the rule's start day-of-
 * month), clamping to the target month's length. Anchoring to the start day —
 * rather than repeatedly clamping the running cursor — prevents drift, so a
 * rule starting Jan 31 fires Feb 28 → Mar 31 (not Mar 28).
 */
function addMonthsAnchored(d: Date, months: number, anchorDay: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const monthIndex = total % 12;
  const day = Math.min(anchorDay, daysInUtcMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Returns the next occurrence date after `current` for the given frequency. */
export function advanceRecurringDate(
  current: Date,
  frequency: RecurringFrequency,
  anchorDay: number,
): Date {
  switch (frequency) {
    case "WEEKLY":
      return addUtcDays(current, 7);
    case "BIWEEKLY":
      return addUtcDays(current, 14);
    case "MONTHLY":
      return addMonthsAnchored(current, 1, anchorDay);
    case "QUARTERLY":
      return addMonthsAnchored(current, 3, anchorDay);
    case "ANNUAL":
      return addMonthsAnchored(current, 12, anchorDay);
  }
}

/**
 * Computes every occurrence due on or before `today` (catch-up), starting from
 * `nextRunDate`, bounded by `endDate`. Returns the occurrences plus the new
 * `nextRunDate` (the first date beyond what was produced) to persist back.
 *
 * `maxOccurrences` is a safety bound against a pathological backlog (e.g. a
 * weekly rule backdated years) blowing up a single cron run; the remainder is
 * picked up on subsequent runs since `nextRunDate` advances each time.
 */
export function computeDueOccurrences(
  rule: {
    nextRunDate: Date;
    startDate: Date;
    endDate: Date | null;
    frequency: RecurringFrequency;
  },
  today: Date,
  maxOccurrences = 1000,
): { occurrences: Date[]; nextRunDate: Date } {
  const anchorDay = utcDateOnly(rule.startDate).getUTCDate();
  const end = rule.endDate ? utcDateOnly(rule.endDate) : null;
  const todayUtc = utcDateOnly(today);
  let cursor = utcDateOnly(rule.nextRunDate);
  const occurrences: Date[] = [];

  while (
    cursor.getTime() <= todayUtc.getTime() &&
    (!end || cursor.getTime() <= end.getTime()) &&
    occurrences.length < maxOccurrences
  ) {
    occurrences.push(cursor);
    cursor = advanceRecurringDate(cursor, rule.frequency, anchorDay);
  }

  return { occurrences, nextRunDate: cursor };
}

/**
 * Materializes all due recurring rules into CashTransaction rows and advances
 * each rule's `nextRunDate`. Called by the daily snapshot cron before snapshots
 * are computed, so the day's snapshot reflects the new balances.
 *
 * Per rule, the row inserts, the balance increment, and the `nextRunDate`
 * advance happen in one interactive `$transaction`, so a crash can't leave a
 * balance/ledger mismatch. The `(recurringId, occurrenceDate)` unique index is
 * defense-in-depth against a concurrent double-run; the balance is incremented
 * by the number of rows *actually inserted* (`createMany().count`), so even a
 * partial skip stays consistent. A single failing rule is logged and skipped so
 * it can't abort the rest of the sweep.
 */
export async function materializeDueRecurringTransactions(
  now: Date = new Date(),
): Promise<{ created: number; rulesProcessed: number }> {
  const today = utcDateOnly(now);
  const dueRules = await prisma.recurringCashTransaction.findMany({
    where: { isActive: true, nextRunDate: { lte: today } },
  });

  let created = 0;
  for (const rule of dueRules) {
    const { occurrences, nextRunDate } = computeDueOccurrences(rule, today);
    const endUtc = rule.endDate ? utcDateOnly(rule.endDate) : null;
    const stillActive = !endUtc || nextRunDate.getTime() <= endUtc.getTime();

    // Expired rule that was still flagged active (e.g. endDate < nextRunDate):
    // nothing to post, just advance + deactivate.
    if (occurrences.length === 0) {
      await prisma.recurringCashTransaction.update({
        where: { id: rule.id },
        data: { nextRunDate, isActive: stillActive },
      });
      continue;
    }

    const signedUnit =
      rule.type === "WITHDRAWAL" ? new Decimal(rule.amount).negated() : new Decimal(rule.amount);

    try {
      const inserted = await prisma.$transaction(async (tx) => {
        const res = await tx.cashTransaction.createMany({
          data: occurrences.map((d) => ({
            accountId: rule.accountId,
            type: rule.type,
            amount: rule.amount,
            note: rule.note,
            recurringId: rule.id,
            occurrenceDate: d,
            // Backdate so the row groups under its occurrence day in history.
            createdAt: d,
          })),
          skipDuplicates: true,
        });
        if (res.count > 0) {
          await tx.account.update({
            where: { id: rule.accountId },
            data: { cashBalance: { increment: signedUnit.times(res.count) } },
          });
        }
        await tx.recurringCashTransaction.update({
          where: { id: rule.id },
          data: { nextRunDate, isActive: stillActive },
        });
        return res.count;
      });
      created += inserted;
      log.info("cron.recurring.materialize", {
        ruleId: rule.id,
        accountId: rule.accountId,
        posted: inserted,
      });
    } catch (error) {
      log.error("cron.recurring.materialize_failed", {
        ruleId: rule.id,
        error: String(error),
      });
    }
  }

  return { created, rulesProcessed: dueRules.length };
}

/** Lists an account's recurring rules (newest first). */
export function listRecurringForAccount(accountId: string) {
  return prisma.recurringCashTransaction.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
}
