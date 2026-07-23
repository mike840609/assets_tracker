import { describe, expect, it } from "vitest";
import { findChartPoint } from "@/components/dashboard/trend-chart-utils";

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
