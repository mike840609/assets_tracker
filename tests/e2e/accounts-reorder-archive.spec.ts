import { expect, test } from "@playwright/test";

function extractTrackedNames(texts: string[], prefix: string) {
  return texts.map((text) => text.trim()).filter((text) => text.includes(prefix));
}

test("account pin + reorder + archive/unarchive flow persists", async ({ page }) => {
  test.skip(
    page.viewportSize()?.width ? page.viewportSize()!.width < 1024 : false,
    "Desktop-only flow",
  );

  const suffix = Date.now().toString();
  const prefix = `E2E Order ${suffix}`;
  const names = [`${prefix} A`, `${prefix} B`, `${prefix} C`];

  const created: Array<{ id: string; name: string }> = [];
  for (const name of names) {
    const res = await page.request.post("/api/accounts", {
      data: {
        name,
        type: "ASSET",
        category: "BROKERAGE",
        currency: "USD",
        cashBalance: 0,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    created.push({ id: body.data.id, name });
  }

  const idA = created.find((a) => a.name === names[0])!.id;
  const idB = created.find((a) => a.name === names[1])!.id;
  const idC = created.find((a) => a.name === names[2])!.id;

  // Pin B
  const pinRes = await page.request.patch(`/api/accounts/${idB}`, {
    data: { isPinned: true },
  });
  expect(pinRes.ok()).toBeTruthy();

  await page.goto("/accounts");
  await expect(async () => {
    await page.reload();
    const firstColTexts = await page.locator("tbody tr td:first-child").allTextContents();
    const ordered = extractTrackedNames(firstColTexts, prefix);
    expect(ordered[0]).toContain(names[1]);
  }).toPass({ timeout: 20_000, intervals: [1200, 1800, 2200] });

  // Reorder unpinned to C then A
  const activeAssetsRes = await page.request.get("/api/accounts");
  expect(activeAssetsRes.ok()).toBeTruthy();
  const activeAssetsBody = await activeAssetsRes.json();
  const ourIds = new Set([idA, idB, idC]);
  const activeAssets = activeAssetsBody.data.filter(
    (account: { id: string; type: string; isActive: boolean; isPinned: boolean }) =>
      account.type === "ASSET" && account.isActive,
  ) as Array<{ id: string; isPinned: boolean }>;
  const pinnedIds = [
    ...activeAssets
      .filter((account) => account.isPinned && !ourIds.has(account.id))
      .map((account) => account.id),
    idB,
  ];
  const unpinnedIds = [
    idC,
    idA,
    ...activeAssets
      .filter((account) => !account.isPinned && !ourIds.has(account.id))
      .map((account) => account.id),
  ];

  const reorderRes = await page.request.patch("/api/accounts/reorder", {
    data: {
      type: "ASSET",
      pinnedIds,
      unpinnedIds,
    },
  });
  expect(reorderRes.ok()).toBeTruthy();

  await expect(async () => {
    await page.reload();
    const firstColTexts = await page.locator("tbody tr td:first-child").allTextContents();
    const ordered = extractTrackedNames(firstColTexts, prefix);
    expect(ordered[0]).toContain(names[1]);
    expect(ordered[1]).toContain(names[2]);
    expect(ordered[2]).toContain(names[0]);
  }).toPass({ timeout: 20_000, intervals: [1200, 1800, 2200] });

  // Archive A
  const archiveRes = await page.request.patch(`/api/accounts/${idA}`, {
    data: { isActive: false },
  });
  expect(archiveRes.ok()).toBeTruthy();

  await expect(async () => {
    await page.reload();
    const firstColTexts = await page.locator("tbody tr td:first-child").allTextContents();
    const ordered = extractTrackedNames(firstColTexts, prefix);
    expect(ordered.some((name) => name.includes(names[0]))).toBeFalsy();
  }).toPass({ timeout: 20_000, intervals: [1200, 1800, 2200] });

  await page.getByRole("button", { name: /Archived Accounts/i }).click();
  await expect(page.getByText(names[0])).toBeVisible();

  // Unarchive A
  const unarchiveRes = await page.request.patch(`/api/accounts/${idA}`, {
    data: { isActive: true },
  });
  expect(unarchiveRes.ok()).toBeTruthy();

  await expect(async () => {
    await page.reload();
    const firstColTexts = await page.locator("tbody tr td:first-child").allTextContents();
    const ordered = extractTrackedNames(firstColTexts, prefix);
    expect(ordered.some((name) => name.includes(names[0]))).toBeTruthy();
  }).toPass({ timeout: 20_000, intervals: [1200, 1800, 2200] });

  await page.request.delete("/api/accounts", {
    data: { ids: [idA, idB, idC] },
  });
});
