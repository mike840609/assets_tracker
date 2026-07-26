import { describe, expect, it } from "vitest";
import {
  DEFAULT_TREND_RANGE,
  TREND_RANGES,
  findChartPoint,
} from "@/components/dashboard/trend-chart-utils";

const data = [
  { date: "2026-01-01", netWorth: 100 },
  { date: "2026-02-01", netWorth: 120 },
];

describe("findChartPoint", () => {
  it("returns the point on a matching date", () => {
    expect(findChartPoint(data, "2026-02-01")).toEqual({ date: "2026-02-01", netWorth: 120 });
  });

  it("returns undefined for a date not in the series (out of range / no snapshot)", () => {
    expect(findChartPoint(data, "2026-03-01")).toBeUndefined();
  });

  it("returns undefined when there is no active date", () => {
    expect(findChartPoint(data, null)).toBeUndefined();
  });
});

describe("trend range table", () => {
  it("opens on the latest 90 days", () => {
    const initial = TREND_RANGES.find((r) => r.label === DEFAULT_TREND_RANGE);

    expect(initial).toBeDefined();
    expect(initial?.days).toBe(90);
    expect(initial?.ytd).toBeUndefined();
  });

  it("offers windows from one month through the full series", () => {
    expect(TREND_RANGES.map((r) => r.label)).toEqual(["1M", "3M", "6M", "YTD", "1Y", "All"]);
    expect(TREND_RANGES.find((r) => r.label === "All")?.days).toBe(Infinity);
    expect(TREND_RANGES.find((r) => r.label === "YTD")?.ytd).toBe(true);
  });
});
