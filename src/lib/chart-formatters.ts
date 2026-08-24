const monthFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getMonthFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = monthFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    monthFormatterCache.set(locale, formatter);
  }
  return formatter;
}

export function formatChartTick(v: number): string {
  return Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : String(Math.round(v));
}

export function getMonthTickInterval(pointCount: number, targetTicks = 6): number {
  if (pointCount <= targetTicks) return 0;
  return Math.max(0, Math.ceil(pointCount / targetTicks) - 1);
}

/**
 * Format a "YYYY-MM" key into a short localized month label (e.g. "Apr 2026").
 * Cached per locale in a module-level Map.
 */
export function formatMonthLabel(monthKey: string, locale = "en-US"): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return monthKey;
  try {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    return getMonthFormatter(locale).format(d);
  } catch {
    return monthKey;
  }
}

/**
 * Map an array of points containing `monthKey` to include formatted `label`.
 */
export function attachMonthLabels<T extends { monthKey: string }>(
  points: readonly T[],
  locale: string,
): Array<T & { label: string }> {
  return points.map((p) => ({
    ...p,
    label: formatMonthLabel(p.monthKey, locale),
  }));
}
