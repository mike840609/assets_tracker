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
