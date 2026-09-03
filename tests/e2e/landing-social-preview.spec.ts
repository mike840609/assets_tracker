import { expect, test, type Browser } from "@playwright/test";

async function openAnonymousPage(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  return { context, page };
}

test("landing uses its own page-style social preview", async ({ browser }) => {
  const { context, page } = await openAnonymousPage(browser);

  try {
    await page.goto("/");

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/landing\/social-preview\.png$/,
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /\/landing\/social-preview\.png$/,
    );
  } finally {
    await context.close();
  }
});

test("other public routes keep the default social preview", async ({ browser }) => {
  const { context, page } = await openAnonymousPage(browser);

  try {
    await page.goto("/login");

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/opengraph-image\.png$/,
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /\/twitter-image\.png$/,
    );
  } finally {
    await context.close();
  }
});
