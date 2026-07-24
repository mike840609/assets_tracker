import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { failure, ok, validationError } from "@/lib/api-responses";
import { log } from "@/lib/logger";
import { parseDateOnly } from "@/lib/calendar-date";
import { createCalendarEntrySchema, updateCalendarEntrySchema } from "@/lib/validators";
import { invalidateCalendarEntryCaches } from "@/lib/services/calendar-entry-service";
import { serializeCalendarEntry } from "@/lib/types";

type IdCtx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const partial = updateCalendarEntrySchema.safeParse(body);
    if (!partial.success) return validationError(partial.error);
    if (Object.keys(partial.data).length === 0) return failure("No fields to update", 400);

    const current = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!current) return failure("Not found", 404);

    const merged = createCalendarEntrySchema.safeParse({
      title: partial.data.title ?? current.title,
      eventDate: partial.data.eventDate ?? current.eventDate.toISOString().slice(0, 10),
      startTimeMinutes:
        partial.data.startTimeMinutes === undefined
          ? current.startTimeMinutes
          : partial.data.startTimeMinutes,
      timeZone: partial.data.timeZone === undefined ? current.timeZone : partial.data.timeZone,
      category: partial.data.category ?? current.category,
      description:
        partial.data.description === undefined ? current.description : partial.data.description,
      sourceUrl: partial.data.sourceUrl === undefined ? current.sourceUrl : partial.data.sourceUrl,
    });
    if (!merged.success) return validationError(merged.error);

    const { count } = await prisma.calendarEntry.updateMany({
      where: { id, userId },
      data: { ...merged.data, eventDate: parseDateOnly(merged.data.eventDate)! },
    });
    if (count === 0) return failure("Not found", 404);

    const updated = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!updated) return failure("Not found", 404);

    invalidateCalendarEntryCaches(userId);
    return ok(serializeCalendarEntry(updated));
  } catch (error) {
    log.error("calendar_entries.update_failed", { userId, error: String(error) });
    return failure("Failed to update calendar entry", 500);
  }
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  try {
    const { id } = await params;
    const current = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!current) return failure("Not found", 404);

    const { count } = await prisma.calendarEntry.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("Not found", 404);

    invalidateCalendarEntryCaches(userId);
    return ok({ ok: true });
  } catch (error) {
    log.error("calendar_entries.delete_failed", { userId, error: String(error) });
    return failure("Failed to delete calendar entry", 500);
  }
});
