export type TrendRange = { label: string; days: number; ytd?: true };

/** Selectable windows for the net-worth trend chart, narrowest first. */
export const TREND_RANGES: TrendRange[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "YTD", days: 0, ytd: true },
  { label: "1Y", days: 365 },
  { label: "All", days: Infinity },
];

/**
 * Opening window. The chart is handed the full snapshot series (dashboard and
 * History tab alike), so this is purely about what reads well first: recent
 * movement, with the wider windows one tap away.
 */
export const DEFAULT_TREND_RANGE = "3M";

/**
 * Find the chart point matching an externally-driven active date (e.g. a
 * hovered heatmap cell). Returns undefined when there is no active date or no
 * point on that day — a blank heatmap cell, or a day outside the chart's
 * current range has no point, so the linked marker draws nothing.
 */
export function findChartPoint<T extends { date: string }>(
  data: readonly T[],
  activeDate: string | null,
): T | undefined {
  if (!activeDate) return undefined;
  return data.find((point) => point.date === activeDate);
}
