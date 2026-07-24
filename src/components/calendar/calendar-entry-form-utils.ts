import type { CalendarEntryCategoryValue } from "@/lib/types";

export type CalendarEntryFormValues = {
  title: string;
  eventDate: string;
  time: string;
  category: CalendarEntryCategoryValue;
  description: string;
  sourceUrl: string;
};

export function isCalendarEntryFormDirty(
  initial: CalendarEntryFormValues,
  current: CalendarEntryFormValues,
): boolean {
  return (Object.keys(initial) as Array<keyof CalendarEntryFormValues>).some(
    (field) => initial[field] !== current[field],
  );
}

export function minutesToTimeInput(minutes: number | null): string {
  if (minutes === null) return "";

  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string): number | null {
  if (!value) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveEntryTimeZone(existing: string | null, browserTimeZone: string): string {
  if (existing && isValidTimeZone(existing)) return existing;

  return isValidTimeZone(browserTimeZone) ? browserTimeZone : "UTC";
}
