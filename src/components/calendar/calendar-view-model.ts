import type { SerializedCalendarEntry } from "@/lib/types";

export function isCalendarFocusDestinationReady({
  pendingDate,
  selectedDate,
  month,
}: {
  pendingDate: string | null;
  selectedDate: string;
  month: string;
}) {
  return pendingDate !== null && selectedDate === pendingDate && month === pendingDate.slice(0, 7);
}

export function sortCalendarDayEntries(entries: readonly SerializedCalendarEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.startTimeMinutes === null && b.startTimeMinutes !== null) return -1;
    if (a.startTimeMinutes !== null && b.startTimeMinutes === null) return 1;
    const time = (a.startTimeMinutes ?? -1) - (b.startTimeMinutes ?? -1);
    if (time !== 0) return time;
    const created = a.createdAt.localeCompare(b.createdAt);
    return created !== 0 ? created : a.id.localeCompare(b.id);
  });
}

export function groupCalendarEntriesByDate(entries: readonly SerializedCalendarEntry[]) {
  const groups = new Map<string, SerializedCalendarEntry[]>();
  for (const entry of entries) {
    const day = groups.get(entry.eventDate) ?? [];
    day.push(entry);
    groups.set(entry.eventDate, day);
  }
  for (const [date, day] of groups) groups.set(date, sortCalendarDayEntries(day));
  return groups;
}

export function formatCalendarWallClock(minutes: number, locale: string) {
  const date = new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60));
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  if (formatter.resolvedOptions().hour12 !== false) return formatter.format(date);

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
