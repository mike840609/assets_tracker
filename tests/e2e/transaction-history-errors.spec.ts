import { expect, test } from "@playwright/test";

test("a failed transaction load shows an error with Retry, not an empty history", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only data mutation flow");

  // An opening balance records a cash transaction, so the history is never empty.
  const created = await page.request.post("/api/accounts", {
    data: {
      name: `E2E history errors ${Date.now()}`,
      type: "ASSET",
      category: "BANK",
      currency: "USD",
      cashBalance: 1000,
    },
  });
  expect(created.ok()).toBeTruthy();
  const { data: account } = (await created.json()) as { data: { id: string } };

  try {
    await page.route("**/api/accounts/*/transactions?**", (route) => route.abort());
    await page.goto(`/accounts/${account.id}`);

    await expect(page.getByText("Couldn't load transactions.")).toBeVisible();
    await expect(page.getByText("No transactions yet.")).toHaveCount(0);

    await page.unroute("**/api/accounts/*/transactions?**");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Couldn't load transactions.")).toHaveCount(0);
    await expect(page.getByText("Opening balance")).toBeVisible();
  } finally {
    await page.request.delete(`/api/accounts/${account.id}`);
  }
});
