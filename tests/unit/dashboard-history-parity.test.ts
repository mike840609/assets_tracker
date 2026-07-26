import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The dashboard and the History tab render the same `TrendChart`. They used to
 * feed it from different fetchers — the dashboard from `getNormalizedHistory`
 * (hard-capped at DEFAULT_HISTORY_DAYS = 90) and History from
 * `getFullNormalizedHistory` (everything). Because both charts share one
 * sessionStorage range key (`asset-tracker:range:trend-chart`, see
 * use-persisted-range.ts), picking 6M/YTD/1Y/All showed the full series on
 * History and a silently truncated one on the dashboard, along with a
 * mismatched period-change badge and Y-axis domain.
 *
 * These assertions lock the two views onto one fetcher and one array.
 */
const dashboardSource = readFileSync("src/components/dashboard/dashboard-content.tsx", "utf8");
const historyPageSource = readFileSync("src/app/(main)/history/page.tsx", "utf8");

function trendSectionSource(): string {
  const start = dashboardSource.indexOf("async function TrendSection(");
  expect(start).toBeGreaterThan(-1);
  const end = dashboardSource.indexOf("async function WatchlistSection(", start);
  expect(end).toBeGreaterThan(start);
  return dashboardSource.slice(start, end);
}

describe("dashboard / history trend chart parity", () => {
  it("feeds the dashboard trend chart from the same fetcher as the History tab", () => {
    const trendSection = trendSectionSource();

    expect(historyPageSource).toContain("getFullNormalizedHistory");
    expect(trendSection).toContain("getFullNormalizedHistory(userId, baseCurrency)");
  });

  it("never reaches for the 90-day window from the dashboard trend chart", () => {
    const trendSection = trendSectionSource();

    // `getNormalizedHistory` is not a substring of `getFullNormalizedHistory`,
    // so this catches a regression to the capped fetcher without false hits.
    expect(trendSection).not.toContain("getNormalizedHistory(");
    expect(trendSection).not.toContain("getCurrentYearNormalizedHistory");
    expect(dashboardSource).not.toContain("getCurrentYearNormalizedHistory");
  });

  it("hands the trend chart and its heatmap footer the same array", () => {
    const trendSection = trendSectionSource();

    // One binding, serialized into the RSC payload once. HistoryHeatmap clips
    // to the current year internally (isOutsideYear), exactly as it already
    // does on the History tab, which passes it the full array too.
    expect(trendSection).toContain("snapshots={snapshots}");
    expect(trendSection).toContain("<HistoryHeatmap snapshots={snapshots}");
    expect(trendSection).not.toContain("heatmapSnapshots");
    expect(trendSection).not.toContain("trendSnapshots");
  });

  it("keeps the year-window fetcher retired so the divergence cannot return", () => {
    const historyServiceSource = readFileSync("src/lib/services/history-service.ts", "utf8");

    // HistoryHeatmap clips to the current year itself, so a dedicated
    // year-window fetcher has no caller — and reintroducing one is how the
    // dashboard drifted away from the History tab in the first place.
    expect(historyServiceSource).not.toContain("getCurrentYearNormalizedHistory");
  });

  it("keeps the 90-day window available for the goal projections that want it", () => {
    const goalServiceSource = readFileSync("src/lib/services/goal-service.ts", "utf8");
    const historyServiceSource = readFileSync("src/lib/services/history-service.ts", "utf8");

    // CAGR/linear projections deliberately look at recent trend only, so the
    // capped fetcher stays — it just must not be what the dashboard chart uses.
    expect(goalServiceSource).toContain("getNormalizedHistory(userId, baseCurrency)");
    expect(historyServiceSource).toContain("const DEFAULT_HISTORY_DAYS = 90");
  });
});
