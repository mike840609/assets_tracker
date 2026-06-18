export function formatRelativeTime(
  date: Date | string,
  locale: string,
  now: number = Date.now(),
): string {
  const [value, unit] = getRelativeParts(date, now);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}

/**
 * Compact age for space-constrained chips, e.g. "3d", "5h", "2mo" (en) or
 * "3天前", "5小時前" (zh). Always pair this with a full-sentence accessible name
 * (see FreshnessBadge): the abbreviation is for sighted scanning only.
 */
export function formatRelativeTimeShort(
  date: Date | string,
  locale: string,
  now: number = Date.now(),
): string {
  const [value, unit] = getRelativeParts(date, now);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" }).format(
    value,
    unit,
  );
}

function getRelativeParts(date: Date | string, now: number): [number, Intl.RelativeTimeFormatUnit] {
  const localDate =
    date instanceof Date ? date : new Date(date.includes("T") ? date : `${date}T12:00:00`);
  const seconds = Math.round((localDate.getTime() - now) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return [seconds, "second"];
  if (abs < 3600) return [Math.round(seconds / 60), "minute"];
  if (abs < 86400) return [Math.round(seconds / 3600), "hour"];
  if (abs < 2592000) return [Math.round(seconds / 86400), "day"];
  if (abs < 31536000) return [Math.round(seconds / 2592000), "month"];
  return [Math.round(seconds / 31536000), "year"];
}
