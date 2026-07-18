/**
 * The app's business day is the Taiwan calendar day (UTC+8, no DST): the
 * daily cron fires 21:30 UTC = 05:30 Taipei, and NetWorthSnapshot.date is
 * stamped with this day. Anything that must agree with snapshot bucketing
 * (recurring materialization, "today" checks) should use this helper, not
 * the raw UTC day.
 */
export const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;

/** UTC-midnight Date of the Taiwan calendar day containing `now`. */
export function taiwanCalendarDay(now: Date): Date {
  const shifted = new Date(now.getTime() + TAIWAN_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}
