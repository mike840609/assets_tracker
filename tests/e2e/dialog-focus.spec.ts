import { expect, test } from "@playwright/test";

// Closing a dialog must return keyboard focus to the button that opened it.
// Covers both failure modes that once dropped focus to <body>: a lazily loaded
// dialog (Add Account) and a dialog whose field uses autoFocus (Add stock).
for (const [route, trigger] of [
  ["/accounts", "Add Account"],
  ["/stocks", "Add stock"],
] as const) {
  test(`Escape returns focus to "${trigger}"`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop dialogs");

    await page.goto(route);
    const opener = page.getByRole("button", { name: trigger, exact: true }).first();
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}
