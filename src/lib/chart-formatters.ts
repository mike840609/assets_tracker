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

/**
 * Compact axis label (500, 50K, 2.5M). Pass the axis `step` when ticks are closer
 * together than the default precision (one decimal for M, none for K); otherwise
 * neighbours like 1.95M and 2.00M both print as "2.0M".
 */
export function formatChartTick(v: number, step?: number): string {
  const abs = Math.abs(v);
  const [unit, suffix] =
    abs >= 1_000_000 ? [1_000_000, "M"] : abs >= 1_000 ? [1_000, "K"] : [1, ""];
  const decimals =
    step && step > 0
      ? Math.min(3, Math.max(0, Math.ceil(-Math.log10(step / unit) - 1e-9)))
      : unit === 1_000_000
        ? 1
        : 0;
  return unit === 1 && decimals === 0
    ? String(Math.round(v))
    : `${(v / unit).toFixed(decimals)}${suffix}`;
}

/**
 * Evenly spaced ticks on a 1/2/5 x 10^n step that cover [min, max]. Use with a
 * custom domain so the axis lands on round values instead of splitting an
 * arbitrary padded range into fractions.
 */
export function niceTicks(min: number, max: number, count = 5): { ticks: number[]; step: number } {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return { ticks: [min], step: 0 };
  const raw = span / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let i = 0; lo + i * step <= hi + step / 2; i++) {
    ticks.push(Number((lo + i * step).toPrecision(12)));
  }
  return { ticks, step };
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
