import { expect, test } from "@playwright/test";

test("landing uses its own page-style social preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/landing\/social-preview\.png$/,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    /\/landing\/social-preview\.png$/,
  );
});

test("other public routes keep the default social preview", async ({ page }) => {
  await page.goto("/login");

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image\.png$/,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    /\/twitter-image\.png$/,
  );
});
