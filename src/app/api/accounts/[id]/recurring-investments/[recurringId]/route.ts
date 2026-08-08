import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { ok, failure, validationError } from "@/lib/api-responses";
import { updateRecurringInvestmentSchema } from "@/lib/validators";
import { serializeRecurringInvestment } from "@/lib/types";
import { firstOccurrenceOnOrAfter } from "@/lib/services/recurring-cash-service";
import { materializeDueInvestments } from "@/lib/services/recurring-investment-service";
import { taiwanCalendarDay } from "@/lib/app-day";
import { log } from "@/lib/logger";

/** Parses a YYYY-MM-DD date string to a UTC-midnight Date for a `@db.Date` column. */
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export const PATCH = withAuth(
  async (
    request,
    { params }: { params: Promise<{ id: string; recurringId: string }> },
    userId,
    principal,
  ) => {
    const { id, recurringId } = await params;
    const body = await request.json();
    const parsed = updateRecurringInvestmentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.recurringInvestment.findFirst({
      where: { id: recurringId, accountId: id, account: { userId } },
      select: { id: true, startDate: true, endDate: true, frequency: true, updatedAt: true },
    });
    if (!existing) return failure("Recurring investment not found", 404);

    const { amount, frequency, note, startDate, endDate, isActive } = parsed.data;
    const effectiveStartDate = startDate ? toUtcDate(startDate) : existing.startDate;
    const effectiveEndDate =
      endDate === undefined ? existing.endDate : endDate ? toUtcDate(endDate) : null;
    if (effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      return failure("End date must be on or after the start date", 400);
    }

    const data: Record<string, unknown> = {};
    if (amount !== undefined) data.amount = amount;
    if (frequency !== undefined) data.frequency = frequency;
    if (note !== undefined) data.note = note;
    if (endDate !== undefined) data.endDate = endDate ? toUtcDate(endDate) : null;
    if (isActive !== undefined) data.isActive = isActive;
    // Changing the start date re-anchors the schedule. Clamp the next run to
    // the first scheduled occurrence on/after today: resetting it to a past
    // startDate would make the next cron replay every missed occurrence —
    // and DCA backfills would even be priced at today's price. Intentional
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

    const [rule] = await prisma.recurringInvestment.updateManyAndReturn({
      where: {
        id: recurringId,
        updatedAt: existing.updatedAt,
      },
      data,
    });
    if (!rule) {
      return failure("Recurring investment changed while updating; please retry", 409);
    }

    // An update can make the rule due right now (reactivation, startDate set
    // to today). Formal users schedule that buy rather than waiting for the
    // nightly cron; Demo leaves it to the later formal-only materializer.
    if (
      principal.kind === "formal" &&
      rule.isActive &&
      rule.nextRunDate.getTime() <= taiwanCalendarDay(new Date()).getTime()
    ) {
      after(async () => {
        try {
          const { created: posted } = await materializeDueInvestments(new Date(), rule.id);
          if (posted > 0) {
            revalidateTag(`accounts:${userId}`, { expire: 0 });
            revalidateTag(`net-worth:${userId}`, { expire: 0 });
            revalidateTag(`history:${userId}`, { expire: 0 });
            revalidateTag("prices", { expire: 0 });
          }
        } catch (error) {
          log.error("recurring.investment_materialize_on_update_failed", {
            ruleId: rule.id,
            error: String(error),
          });
        }
      });
    }

    return ok(serializeRecurringInvestment(rule));
  },
  { demo: "allow" },
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
  { demo: "allow" },
);
