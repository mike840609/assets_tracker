import { describe, expect, it } from "vitest";
import {
  attachMonthLabels,
  formatChartTick,
  formatMonthLabel,
  getMonthTickInterval,
  niceTicks,
} from "@/lib/chart-formatters";

describe("chart-formatters", () => {
  describe("formatMonthLabel", () => {
    it("formats ISO month keys into short localized month labels", () => {
      expect(formatMonthLabel("2026-04", "en-US")).toBe("Apr 2026");
      expect(formatMonthLabel("2026-04", "zh-TW")).toBe("2026年4月");
    });

    it("falls back gracefully for invalid month strings", () => {
      expect(formatMonthLabel("not-a-month")).toBe("not-a-month");
      expect(formatMonthLabel("2026")).toBe("2026");
    });
  });

  describe("attachMonthLabels", () => {
    it("attaches formatted label to array of objects with monthKey", () => {
      const data = [
        { monthKey: "2026-01", value: 100 },
        { monthKey: "2026-02", value: 200 },
      ];
      const labeled = attachMonthLabels(data, "en-US");
      expect(labeled).toEqual([
        { monthKey: "2026-01", value: 100, label: "Jan 2026" },
        { monthKey: "2026-02", value: 200, label: "Feb 2026" },
      ]);
    });
  });

  describe("formatChartTick & getMonthTickInterval", () => {
    it("formats ticks with K and M abbreviations", () => {
      expect(formatChartTick(500)).toBe("500");
      expect(formatChartTick(50_000)).toBe("50K");
      expect(formatChartTick(2_500_000)).toBe("2.5M");
    });

    it("keeps neighbouring ticks distinct when given the axis step", () => {
      const { ticks, step } = niceTicks(1_820_000, 2_120_000);
      const labels = ticks.map((t) => formatChartTick(t, step));
      expect(new Set(labels).size).toBe(labels.length);
      expect(ticks[0]).toBeLessThanOrEqual(1_820_000);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(2_120_000);
      expect(formatChartTick(1_950_000, 50_000)).toBe("1.95M");
      expect(formatChartTick(64_200, 200)).toBe("64.2K");
    });

    it.each([
      [1_999_990, 2_000_010],
      [999, 1_001],
      [63_800, 64_100],
      [-2_050_000, -1_950_000],
    ])("labels a near-flat span %d..%d with distinct, short ticks", (min, max) => {
      const { ticks, step } = niceTicks(min, max);
      const labels = ticks.map((t) => formatChartTick(t, step));
      expect(new Set(labels).size, labels.join(" | ")).toBe(labels.length);
      // The axis is 42px wide; keep labels to ~6 characters.
      for (const label of labels) expect(label.length, label).toBeLessThanOrEqual(6);
    });

    it("calculates tick interval correctly", () => {
      expect(getMonthTickInterval(4, 6)).toBe(0);
      expect(getMonthTickInterval(18, 6)).toBe(2);
    });
  });
});
