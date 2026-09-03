import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Node environment (no jsdom): render to static markup, the same harness
// tests/unit/calendar-month-grid.test.ts uses. The formatter is Intl-backed and
// defaults to a zone west of UTC — the runner's own zone is Asia/Taipei (UTC in
// CI), where a UTC-midnight marker formatted without `timeZone` still lands on
// the right calendar day, so the default has to be west for these assertions to
// notice a component that drops the option. A component-supplied `timeZone`
// wins via spread order, which is what every call here passes.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", ...options }).format(
        date,
      ),
  }),
}));

const { HistoryHeatmap } = await import("@/components/history/history-heatmap");

/**
 * NetWorthSnapshot.date is stamped with the Taiwan business day (src/lib/app-day.ts)
 * and the cron writes it at 21:30 UTC — inside the window where the Taiwan day is
 * already UTC+1. A chart that derives "today" from the viewer's UTC or local day
 * therefore marks the snapshot that was just written as a future cell: no tooltip,
 * no gain/loss shade, the day looks missing while its row exists.
 *
 * `taiwanCalendarDay` maps an absolute instant to a day, so the anchor is the same
 * for every viewer regardless of their zone; only the instant is varied here.
 */
const SNAPSHOTS = [
  { id: "a", date: "2026-08-31", netWorth: 100 },
  { id: "b", date: "2026-09-01", netWorth: 110 },
  // 2026-09-02 is missing in production: that day's cron invocation never fired.
  { id: "c", date: "2026-09-03", netWorth: 120 },
  { id: "d", date: "2026-09-04", netWorth: 130 },
];

const renderHeatmap = (snapshots: typeof SNAPSHOTS) =>
  renderToStaticMarkup(createElement(HistoryHeatmap, { snapshots, baseCurrency: "USD" }));

afterEach(() => {
  vi.useRealTimers();
});

const at = (instant: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
};

describe("history heatmap anchors on the Taiwan business day", () => {
  it("shows the snapshot the cron just wrote as today, not as an empty future cell", () => {
    at("2026-09-03T21:35:00.000Z"); // 05:35 Taipei on 09-04, minutes after the cron

    const html = renderHeatmap(SNAPSHOTS);

    expect(html).toContain("Sep 4, 2026, net worth");
    expect(html).toContain("Sep 4, 2026, net worth $130, change +$10, today");
    expect(html).not.toContain("Sep 4, 2026, no data yet");
  });

  it("keeps a genuinely missing day empty and still bounds the future", () => {
    at("2026-09-03T21:35:00.000Z");

    const html = renderHeatmap(SNAPSHOTS);

    expect(html).toContain("Sep 2, 2026, no snapshot");
    expect(html).toContain("Sep 5, 2026, no data yet");
  });

  it("is unchanged in the hours where the Taiwan and UTC day agree", () => {
    at("2026-09-03T15:59:00.000Z"); // 23:59 Taipei on 09-03

    const html = renderHeatmap(SNAPSHOTS.slice(0, 3));

    expect(html).toContain("Sep 3, 2026, net worth");
    expect(html).toContain("Sep 4, 2026, no data yet");
  });
});

/**
 * DailyChangeChart hides its body behind a mounted flag, so static markup only
 * yields the placeholder — rendering it proves nothing. Its window builder shares
 * the heatmap's anchor, so what is worth pinning is that it keeps using it.
 */
describe("daily-change chart window", () => {
  it("anchors on the Taiwan business day and formats its markers in UTC", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../src/components/history/daily-change-chart.tsx"),
      "utf8",
    );

    expect(source).toContain('from "@/lib/app-day"');
    expect(source).toContain("taiwanCalendarDay(new Date())");

    const calls = [...source.matchAll(/format\.dateTime\(date, \{([^}]*)\}/g)];
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call[1]).toContain('timeZone: "UTC"');
  });
});
