import { describe, expect, it } from "vitest";
import {
  attachMonthLabels,
  formatChartTick,
  formatMonthLabel,
  getMonthTickInterval,
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

    it("calculates tick interval correctly", () => {
      expect(getMonthTickInterval(4, 6)).toBe(0);
      expect(getMonthTickInterval(18, 6)).toBe(2);
    });
  });
});
