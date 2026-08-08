import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";

type SessionBody = {
  user: { id: string; isDemo: boolean; demoExpiresAt: string | null };
};

type ApiEnvelope<T> = { data: T };

type Account = { id: string; name: string };

async function responseData<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok()).toBe(true);
  return ((await response.json()) as ApiEnvelope<T>).data;
}

async function startDemo(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: /Try the Demo|免登入體驗 Demo/ }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  await expect(
    page
      .getByText(/Demo mode|Demo 模式/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
}

async function demoSession(page: Page) {
  const sessionResponse = await page.request.get("/api/auth/session");
  expect(sessionResponse.ok()).toBe(true);
  const session = (await sessionResponse.json()) as SessionBody;
  expect(session.user.isDemo).toBe(true);
  expect(session.user.demoExpiresAt).not.toBeNull();
  return session;
}

async function signInWithInternalTestLogin(page: Page) {
  const button = page.getByRole("button", { name: "Internal Test Login" });
  const password = process.env.E2E_PASSWORD ?? "e2e-smoke-test";

  if (new URL(page.url()).searchParams.get("from") === "demo") {
    await expect(button).toBeVisible({ timeout: 60_000 });
    const passwordInput = page.getByLabel("Internal test password");
    if (await passwordInput.count()) await passwordInput.fill(password);
    await button.click();
    await page.waitForURL((url) => url.pathname === "/login" && !url.searchParams.has("from"), {
      timeout: 60_000,
    });
  }

  await expect(button).toBeVisible({ timeout: 60_000 });
  const passwordInput = page.getByLabel("Internal test password");
  if (await passwordInput.count()) await passwordInput.fill(password);
  await button.click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

async function expireDemoWorkspace(userId: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for isolated public Demo E2E");
  const parsed = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Public Demo E2E expiry requires a disposable local PostgreSQL database");
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query(
      'UPDATE "DemoWorkspace" SET "expiresAt" = CURRENT_TIMESTAMP WHERE "userId" = $1',
      [userId],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

test.describe.configure({ mode: "serial" });

test("public Demo journey", async ({ browser, page }, testInfo) => {
  test.setTimeout(180_000);
  if (testInfo.project.name === "Public Demo Mobile zh-TW") {
    await startDemo(page);
    const banner = page.locator("section.bg-amber-200");
    await expect(banner).toBeVisible();
    await expect(page.getByText("Demo 模式").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "重設資料" })).toBeVisible();
    await expect(page.getByRole("link", { name: "登入" })).toBeVisible();
    await expect(page.getByRole("button", { name: "離開 Demo" })).toBeVisible();

    const mobileBanner = banner.locator("div.md\\:hidden");
    await expect(mobileBanner).toBeVisible();
    const expiryRow = mobileBanner.locator("p").first();
    const actionRow = mobileBanner.locator("div.grid");
    const expiryBox = await expiryRow.boundingBox();
    const actionBox = await actionRow.boundingBox();
    expect(expiryBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(expiryBox!.y + expiryBox!.height).toBeLessThanOrEqual(actionBox!.y + 1);

    const actionBoxes = await Promise.all(
      [
        page.getByRole("button", { name: "重設資料" }),
        page.getByRole("link", { name: "登入" }),
        page.getByRole("button", { name: "離開 Demo" }),
      ].map((action) => action.boundingBox()),
    );
    expect(actionBoxes.every((box) => box !== null)).toBe(true);
    const actionWidths = actionBoxes.map((box) => box!.width);
    expect(Math.max(...actionWidths) - Math.min(...actionWidths)).toBeLessThanOrEqual(1);

    const settings = await responseData<{ baseCurrency: string }>(
      await page.request.get("/api/settings"),
    );
    expect(settings.baseCurrency).toBe("USD");

    const nav = page.locator("nav").filter({ has: page.getByRole("button", { name: "帳戶" }) });
    await expect(nav).toBeVisible();
    const bannerBox = await banner.boundingBox();
    const navBox = await nav.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(bannerBox!.y + bannerBox!.height).toBeLessThan(navBox!.y);

    await page.getByRole("button", { name: "重設資料" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "要重設 Demo 資料嗎？" })).toBeVisible();
    await page.getByRole("button", { name: "保留目前資料" }).click();
    return;
  }

  expect(testInfo.project.name).toBe("Public Demo Desktop");
  await startDemo(page);
  const firstSession = await demoSession(page);
  const originalExpiry = firstSession.user.demoExpiresAt!;
  const browserExpiry = await page.evaluate(
    (expiry) =>
      new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(expiry),
      ),
    originalExpiry,
  );

  await expect(page.getByTestId("net-worth-card")).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText(`Expires ${browserExpiry}`, { exact: false }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset data" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit Demo" })).toBeVisible();
  expect((await responseData<Account[]>(await page.request.get("/api/accounts"))).length).toBe(5);

  const suffix = Date.now().toString(36).toUpperCase();
  const uniqueAccountName = `E2E Demo isolation ${suffix}`;
  const account = await responseData<Account>(
    await page.request.post("/api/accounts", {
      data: {
        name: uniqueAccountName,
        type: "ASSET",
        category: "BROKERAGE",
        currency: "USD",
        cashBalance: 0,
      },
    }),
  );
  const holdingSymbol = `E2EH${suffix}`;
  await responseData(
    await page.request.post(`/api/accounts/${account.id}/holdings`, {
      data: {
        symbol: holdingSymbol,
        name: "E2E Demo Holding",
        quantity: 1,
        unitPrice: 1,
        currency: "USD",
        assetType: "STOCK",
      },
    }),
  );
  const goal = await responseData<{ id: string }>(
    await page.request.post("/api/goals", {
      data: {
        name: `E2E Demo Goal ${suffix}`,
        targetAmount: 1,
        targetCurrency: "USD",
        targetDate: null,
        scope: "NET_WORTH",
        scopeRefId: null,
      },
    }),
  );
  const stock = await responseData<{ id: string }>(
    await page.request.post("/api/stocks", {
      data: {
        symbol: `E2ES${suffix}`,
        name: "E2E Demo Stock",
        exchange: "E2E",
        currency: "USD",
        recordPrice: 1,
        recordDate: "2026-08-01",
        note: "E2E Demo isolation",
      },
    }),
  );
  const calendar = await responseData<{ id: string }>(
    await page.request.post("/api/calendar-entries", {
      data: {
        title: `E2E Demo Calendar ${suffix}`,
        eventDate: "2026-08-01",
        startTimeMinutes: null,
        timeZone: null,
        category: "REMINDER",
        description: null,
        sourceUrl: null,
      },
    }),
  );

  await page.reload();
  const persistedAccounts = await responseData<Account[]>(await page.request.get("/api/accounts"));
  expect(persistedAccounts.some(({ name }) => name === uniqueAccountName)).toBe(true);
  expect(
    (
      await responseData<Array<{ symbol: string }>>(
        await page.request.get(`/api/accounts/${account.id}/holdings`),
      )
    ).some(({ symbol }) => symbol === holdingSymbol),
  ).toBe(true);
  expect(
    (await responseData<Array<{ id: string }>>(await page.request.get("/api/goals"))).some(
      ({ id }) => id === goal.id,
    ),
  ).toBe(true);
  expect(
    (await responseData<Array<{ id: string }>>(await page.request.get("/api/stocks"))).some(
      ({ id }) => id === stock.id,
    ),
  ).toBe(true);
  expect(
    (
      await responseData<Array<{ id: string }>>(
        await page.request.get("/api/calendar-entries?from=2026-08-01&to=2026-08-01"),
      )
    ).some(({ id }) => id === calendar.id),
  ).toBe(true);

  const secondContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: "en-US",
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.101" },
  });
  const secondPage = await secondContext.newPage();
  try {
    await startDemo(secondPage);
    const secondSession = await demoSession(secondPage);
    const secondAccountsBefore = await responseData<Account[]>(
      await secondPage.request.get("/api/accounts"),
    );

    expect((await secondPage.request.get(`/api/accounts/${account.id}`)).status()).toBe(404);
    expect(
      (
        await secondPage.request.patch(`/api/accounts/${account.id}`, {
          data: { name: "cross-workspace mutation" },
        })
      ).status(),
    ).toBe(404);
    expect((await secondPage.request.get(`/api/accounts/${account.id}/holdings`)).status()).toBe(
      404,
    );
    const secondAccountsAfter = await responseData<Account[]>(
      await secondPage.request.get("/api/accounts"),
    );
    const secondWorkspaceUnchanged =
      secondAccountsAfter.length === secondAccountsBefore.length &&
      secondAccountsAfter.every(({ id }, index) => id === secondAccountsBefore[index]?.id);
    expect(secondWorkspaceUnchanged).toBe(true);
    expect(
      (await responseData<Account[]>(await page.request.get("/api/accounts"))).some(
        ({ name }) => name === uniqueAccountName,
      ),
    ).toBe(true);

    const exportResponse = await page.request.get("/api/settings/data");
    expect(exportResponse.status()).toBe(403);
    const exportBody = (await exportResponse.json()) as { error?: { code?: unknown } };
    expect(exportBody.error?.code === "DEMO_RESTRICTED").toBe(true);
    const importResponse = await page.request.fetch("/api/settings/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      data: "{ definitely not valid JSON",
    });
    expect(importResponse.status()).toBe(403);
    const importBody = (await importResponse.json()) as { error?: { code?: unknown } };
    expect(importBody.error?.code === "DEMO_RESTRICTED").toBe(true);

    const recurringPath = `/api/accounts/${account.id}/recurring-cash-transactions`;
    const recurring = await responseData<{ id: string }>(
      await page.request.post(recurringPath, {
        data: {
          type: "DEPOSIT",
          amount: 1,
          frequency: "MONTHLY",
          note: "E2E Demo recurring",
          startDate: "2026-08-01",
          endDate: null,
        },
      }),
    );
    expect(
      (
        await responseData<{ rules: Array<{ id: string }> }>(await page.request.get(recurringPath))
      ).rules.some(({ id }) => id === recurring.id),
    ).toBe(true);
    expect(
      (
        await page.request.patch(`${recurringPath}/${recurring.id}`, {
          data: { note: "E2E Demo recurring updated" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/accounts/${account.id}`);
    await expect(
      page.getByText("Automatic recurring execution is paused in the Demo"),
    ).toBeVisible();
    expect((await page.request.delete(`${recurringPath}/${recurring.id}`)).ok()).toBe(true);

    await page.getByRole("button", { name: "Reset data" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Reset Demo" }).click();
    await expect(page.getByText("Demo data has been reset.")).toBeVisible({ timeout: 60_000 });
    const resetAccounts = await responseData<Account[]>(await page.request.get("/api/accounts"));
    expect(resetAccounts.length).toBe(5);
    expect(resetAccounts.some(({ name }) => name === uniqueAccountName)).toBe(false);
    expect((await demoSession(page)).user.demoExpiresAt).toBe(originalExpiry);

    const postResetMarkerName = `E2E Demo transfer marker ${suffix}`;
    await responseData<Account>(
      await page.request.post("/api/accounts", {
        data: {
          name: postResetMarkerName,
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: 0,
        },
      }),
    );
    const postResetMarkerExists = (
      await responseData<Account[]>(await page.request.get("/api/accounts"))
    ).some(({ name }) => name === postResetMarkerName);
    expect(postResetMarkerExists).toBe(true);

    await page.goto("/login?from=demo");
    await signInWithInternalTestLogin(page);
    await expect(page.getByText("Demo mode")).toHaveCount(0);
    const formalSessionResponse = await page.request.get("/api/auth/session");
    const formalSession = (await formalSessionResponse.json()) as SessionBody;
    expect(formalSession.user.isDemo).toBe(false);
    const markerTransferredToFormalAccount = (
      await responseData<Account[]>(await page.request.get("/api/accounts"))
    ).some(({ name }) => name === postResetMarkerName);
    expect(markerTransferredToFormalAccount).toBe(false);

    await expireDemoWorkspace(secondSession.user.id);
    await secondPage.reload();
    await expect(secondPage).toHaveURL(/\/demo\/expired/, { timeout: 60_000 });
    await expect(secondPage.getByRole("button", { name: "Start a new Demo" })).toBeVisible();
    await expect(secondPage.getByRole("link", { name: "Sign in to your account" })).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
