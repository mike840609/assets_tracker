import { expect, test, type Page } from "@playwright/test";

async function createDashboardAccount(page: Page, label: string) {
  const response = await page.request.post("/api/accounts", {
    data: {
      name: `${label} ${Date.now()}`,
      type: "ASSET",
      category: "BANK",
      currency: "USD",
      cashBalance: 1_234,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function deleteDashboardAccount(page: Page, accountId: string) {
  const response = await page.request.delete("/api/accounts", {
    data: { ids: [accountId] },
  });
  expect(response.ok()).toBeTruthy();
}

async function waitForDashboardDisclosure(page: Page) {
  const disclosure = page.getByTestId("dashboard-portfolio-details");
  await expect(async () => {
    if ((await disclosure.count()) === 0) await page.reload();
    await expect(disclosure).toBeAttached();
  }).toPass({ timeout: 20_000, intervals: [1_500, 2_000, 2_000] });
  return disclosure;
}

test("portfolio details are compact on mobile and persistently visible on desktop", async ({
  page,
}, testInfo) => {
  const accountId = await createDashboardAccount(page, "E2E Dashboard Disclosure");

  try {
    await page.goto("/");
    const details = await waitForDashboardDisclosure(page);
    const toggle = page.getByTestId("dashboard-portfolio-disclosure-toggle");

    if (testInfo.project.name === "Mobile Chrome") {
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(details).toBeHidden();

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(details).toBeVisible();

      await toggle.focus();
      await toggle.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(details).toBeHidden();
    } else {
      await expect(toggle).toBeHidden();
      await expect(details).toBeVisible();
    }
  } finally {
    await deleteDashboardAccount(page, accountId);
  }
});
