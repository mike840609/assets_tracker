import { expect, test } from "@playwright/test";

// Signed-out: this spec exercises the login form itself.
test.use({ storageState: { cookies: [], origins: [] } });

test("a wrong password shows an inline error instead of the global error page", async ({
  page,
}, testInfo) => {
  // One wrong attempt per run: password attempts are throttled per IP, and every
  // E2E client shares the same address.
  test.skip(
    testInfo.project.name !== "chromium",
    "Desktop only; keeps attempts under the throttle",
  );

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Internal test password" }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Internal Test Login" }).click();

  await expect(page).toHaveURL(/\/login\?error=CredentialsSignin$/);
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect password" })).toHaveText(
    "Incorrect password. Please try again.",
  );
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});
