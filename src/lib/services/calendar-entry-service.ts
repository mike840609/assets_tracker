import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { AuthPrincipal } from "@/lib/auth-principal";
import { formatDateOnly, getCalendarRangeLength, parseDateOnly } from "@/lib/calendar-date";
import { invalidateScopedTag } from "@/lib/demo/demo-cache";
import { prisma } from "@/lib/prisma";
import { serializeCalendarEntry, type SerializedCalendarEntry } from "@/lib/types";

export async function getCalendarEntriesInRange(
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<SerializedCalendarEntry[]> {
  "use cache";
  const from = formatDateOnly(fromDate);
  const to = formatDateOnly(toDate);
  const fromDateOnly = parseDateOnly(from);
  const toDateOnly = parseDateOnly(to);
  const rangeLength = getCalendarRangeLength(from, to);
  if (!fromDateOnly || !toDateOnly || rangeLength < 1 || rangeLength > 42) {
    throw new RangeError("Calendar range must contain 1 through 42 inclusive dates");
  }
  cacheTag("calendar-entries");
  cacheTag(`calendar-entries:${userId}`);
  cacheLife("hours");

  const entries = await prisma.calendarEntry.findMany({
    where: { userId, eventDate: { gte: fromDateOnly, lte: toDateOnly } },
    orderBy: [
      { eventDate: "asc" },
      { startTimeMinutes: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  return entries.map(serializeCalendarEntry);
}

export function invalidateCalendarEntryCaches(userId: string, principal: AuthPrincipal) {
  invalidateScopedTag({
    globalTag: "calendar-entries",
    userTag: `calendar-entries:${userId}`,
    principal,
  });
}
