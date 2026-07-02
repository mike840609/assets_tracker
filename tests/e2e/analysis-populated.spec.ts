import { expect, test } from "@playwright/test";
import {
  cleanupAnalysisFixture,
  hasAnalysisFixtureDatabase,
  seedAnalysisFixture,
} from "./analysis-fixture";

test("analysis renders populated desktop charts without layout overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Populated Analysis QA is desktop-only.");
  test.skip(!hasAnalysisFixtureDatabase(), "Populated Analysis QA requires DATABASE_URL.");

  const fixture = await seedAnalysisFixture();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/analysis");

    await expect(page.getByText("Assets vs. Liabilities by Month")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Latest snapshot vs. Jan 1")).toBeVisible();
    // Section headings carry the active range as a suffix (e.g. "Composition YTD"),
    // so anchor at the start to avoid matching "Cash Flow Decomposition".
    await expect(page.getByRole("heading", { name: /^Movement/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Composition/ })).toBeVisible();
    await expect(page.getByText("Performance Attribution")).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText("Showing top 5 of 7 categories by latest value.")).toBeVisible();

    const layout = await page.evaluate(() => {
      const documentElement = document.documentElement;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="card"]')).map(
        (card) => {
          const rect = card.getBoundingClientRect();
          return {
            text: card.textContent ?? "",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        },
      );

      function cardHeight(title: string) {
        return cards.find((card) => card.text.includes(title))?.height ?? 0;
      }

      return {
        chartCount: document.querySelectorAll(".recharts-surface").length,
        hasHorizontalOverflow: documentElement.scrollWidth > documentElement.clientWidth,
        monthlyCashHeightDiff: Math.abs(
          cardHeight("Monthly Net Worth Change") - cardHeight("Cash Flow Decomposition"),
        ),
        compositionHeightDiff: Math.abs(
          cardHeight("Category Trend") - cardHeight("Performance Attribution"),
        ),
      };
    });

    expect(layout.hasHorizontalOverflow).toBeFalsy();
    expect(layout.chartCount).toBeGreaterThanOrEqual(5);
    expect(layout.monthlyCashHeightDiff).toBeLessThanOrEqual(8);
    expect(layout.compositionHeightDiff).toBeLessThanOrEqual(8);

    await testInfo.attach("analysis-populated-desktop", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  } finally {
    await cleanupAnalysisFixture(fixture);
  }
});
