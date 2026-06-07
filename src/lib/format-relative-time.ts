export function formatRelativeTime(
  date: Date | string,
  locale: string,
  now: number = Date.now(),
): string {
  let localDate: Date;
  if (date instanceof Date) {
    localDate = date;
  } else {
    // Parse as local noon to avoid UTC-midnight causing off-by-one-day in non-UTC timezones
    localDate = date.includes("T") ? new Date(date) : new Date(`${date}T12:00:00`);
  }

  const diffInSeconds = Math.round((localDate.getTime() - now) / 1000);
  const absDiff = Math.abs(diffInSeconds);
  const isZh = locale.toLowerCase().startsWith("zh");

  if (isZh) {
    if (absDiff < 60) return "剛剛";

    let value: number;
    let unit: string;
    if (absDiff < 3600) {
      value = Math.round(absDiff / 60);
      unit = "分鐘";
    } else if (absDiff < 86400) {
      value = Math.round(absDiff / 3600);
      unit = "小時";
    } else if (absDiff < 2592000) {
      value = Math.round(absDiff / 86400);
      unit = "天";
    } else if (absDiff < 31536000) {
      value = Math.round(absDiff / 2592000);
      unit = "個月";
    } else {
      value = Math.round(absDiff / 31536000);
      unit = "年";
    }

    return diffInSeconds < 0 ? `${value}${unit}前` : `${value}${unit}後`;
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absDiff < 60) return rtf.format(Math.sign(diffInSeconds) * absDiff, "second");
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), "minute");
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), "hour");
  if (absDiff < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), "day");
  if (absDiff < 31536000) return rtf.format(Math.round(diffInSeconds / 2592000), "month");
  return rtf.format(Math.round(diffInSeconds / 31536000), "year");
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
  let localDate: Date;
  if (date instanceof Date) {
    localDate = date;
  } else {
    localDate = date.includes("T") ? new Date(date) : new Date(`${date}T12:00:00`);
  }

  const absDiff = Math.abs(Math.round((localDate.getTime() - now) / 1000));
  const isZh = locale.toLowerCase().startsWith("zh");

  if (absDiff < 60) return isZh ? "剛剛" : "now";

  let value: number;
  let unit: string;
  if (absDiff < 3600) {
    value = Math.round(absDiff / 60);
    unit = isZh ? "分鐘" : "m";
  } else if (absDiff < 86400) {
    value = Math.round(absDiff / 3600);
    unit = isZh ? "小時" : "h";
  } else if (absDiff < 2592000) {
    value = Math.round(absDiff / 86400);
    unit = isZh ? "天" : "d";
  } else if (absDiff < 31536000) {
    value = Math.round(absDiff / 2592000);
    unit = isZh ? "個月" : "mo";
  } else {
    value = Math.round(absDiff / 31536000);
    unit = isZh ? "年" : "y";
  }

  return isZh ? `${value}${unit}前` : `${value}${unit}`;
}
