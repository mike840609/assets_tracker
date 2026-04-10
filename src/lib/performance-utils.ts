import type { NormalizedSnapshot } from "@/lib/services/history-service";

export interface PerformancePeriod {
  period: string; // "2024-01" for monthly, "2024" for yearly
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}

export interface PerformanceSummary {
  bestPeriod: PerformancePeriod | null;
  worstPeriod: PerformancePeriod | null;
  averageChangePercent: number;
  totalPeriods: number;
}

export interface PerformanceData {
  periods: PerformancePeriod[];
  summary: PerformanceSummary;
}

function getPeriodKey(date: string, mode: "monthly" | "yearly"): string {
  return mode === "monthly" ? date.substring(0, 7) : date.substring(0, 4);
}

export function computePerformancePeriods(
  snapshots: NormalizedSnapshot[],
  mode: "monthly" | "yearly"
): PerformanceData {
  if (snapshots.length === 0) {
    return {
      periods: [],
      summary: {
        bestPeriod: null,
        worstPeriod: null,
        averageChangePercent: 0,
        totalPeriods: 0,
      },
    };
  }

  // Group snapshots by period key (already sorted asc by date from history-service)
  const grouped = new Map<string, NormalizedSnapshot[]>();
  for (const s of snapshots) {
    const key = getPeriodKey(s.date, mode);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const periods: PerformancePeriod[] = [];
  let prevEndValue: number | null = null;

  for (const [key, periodSnapshots] of grouped) {
    // Snapshots already sorted asc; last one is the end-of-period value
    const endSnapshot = periodSnapshots[periodSnapshots.length - 1];
    const endValue = endSnapshot.netWorth;

    // Start value is the previous period's end (continuity chain).
    // For the very first period, fall back to the first snapshot of that period.
    const startValue =
      prevEndValue !== null ? prevEndValue : periodSnapshots[0].netWorth;

    const change = endValue - startValue;
    const changePercent =
      startValue !== 0 ? (change / Math.abs(startValue)) * 100 : 0;

    periods.push({ period: key, startValue, endValue, change, changePercent });
    prevEndValue = endValue;
  }

  // Compute summary
  let bestPeriod: PerformancePeriod | null = null;
  let worstPeriod: PerformancePeriod | null = null;
  let totalChangePercent = 0;

  for (const p of periods) {
    totalChangePercent += p.changePercent;
    if (!bestPeriod || p.changePercent > bestPeriod.changePercent) {
      bestPeriod = p;
    }
    if (!worstPeriod || p.changePercent < worstPeriod.changePercent) {
      worstPeriod = p;
    }
  }

  const averageChangePercent =
    periods.length > 0 ? totalChangePercent / periods.length : 0;

  return {
    periods,
    summary: {
      bestPeriod,
      worstPeriod,
      averageChangePercent,
      totalPeriods: periods.length,
    },
  };
}
