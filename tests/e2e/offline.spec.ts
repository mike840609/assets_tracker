import { expect, test } from "@playwright/test";

// Service worker must be allowed for offline fallback to be testable.
// Global config blocks SW to keep page.route() mocks working for other specs.
test.use({ serviceWorkers: "allow" });

test.describe("offline fallback", () => {
  test("offline page is directly accessible", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText(/offline|離線/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("offline fallback is served when installed PWA is offline", async ({ page, context }) => {
    test.slow();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The dev server serves no service worker; skip rather than assert something
    // else, so this spec can never report green on a broken fetch handler.
    const controlled = await page
      .waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    test.skip(!controlled, "no service worker controlling the page (dev build)");

    await context.setOffline(true);
    try {
      await page.goto("/unknown-route-xyz", { waitUntil: "domcontentloaded" }).catch(() => {});
      await expect(page.getByText(/offline|離線/i).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await context.setOffline(false);
    }
  });
});
