import { describe, it, expect } from "vitest";
import { buildCategoryChart } from "@/components/analysis/category-trend-chart";

describe("buildCategoryChart", () => {
  const point = {
    monthKey: "2026-11",
    BANK: 600,
    BROKERAGE: 500,
    CRYPTO_WALLET: 400,
    PROPERTY: 300,
    VEHICLE: 200,
    OTHER: 100,
  };

  it("draws the five largest categories but totals all of them", () => {
    const { visibleCategories, chartData } = buildCategoryChart([point], "en-US");
    expect(visibleCategories).toEqual([
      "BANK",
      "BROKERAGE",
      "CRYPTO_WALLET",
      "PROPERTY",
      "VEHICLE",
    ]);
    expect(chartData[0]).not.toHaveProperty("OTHER");
    expect(chartData[0].total).toBe(2100);
  });

  it("leaves the total empty for padded months so the gap stays a gap", () => {
    const { chartData } = buildCategoryChart([{ monthKey: "2026-10" }, point], "en-US");
    expect(chartData[0].total).toBeNull();
  });
});
