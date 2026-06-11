import { expect, test, type Page } from "@playwright/test";

async function ensureSignedIn(page: Page) {
  await page.goto("/stocks");
  if (!page.url().includes("/login")) return;

  const previewLoginButton = page.getByRole("button", { name: "Preview Login" });
  await previewLoginButton.waitFor({ timeout: 30_000 });
  const passwordInput = page.locator('input[name="password"]');
  if (await passwordInput.count()) {
    await passwordInput.fill(process.env.E2E_PASSWORD ?? "e2e-smoke-test");
  }
  await previewLoginButton.click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30_000 });
  await page.goto("/stocks");
}

function trackingPeriodLabel(recordDate: string) {
  const [year, month, day] = recordDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  if (days === 0) return "Tracked today";
  if (days === 1) return "Tracked for 1 day";
  return `Tracked for ${days} days`;
}

test.describe("stock tracker", () => {
  test("empty state, add stock, duplicate validation, and refresh failure", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only data mutation flow");

    await ensureSignedIn(page);

    const existingRes = await page.request.get("/api/stocks");
    expect(existingRes.ok()).toBeTruthy();
    const existingBody = (await existingRes.json()) as {
      data: Array<{ id: string; symbol: string }>;
    };
    for (const stock of existingBody.data) {
      const deleteRes = await page.request.delete(`/api/stocks/${stock.id}`);
      expect(deleteRes.ok()).toBeTruthy();
    }

    await page.goto("/stocks");
    // The bare empty state was replaced by StocksOnboarding (stocks-onboarding.tsx).
    await expect(
      page.getByRole("heading", { name: "Start a watchlist from your own reference price." }),
    ).toBeVisible();
    await expect(page.getByText("No tracked stocks")).toBeVisible();

    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              symbol: "AAPL",
              name: "Apple Inc.",
              exchange: "NasdaqGS",
              type: "STOCK",
              currency: "USD",
            },
          ],
        }),
      });
    });

    await page.route("**/api/stocks/quote?symbol=AAPL", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            symbol: "AAPL",
            name: "Apple Inc.",
            exchange: "NasdaqGS",
            currency: "USD",
            price: 200,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.getByRole("button", { name: "Add stock" }).first().click();
    await page.getByRole("combobox", { name: "Search stock" }).fill("Apple");
    await page.getByRole("option", { name: /AAPL/i }).click();
    await page.getByLabel("Record date").fill("2026-06-01");
    await page.getByLabel("Note").fill("E2E stock tracker note");
    await page.getByRole("button", { name: "Save stock" }).click();

    await expect(async () => {
      await page.reload();
      await expect(page.getByText("AAPL").filter({ visible: true }).first()).toBeVisible();
      await expect(
        page.getByText("E2E stock tracker note").filter({ visible: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText(trackingPeriodLabel("2026-06-01")).filter({ visible: true }).first(),
      ).toBeVisible();
    }).toPass({ timeout: 30_000, intervals: [1500, 2000, 2500] });

    const duplicateRes = await page.request.post("/api/stocks", {
      data: {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NasdaqGS",
        currency: "USD",
        recordPrice: 200,
        recordDate: "2026-06-01",
        note: "Duplicate",
      },
    });
    expect(duplicateRes.status()).toBe(409);

    await page.route("**/api/stocks/refresh", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Refresh failed" } }),
      });
    });

    await page.getByRole("button", { name: "Refresh prices" }).click();
    await expect(page.getByText("Failed to refresh stock prices")).toBeVisible();
    await expect(page.getByText("AAPL").first()).toBeVisible();

    const finalRes = await page.request.get("/api/stocks");
    expect(finalRes.ok()).toBeTruthy();
    const finalBody = (await finalRes.json()) as { data: Array<{ id: string; symbol: string }> };
    for (const stock of finalBody.data.filter((item) => item.symbol === "AAPL")) {
      await page.request.delete(`/api/stocks/${stock.id}`);
    }
  });

  test("mobile layout keeps stock actions above the bottom navigation", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Mobile Chrome", "Mobile-only layout check");

    await ensureSignedIn(page);
    const addButton = page.getByRole("button", { name: "Add stock" }).first();
    await expect(addButton).toBeVisible();

    const nav = page.locator("nav").filter({ has: page.getByRole("button", { name: "Accounts" }) });
    await expect(nav).toBeVisible();

    const buttonBox = await addButton.boundingBox();
    const navBox = await nav.boundingBox();
    expect(buttonBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThan(navBox!.y);
  });
});
