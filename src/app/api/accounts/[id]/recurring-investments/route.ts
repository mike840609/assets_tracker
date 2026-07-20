import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { createRecurringInvestmentSchema } from "@/lib/validators";
import {
  listInvestmentsForAccount,
  materializeDueInvestments,
} from "@/lib/services/recurring-investment-service";
import { serializeRecurringInvestment } from "@/lib/types";
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

    // A rule starting today (or backdated) buys immediately instead of sitting
    // inert until the nightly cron. Best-effort: no resolvable price → the
    // service skips and the cron retries; failure falls back to the cron too.
    let created = rule;
    if (rule.nextRunDate.getTime() <= taiwanCalendarDay(new Date()).getTime()) {
      try {
        const { created: posted } = await materializeDueInvestments(new Date(), rule.id);
        if (posted > 0) {
          revalidateTag(`accounts:${userId}`, { expire: 0 });
          revalidateTag(`net-worth:${userId}`, { expire: 0 });
          revalidateTag(`history:${userId}`, { expire: 0 });
          revalidateTag("prices", { expire: 0 });
        }
        created = (await prisma.recurringInvestment.findUnique({ where: { id: rule.id } })) ?? rule;
      } catch (error) {
        log.error("recurring.investment_materialize_on_create_failed", {
          ruleId: rule.id,
          error: String(error),
        });
      }
    }

    return ok(serializeRecurringInvestment(created), { status: 201 });
  },
);
