import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { updateRecurringInvestmentSchema } from "@/lib/validators";
import { serializeRecurringInvestment } from "@/lib/types";

/** Parses a YYYY-MM-DD date string to a UTC-midnight Date for a `@db.Date` column. */
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export const PATCH = withAuth(
  async (request, { params }: { params: Promise<{ id: string; recurringId: string }> }, userId) => {
    const { id, recurringId } = await params;
    const body = await request.json();
    const parsed = updateRecurringInvestmentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.recurringInvestment.findFirst({
      where: { id: recurringId, accountId: id, account: { userId } },
      select: { id: true },
    });
    if (!existing) return failure("Recurring investment not found", 404);

    const { amount, frequency, note, startDate, endDate, isActive } = parsed.data;

    const data: Record<string, unknown> = {};
    if (amount !== undefined) data.amount = amount;
    if (frequency !== undefined) data.frequency = frequency;
    if (note !== undefined) data.note = note;
    if (endDate !== undefined) data.endDate = endDate ? toUtcDate(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;
    // Changing the start date redefines the schedule anchor; reset the next run.
    // The (recurringId, occurrenceDate) unique index keeps re-materialization a
    // no-op for any day already posted.
    if (startDate !== undefined) {
      data.startDate = toUtcDate(startDate);
      data.nextRunDate = toUtcDate(startDate);
    }

    const rule = await prisma.recurringInvestment.update({
      where: { id: recurringId },
      data,
    });

    return ok(serializeRecurringInvestment(rule));
  },
);

export const DELETE = withAuth(
  async (
    _request,
    { params }: { params: Promise<{ id: string; recurringId: string }> },
    userId,
  ) => {
    const { id, recurringId } = await params;

    const result = await prisma.recurringInvestment.deleteMany({
      where: { id: recurringId, accountId: id, account: { userId } },
    });
    if (result.count === 0) return failure("Recurring investment not found", 404);

    return ok({ success: true });
  },
);
