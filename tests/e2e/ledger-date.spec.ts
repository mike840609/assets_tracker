import { expect, test } from "@playwright/test";

for (const timezoneId of ["Asia/Taipei", "UTC", "America/New_York", "America/Los_Angeles"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    test("generated investment dates retain their calendar day", async ({ page, request }) => {
      const response = await request.post("/api/accounts", {
        data: {
          name: `E2E ledger ${Date.now()}`,
          type: "ASSET",
          category: "BROKERAGE",
          currency: "USD",
          cashBalance: 1000,
        },
      });
      expect(response.status()).toBe(201);
      const account = (await response.json()).data;
      const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      try {
        const rule = await request.post(`/api/accounts/${account.id}/recurring-investments`, {
          data: {
            symbol: "AAPL",
            name: "Apple",
            assetType: "STOCK",
            holdingCurrency: "USD",
            amount: 100,
            frequency: "WEEKLY",
            startDate: day,
          },
        });
        expect(rule.status()).toBe(201);
        await expect
          .poll(async () => {
            const ledger = await request.get(`/api/accounts/${account.id}/transactions`);
            return (await ledger.json()).data.transactions.find(
              (tx: { isCash: boolean }) => !tx.isCash,
            )?.occurrenceDate;
          })
          .toBe(`${day}T00:00:00.000Z`);
        await page.goto(`/accounts/${account.id}`);
        const history = page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Transaction History", { exact: true }) });
        await history.getByRole("button", { name: "Actions for AAPL", exact: true }).click();
        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Edit Transaction" });
        await expect(dialog.getByLabel("Date", { exact: true })).toBeDisabled();
        await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(`${day}T00:00`);
        await dialog.getByLabel("Note", { exact: true }).fill("date preserved");
        await dialog.getByRole("button", { name: "Save", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        const ledger = (
          await (await request.get(`/api/accounts/${account.id}/transactions`)).json()
        ).data;
        expect(
          ledger.transactions.find((tx: { isCash: boolean }) => !tx.isCash)?.occurrenceDate,
        ).toBe(`${day}T00:00:00.000Z`);
      } finally {
        await request.delete(`/api/accounts/${account.id}`);
      }
    });
  });
}
