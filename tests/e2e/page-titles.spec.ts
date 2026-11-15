import { expect, test } from "@playwright/test";

// Every authenticated page has its own localized <title> (WCAG 2.4.2) instead
// of the root layout's generic one.
for (const [route, title] of [
  ["/", "Dashboard · astt"],
  ["/accounts", "Accounts · astt"],
  ["/settings", "Settings · astt"],
] as const) {
  test(`${route} has the title "${title}"`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop only");

    await page.goto(route);
    await expect(page).toHaveTitle(title);
  });
}

test("titles follow the locale", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop only");

  const url = testInfo.project.use.baseURL ?? "http://127.0.0.1:3000";
  await context.addCookies([{ name: "NEXT_LOCALE", value: "zh-TW", url }]);
  await page.goto("/accounts");
  await expect(page).toHaveTitle("帳戶 · astt");
});
