import { expect, test } from "@playwright/test";
import {
  cleanupAnalysisFixture,
  authenticateAnalysisFixture,
  hasAnalysisFixtureDatabase,
  seedAnalysisFixture,
  setAnalysisFixtureLocale,
} from "./analysis-fixture";

test.describe.configure({ mode: "serial" });

test("analysis renders populated desktop charts without layout overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Populated Analysis QA is desktop-only.");
  test.skip(!hasAnalysisFixtureDatabase(), "Populated Analysis QA requires DATABASE_URL.");

  const fixture = await seedAnalysisFixture();

  try {
    await authenticateAnalysisFixture(page.context(), fixture);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/analysis");

    await expect(page.getByText("Assets vs. Liabilities by Month")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Latest snapshot vs. Jan 1")).toBeVisible();
    await page.mouse.wheel(0, 1200);
    // Section headings carry the active range as a suffix (e.g. "Composition YTD"),
    // so anchor at the start to avoid matching "Cash Flow Decomposition".
    await expect(page.getByRole("heading", { name: /^Movement/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Composition/ })).toBeVisible();
    await expect(page.getByText("Performance Attribution")).toBeVisible();

    const allRangeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/analysis/series?range=All") && response.status() === 200,
    );
    await page.getByRole("button", { name: "All", exact: true }).click();
    await allRangeResponse;
    await page.mouse.wheel(0, 1200);
    await expect(page.getByText("Showing top 5 of 7 categories by latest value.")).toBeVisible();
    await page.getByRole("button", { name: "YTD", exact: true }).click();
    await expect(page.getByRole("button", { name: "YTD", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

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
        movementHeightDiff: Math.abs(
          cardHeight("Cash Flow Decomposition") - cardHeight("Cumulative Growth"),
        ),
        compositionHeightDiff: Math.abs(
          cardHeight("Category Trend") - cardHeight("Performance Attribution"),
        ),
      };
    });

    expect(layout.hasHorizontalOverflow).toBeFalsy();
    expect(layout.chartCount).toBeGreaterThanOrEqual(5);
    expect(layout.movementHeightDiff).toBeLessThanOrEqual(8);
    expect(layout.compositionHeightDiff).toBeLessThanOrEqual(8);

    await testInfo.attach("analysis-populated-desktop", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  } finally {
    await cleanupAnalysisFixture(fixture);
  }
});

function oldestMonthLabel(snapshotDates: readonly string[], locale: string): string {
  const oldestDate = snapshotDates[0];
  if (!oldestDate) throw new Error("Analysis fixture must contain at least one snapshot date.");
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(
    new Date(`${oldestDate}T00:00:00.000Z`),
  );
}

test("analysis falls back to the server default range for an unknown persisted range", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Populated Analysis QA is desktop-only.");
  test.skip(!hasAnalysisFixtureDatabase(), "Populated Analysis QA requires DATABASE_URL.");
  const fixture = await seedAnalysisFixture();

  try {
    await authenticateAnalysisFixture(page.context(), fixture);
    await setAnalysisFixtureLocale(page.context(), "en-US");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() =>
      sessionStorage.setItem("asset-tracker:range:analysis-view", "BOGUS_RANGE"),
    );
    await page.goto("/analysis");
    await expect(page.getByRole("heading", { name: /^Movement/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { pressed: true })).toHaveCount(1);
    const pressedName = await page.getByRole("button", { pressed: true }).innerText();
    expect(pressedName).toBe(fixture.expectedDefaultRange);
  } finally {
    await cleanupAnalysisFixture(fixture);
  }
});

test("renders both locales' month labels from one cached payload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Populated Analysis QA is desktop-only.");
  test.skip(!hasAnalysisFixtureDatabase(), "Populated Analysis QA requires DATABASE_URL.");
  // Both loads run as the same user inside the payload's 300s revalidate
  // window, so the zh-TW render is served from the entry the en-US render
  // filled. That shared entry is the point: if any locale-formatted value
  // creeps back into the payload, the second assertion sees English labels.
  // Seeding per locale would give each load its own cache key and prove nothing.
  const fixture = await seedAnalysisFixture();

  try {
    await authenticateAnalysisFixture(page.context(), fixture);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() =>
      sessionStorage.setItem("asset-tracker:range:analysis-view", "All"),
    );

    await setAnalysisFixtureLocale(page.context(), "en-US");
    const englishRangeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/analysis/series?range=All") && response.status() === 200,
    );
    await page.goto("/analysis");
    await englishRangeResponse;
    await page.mouse.wheel(0, 1200);
    const englishCard = page
      .locator('[data-slot="card"]')
      .filter({
        has: page.getByRole("heading", { name: "Cash Flow Decomposition", exact: true }),
      })
      .first();
    await expect(
      englishCard.getByRole("heading", { name: "Cash Flow Decomposition", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      englishCard.locator("svg").getByText(oldestMonthLabel(fixture.snapshotDates, "en-US"), {
        exact: true,
      }),
    ).toBeVisible();

    await setAnalysisFixtureLocale(page.context(), "zh-TW");
    const chineseRangeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/analysis/series?range=All") && response.status() === 200,
    );
    await page.reload();
    await chineseRangeResponse;
    await page.mouse.wheel(0, 1200);
    const chineseCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "現金流分解", exact: true }) })
      .first();
    await expect(
      chineseCard.locator("svg").getByText(oldestMonthLabel(fixture.snapshotDates, "zh-TW"), {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      chineseCard.locator("svg").getByText(oldestMonthLabel(fixture.snapshotDates, "en-US"), {
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await cleanupAnalysisFixture(fixture);
  }
});
