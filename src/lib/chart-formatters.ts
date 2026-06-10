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
