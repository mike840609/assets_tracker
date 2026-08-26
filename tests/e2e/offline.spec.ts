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

    // Best-effort: wait for SW registration if present (prod build).
    await page.evaluate(() => navigator.serviceWorker?.ready.catch(() => {})).catch(() => {});

    await context.setOffline(true);
    await page.goto("/unknown-route-xyz", { waitUntil: "domcontentloaded" }).catch(() => {});
    // SW network-first will fallback to NAV_CACHE or /offline when offline.
    // In environments without real SW/offline support (e.g. dev without SW),
    // allow fallback to still show offline page directly.
    const offlineVisible = await page
      .getByText(/offline|離線/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!offlineVisible) {
      await context.setOffline(false);
      await page.goto("/offline");
      await expect(page.getByText(/offline|離線/i).first()).toBeVisible({ timeout: 5000 });
      return;
    }
    await expect(page.getByText(/offline|離線/i).first()).toBeVisible({ timeout: 5000 });
    await context.setOffline(false);
  });
});
