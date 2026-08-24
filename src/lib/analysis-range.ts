import { taiwanCalendarDay } from "@/lib/app-day";

export interface AnalysisRange<T extends { date: string }> {
  filteredSnapshots: T[];
  rangeStart: Date;
  rangeEnd: Date;
  rangeStartIso: string;
}

/**
 * Snapshot `date` is stamped with the Taiwan calendar day (see lib/app-day),
 * so range boundaries must be derived from that same day — never from the
 * host's local calendar. This runs on the server (UTC) since #688, where
 * local getters would drop the newest month between 05:30 and 08:00 Taipei on
 * the 1st, and resolve YTD to the whole previous year on 1 January.
 */
export function resolveAnalysisRange<T extends { date: string }>(
  snapshots: T[],
  months: number,
  now = new Date(),
): AnalysisRange<T> {
  const today = taiwanCalendarDay(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const rangeEnd = new Date(Date.UTC(year, month, 1));

  if (months === 0) {
    const rangeStart = new Date(Date.UTC(year, 0, 1));
    const rangeStartIso = `${year}-01-01`;
    return {
      filteredSnapshots: snapshots.filter((snapshot) => snapshot.date >= rangeStartIso),
      rangeStart,
      rangeEnd,
      rangeStartIso,
    };
  }

  if (months === Infinity) {
    const firstDate = snapshots.length > 0 ? new Date(snapshots[0].date) : now;
    const rangeStart =
      snapshots.length > 0
        ? new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1))
        : rangeEnd;
    return {
      filteredSnapshots: snapshots,
      rangeStart,
      rangeEnd,
      rangeStartIso: snapshots.length > 0 ? snapshots[0].date : "1970-01-01",
    };
  }

  // Keep the user's current calendar month, but construct the date-only
  // boundary at UTC midnight so serializing it cannot roll back a day/month.
  const rangeStart = new Date(Date.UTC(year, month - months, 1));
  const rangeStartIso = rangeStart.toISOString().slice(0, 10);
  return {
    filteredSnapshots: snapshots.filter((snapshot) => snapshot.date >= rangeStartIso),
    rangeStart,
    rangeEnd,
    rangeStartIso,
  };
}

export const ANALYSIS_RANGES = [
  { label: "YTD", months: 0, messageKey: "rangeYTD" },
  { label: "6M", months: 6, messageKey: "range6M" },
  { label: "1Y", months: 12, messageKey: "range1Y" },
  { label: "2Y", months: 24, messageKey: "range2Y" },
  { label: "All", months: Infinity, messageKey: "rangeAll" },
] as const;

export type RangeLabel = (typeof ANALYSIS_RANGES)[number]["label"];

/** Allow-list for the persisted range (see usePersistedRange). */
export const ANALYSIS_RANGE_LABELS: readonly RangeLabel[] = ANALYSIS_RANGES.map((r) => r.label);

export function getMonthsForRange(label: RangeLabel): number {
  return ANALYSIS_RANGES.find((r) => r.label === label)!.months;
}

export function getMessageKeyForRange(
  label: RangeLabel,
): (typeof ANALYSIS_RANGES)[number]["messageKey"] {
  return ANALYSIS_RANGES.find((r) => r.label === label)!.messageKey;
}

/**
 * First-visit default. YTD is the conventional choice, but it reads as a
 * near-empty chart when there is little history or the year just started, so
 * widen in those cases. A persisted user choice always wins (see
 * usePersistedRange). Server-computed at payload fill time, so `now` is read
 * as a Taiwan calendar day to match how snapshot dates are bucketed.
 */
export function pickDefaultRange(snapshots: { date: string }[], now = new Date()): RangeLabel {
  if (snapshots.length === 0) return "YTD";
  const first = new Date(snapshots[0].date);
  const today = taiwanCalendarDay(now);
  const historyMonths =
    (today.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    first.getUTCMonth() +
    1;
  if (historyMonths <= 6) return "All";
  if (today.getUTCMonth() < 3) return "6M"; // Jan–Mar: YTD would be a thin 1–3 month slice
  return "YTD";
}
