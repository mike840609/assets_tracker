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

    // Navigate to the image directly rather than loading it as an <img> on the
    // landing page: on preview deployments it resolves to a different host
    // (see getAppAssetUrl), and the app's img-src CSP would block that
    // cross-origin subresource load even though real link-unfurlers (which
    // fetch og:image over plain HTTP, unaffected by this page's CSP) load it fine.
    await page.goto(socialPreviewUrl!);
    const dimensions = await page.evaluate(() => {
      const image = document.querySelector("img");
      return image ? { width: image.naturalWidth, height: image.naturalHeight } : null;
    });

    expect(dimensions).toEqual({ width: 1200, height: 630 });
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
