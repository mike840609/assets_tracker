import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { updateRecurringCashTransactionSchema } from "@/lib/validators";
import { serializeRecurringCashTransaction } from "@/lib/types";
import {
  firstOccurrenceOnOrAfter,
  materializeDueRecurringTransactions,
} from "@/lib/services/recurring-cash-service";
import { taiwanCalendarDay } from "@/lib/app-day";
import { log } from "@/lib/logger";

/** Parses a YYYY-MM-DD date string to a UTC-midnight Date for a `@db.Date` column. */
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export const PATCH = withAuth(
  async (request, { params }: { params: Promise<{ id: string; recurringId: string }> }, userId) => {
    const { id, recurringId } = await params;
    const body = await request.json();
    const parsed = updateRecurringCashTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Scope ownership into the lookup so a foreign rule can't be edited.
    const existing = await prisma.recurringCashTransaction.findFirst({
      where: { id: recurringId, accountId: id, account: { userId } },
      select: { id: true, startDate: true, endDate: true, frequency: true },
    });
    if (!existing) return failure("Recurring transaction not found", 404);

    const { type, amount, frequency, note, startDate, endDate, isActive } = parsed.data;
    const effectiveStartDate = startDate ? toUtcDate(startDate) : existing.startDate;
    const effectiveEndDate =
      endDate === undefined ? existing.endDate : endDate ? toUtcDate(endDate) : null;
    if (effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      return failure("End date must be on or after the start date", 400);
    }

    const data: Record<string, unknown> = {};
    if (type !== undefined) data.type = type;
    if (amount !== undefined) data.amount = amount;
    if (frequency !== undefined) data.frequency = frequency;
    if (note !== undefined) data.note = note;
    if (endDate !== undefined) data.endDate = endDate ? toUtcDate(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;
    // Changing the start date re-anchors the schedule. Clamp the next run to
    // the first scheduled occurrence on/after today: resetting it to a past
    // startDate would make the next cron replay every missed occurrence
    // (and DCA backfills would even be priced at today's price). Intentional
    // backfill remains available by CREATING a rule with a past startDate.
    if (startDate !== undefined) {
      const start = toUtcDate(startDate);
      const effectiveFrequency = frequency ?? existing.frequency;
      data.startDate = start;
      data.nextRunDate = firstOccurrenceOnOrAfter(
        start,
        effectiveFrequency,
        taiwanCalendarDay(new Date()),
      );
    }

    const [rule] = await prisma.recurringCashTransaction.updateManyAndReturn({
      where: {
        id: recurringId,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
      data,
    });
    if (!rule) {
      return failure("Recurring transaction changed while updating; please retry", 409);
    }

    // An update can make the rule due right now (reactivation, startDate set
    // to today) — post immediately rather than waiting for the nightly cron.
    // Same idempotency/failure story as the POST route.
    let updated = rule;
    if (rule.isActive && rule.nextRunDate.getTime() <= taiwanCalendarDay(new Date()).getTime()) {
      try {
        const { created: posted } = await materializeDueRecurringTransactions(new Date(), rule.id);
        if (posted > 0) {
          revalidateTag(`accounts:${userId}`, { expire: 0 });
          revalidateTag(`net-worth:${userId}`, { expire: 0 });
          revalidateTag(`history:${userId}`, { expire: 0 });
        }
        updated =
          (await prisma.recurringCashTransaction.findUnique({ where: { id: rule.id } })) ?? rule;
      } catch (error) {
        log.error("recurring.materialize_on_update_failed", {
          ruleId: rule.id,
          error: String(error),
        });
      }
    }

    return ok(serializeRecurringCashTransaction(updated));
  },
);

export const DELETE = withAuth(
  async (
    _request,
    { params }: { params: Promise<{ id: string; recurringId: string }> },
    userId,
  ) => {
    const { id, recurringId } = await params;

    // Ownership folded into the write to avoid a check-then-write TOCTOU window.
    const result = await prisma.recurringCashTransaction.deleteMany({
      where: { id: recurringId, accountId: id, account: { userId } },
    });
    if (result.count === 0) return failure("Recurring transaction not found", 404);

    return ok({ success: true });
  },
);
