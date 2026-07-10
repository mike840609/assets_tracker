import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { updateRecurringCashTransactionSchema } from "@/lib/validators";
import { serializeRecurringCashTransaction } from "@/lib/types";

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
      select: { id: true, startDate: true, endDate: true },
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
    // Changing the start date redefines the schedule anchor, so reset the next
    // run to it. Already-posted occurrences won't double-post — the
    // (recurringId, occurrenceDate) unique index makes re-materialization a
    // no-op for any day that already has a row.
    if (startDate !== undefined) {
      data.startDate = toUtcDate(startDate);
      data.nextRunDate = toUtcDate(startDate);
    }

    const rule = await prisma.recurringCashTransaction.update({
      where: { id: recurringId },
      data,
    });

    return ok(serializeRecurringCashTransaction(rule));
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
