import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createRecurringInvestmentSchema } from "@/lib/validators";
import { listInvestmentsForAccount } from "@/lib/services/recurring-investment-service";
import { serializeRecurringInvestment } from "@/lib/types";

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

    const rules = await listInvestmentsForAccount(id);
    return ok({ rules: rules.map(serializeRecurringInvestment) });
  },
);

export const POST = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = createRecurringInvestmentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const account = await prisma.account.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) return failure("Account not found", 404);

    const {
      symbol,
      name,
      assetType,
      holdingCurrency,
      amount,
      frequency,
      note,
      startDate,
      endDate,
    } = parsed.data;

    const rule = await prisma.recurringInvestment.create({
      data: {
        accountId: id,
        symbol,
        name,
        assetType,
        holdingCurrency,
        amount,
        frequency,
        note,
        startDate: toUtcDate(startDate),
        endDate: endDate ? toUtcDate(endDate) : null,
        nextRunDate: toUtcDate(startDate),
      },
    });

    return ok(serializeRecurringInvestment(rule), { status: 201 });
  },
);
