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

    const openGraphImage = page.locator('meta[property="og:image"]');
    await expect(openGraphImage).toHaveAttribute("content", /\/landing\/social-preview\.png$/);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /\/landing\/social-preview\.png$/,
    );

    const socialPreviewUrl = await openGraphImage.getAttribute("content");
    expect(socialPreviewUrl).toBeTruthy();

    const imageDecoded = await page.evaluate((src) => {
      return new Promise<boolean>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth === 1200 && image.naturalHeight === 630);
        image.onerror = () => resolve(false);
        image.src = src;
      });
    }, socialPreviewUrl!);

    expect(imageDecoded).toBe(true);
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
