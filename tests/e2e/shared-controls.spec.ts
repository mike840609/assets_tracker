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

test("mobile account rows reflow long names and balances at 200% text size", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile account row");
  const name = `Long-term international brokerage account ${Date.now()}`;
  const created = await page.request.post("/api/accounts", {
    data: { name, type: "ASSET", category: "BANK", currency: "USD", cashBalance: 123456789012 },
  });
  expect(created.ok()).toBeTruthy();
  const { data: account } = (await created.json()) as { data: { id: string } };
  try {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/accounts");
    const link = page.getByRole("link").filter({ hasText: name });
    await expect(async () => {
      if (!(await link.isVisible())) await page.reload();
      await expect(link).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 12_000 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const title = link.getByText(name, { exact: true });
    const balance = link.getByText(/123,456,789,012/).last();
    const menu = page.getByRole("button", { name: `Actions for ${name}` });
    await expect(title).toHaveCSS("font-size", "28px");

    const [titleBox, balanceBox, menuBox] = await Promise.all([
      title.boundingBox(),
      balance.boundingBox(),
      menu.boundingBox(),
    ]);
    if (!titleBox || !balanceBox || !menuBox) throw new Error("Missing account row controls");
    expect(titleBox.width).toBeGreaterThanOrEqual(100);
    expect(balanceBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
    expect(balanceBox.x + balanceBox.width).toBeLessThan(menuBox.x);
    expect(menuBox.width).toBeGreaterThanOrEqual(44);
    expect(menuBox.height).toBeGreaterThanOrEqual(44);
  } finally {
    await page.request.delete(`/api/accounts/${account.id}`);
  }
});
