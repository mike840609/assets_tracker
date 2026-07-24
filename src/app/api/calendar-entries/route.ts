import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { failure, ok, validationError } from "@/lib/api-responses";
import { log } from "@/lib/logger";
import { parseDateOnly } from "@/lib/calendar-date";
import { calendarEntriesRangeSchema, createCalendarEntrySchema } from "@/lib/validators";
import {
  getCalendarEntriesInRange,
  invalidateCalendarEntryCaches,
} from "@/lib/services/calendar-entry-service";
import { serializeCalendarEntry } from "@/lib/types";

export const GET = withAuth(async (request, _ctx, userId) => {
  try {
    const url = new URL(request.url);
    const parsed = calendarEntriesRangeSchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const from = parseDateOnly(parsed.data.from)!;
    const to = parseDateOnly(parsed.data.to)!;
    return ok(await getCalendarEntriesInRange(userId, from, to));
  } catch (error) {
    log.error("calendar_entries.list_failed", { userId, error: String(error) });
    return failure("Failed to load calendar entries", 500);
  }
});

export const POST = withAuth(async (request, _ctx, userId) => {
  try {
    const parsed = createCalendarEntrySchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);

    const entry = await prisma.calendarEntry.create({
      data: {
        userId,
        ...parsed.data,
        eventDate: parseDateOnly(parsed.data.eventDate)!,
        description: parsed.data.description ?? null,
        sourceUrl: parsed.data.sourceUrl ?? null,
      },
    });
    invalidateCalendarEntryCaches(userId);
    return ok(serializeCalendarEntry(entry), { status: 201 });
  } catch (error) {
    log.error("calendar_entries.create_failed", { userId, error: String(error) });
    return failure("Failed to create calendar entry", 500);
  }
});
