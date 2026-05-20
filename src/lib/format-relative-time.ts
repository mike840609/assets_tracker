export function formatRelativeTime(
  date: Date | string,
  locale: string,
  now: number = Date.now(),
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  let localDate: Date;
  if (date instanceof Date) {
    localDate = date;
  } else {
    // Parse as local noon to avoid UTC-midnight causing off-by-one-day in non-UTC timezones
    localDate = date.includes("T") ? new Date(date) : new Date(`${date}T12:00:00`);
  }

  const diffInSeconds = Math.round((localDate.getTime() - now) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) return rtf.format(Math.sign(diffInSeconds) * absDiff, "second");
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), "minute");
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), "hour");
  if (absDiff < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), "day");
  if (absDiff < 31536000) return rtf.format(Math.round(diffInSeconds / 2592000), "month");
  return rtf.format(Math.round(diffInSeconds / 31536000), "year");
}
