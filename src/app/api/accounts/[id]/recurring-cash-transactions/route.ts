import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createRecurringCashTransactionSchema } from "@/lib/validators";
import {
  listRecurringForAccount,
  materializeDueRecurringTransactions,
} from "@/lib/services/recurring-cash-service";
import { serializeRecurringCashTransaction } from "@/lib/types";
import { taiwanCalendarDay } from "@/lib/app-day";
import { log } from "@/lib/logger";

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
  { demo: "allow" },
);

export const POST = withAuth(
  async (request, { params }: { params: Promise<{ id: string }> }, userId, principal) => {
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

    // For formal users, a rule starting today (or backdated) schedules a post
    // instead of sitting inert until the nightly cron. Idempotent: the
    // (recurringId, occurrenceDate) unique index makes a cron double-run safe.
    // Failure falls back to the cron — rule creation never fails for this.
    if (
      principal.kind === "formal" &&
      rule.nextRunDate.getTime() <= taiwanCalendarDay(new Date()).getTime()
    ) {
      after(async () => {
        try {
          const { created: posted } = await materializeDueRecurringTransactions(
            new Date(),
            rule.id,
          );
          if (posted > 0) {
            revalidateTag(`accounts:${userId}`, { expire: 0 });
            revalidateTag(`net-worth:${userId}`, { expire: 0 });
            revalidateTag(`history:${userId}`, { expire: 0 });
          }
        } catch (error) {
          log.error("recurring.materialize_on_create_failed", {
            ruleId: rule.id,
            error: String(error),
          });
        }
      });
    }

    return ok(serializeRecurringCashTransaction(rule), { status: 201 });
  },
  { demo: "allow" },
);
