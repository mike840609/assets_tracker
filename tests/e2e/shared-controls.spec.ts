import { expect, test } from "@playwright/test";

test("account form controls match the viewport and input method", async ({ page, isMobile }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add Account", exact: true }).first().click();
  const form = page.getByRole("dialog");
  const height = isMobile ? "44px" : "32px";

  await expect(form.getByRole("textbox", { name: "Name", exact: true })).toHaveCSS(
    "height",
    height,
  );
  await expect(form.getByRole("combobox", { name: "Category" })).toHaveCSS("height", height);
  await expect(form.getByRole("button", { name: "Create Account" })).toHaveCSS("height", height);
});

test("language selector and options use the shared control heights", async ({ page, isMobile }) => {
  await page.goto("/settings");
  const language = page.locator("#language-select");

  await expect(language).toHaveCSS("height", isMobile ? "44px" : "32px");
  await language.click();
  await expect(page.getByRole("option", { name: "English", exact: true })).toHaveCSS(
    "height",
    isMobile ? "44px" : "28px",
  );
});
