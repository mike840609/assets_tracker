import { expect, test } from "@playwright/test";

test("account form controls match the viewport and input method", async ({ page, isMobile }) => {
  await page.goto("/accounts");
  await page
    .getByRole("button", { name: /^add account$/i })
    .first()
    .click();
  const form = page.getByRole("dialog");
  const height = isMobile ? "44px" : "32px";

  await expect(form.getByRole("textbox", { name: "Name", exact: true })).toHaveCSS(
    "height",
    height,
  );
  await expect(form.getByRole("combobox", { name: "Category" })).toHaveCSS("height", height);
  const create = form.getByRole("button", { name: "Create Account" });
  await expect(create).toHaveCSS("height", height);

  if (isMobile) {
    const width = 320;
    await page.setViewportSize({ width, height: 780 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(form.getByRole("button", { name: "Cancel" })).toHaveCSS("font-size", "28px");

    for (const action of [form.getByRole("button", { name: "Cancel" }), create]) {
      const bounds = await action.boundingBox();
      if (!bounds) throw new Error("Account form action is not visible");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  }
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
