import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { formatDateOnly, getCalendarRangeLength } from "@/lib/calendar-date";
import { prisma } from "@/lib/prisma";
import { serializeCalendarEntry, type SerializedCalendarEntry } from "@/lib/types";

export async function getCalendarEntriesInRange(
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<SerializedCalendarEntry[]> {
  "use cache";
  const rangeLength = getCalendarRangeLength(formatDateOnly(fromDate), formatDateOnly(toDate));
  if (rangeLength < 1 || rangeLength > 42) {
    throw new RangeError("Calendar range must contain 1 through 42 inclusive dates");
  }
  cacheTag("calendar-entries");
  cacheTag(`calendar-entries:${userId}`);
  cacheLife("hours");

  const entries = await prisma.calendarEntry.findMany({
    where: { userId, eventDate: { gte: fromDate, lte: toDate } },
    orderBy: [
      { eventDate: "asc" },
      { startTimeMinutes: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  return entries.map(serializeCalendarEntry);
}

export function invalidateCalendarEntryCaches(userId: string) {
  revalidateTag("calendar-entries", { expire: 0 });
  revalidateTag(`calendar-entries:${userId}`, { expire: 0 });
}
