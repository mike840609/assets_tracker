import { expect, test } from "@playwright/test";

test.describe("mobile Plan hub", () => {
  test("mobile bottom dock opens Plan with Watchlist first", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Mobile Chrome", "Mobile-only navigation flow");

    await page.goto("/accounts");

    const bottomNav = page
      .locator("nav")
      .filter({ has: page.getByRole("button", { name: "Accounts" }) });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Goals" })).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Plan" })).toHaveCount(0);

    await bottomNav.getByRole("button", { name: "Goals" }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();

    const tablist = page.getByRole("tablist");
    await expect(tablist.getByRole("tab", { name: "Watchlist" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Add stock" }).first()).toBeVisible();
  });

  test("mobile Plan subtabs switch and projection hash deep-link works", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Mobile Chrome", "Mobile-only tab flow");

    await page.goto("/goals");
    const tablist = page.getByRole("tablist");

    await tablist.getByRole("tab", { name: "Goals" }).click();
    await expect(tablist.getByRole("tab", { name: "Goals" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/\/goals#goals$/);
    await expect(page.getByRole("button", { name: "New Goal" }).first()).toBeVisible();

    await tablist.getByRole("tab", { name: "Projections" }).click();
    await expect(tablist.getByRole("tab", { name: "Projections" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/\/goals#projections$/);

    await page.goto("/goals#projections");
    await expect(tablist.getByRole("tab", { name: "Projections" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

test.describe("desktop plan split", () => {
  test("desktop Goals and Watchlist remain separate pages", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only navigation check");

    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);

    await page.goto("/stocks");
    // exact: the StocksOnboarding heading ("Start a watchlist from…") also matches a
    // substring-based "Watchlist" heading query.
    await expect(page.getByRole("heading", { name: "Watchlist", exact: true })).toBeVisible();
    await expect(page.getByText("Track stocks from a chosen price and date.")).toBeVisible();
  });
});
