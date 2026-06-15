import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createRecurringCashTransactionSchema } from "@/lib/validators";
import { listRecurringForAccount } from "@/lib/services/recurring-cash-service";
import { serializeRecurringCashTransaction } from "@/lib/types";

/** Parses a YYYY-MM-DD date string to a UTC-midnight Date for a `@db.Date` column. */
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export const GET = withAuth(
  async (_request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;
    const account = await prisma.account.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) return failure("Account not found", 404);

    const rules = await listRecurringForAccount(id);
    return ok({ rules: rules.map(serializeRecurringCashTransaction) });
  },
);

export const POST = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = createRecurringCashTransactionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const account = await prisma.account.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) return failure("Account not found", 404);

    const { type, amount, frequency, note, startDate, endDate } = parsed.data;

    // First occurrence is on startDate; the cron posts it (and any catch-up) on
    // its next run — rules are never materialized synchronously here.
    const rule = await prisma.recurringCashTransaction.create({
      data: {
        accountId: id,
        type,
        amount,
        frequency,
        note,
        startDate: toUtcDate(startDate),
        endDate: endDate ? toUtcDate(endDate) : null,
        nextRunDate: toUtcDate(startDate),
      },
    });

    return ok(serializeRecurringCashTransaction(rule), { status: 201 });
  },
);
