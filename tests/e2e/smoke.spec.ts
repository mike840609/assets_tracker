/**
 * R21 — Playwright smoke E2E
 *
 * Covers the three must-work paths:
 *   1. Unauthenticated visitor → /login → sign-in (preview-credentials stub) → /
 *   2. Create account → add holding via symbol search → holding appears
 *   3. Dashboard loads with net-worth card + trend chart
 *
 * Auth strategy: Google OAuth is stubbed via Next.js's built-in
 * Credentials provider, enabled when VERCEL_ENV=preview.  This avoids
 * needing real Google tokens in CI while still exercising the full
 * NextAuth session-creation path.  The global-setup logs in once and
 * saves storage state; tests 2 & 3 reuse that state.
 */

import { test, expect, type Page } from "@playwright/test";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDesktopViewportWidth(width: number | undefined) {
  return (width ?? 0) >= 1024;
}

function getAccountLocator(page: Page, accountName: string) {
  if (isDesktopViewportWidth(page.viewportSize()?.width)) {
    return page.getByRole("rowheader", { name: accountName });
  }

  return page.getByRole("link", { name: new RegExp(escapeRegExp(accountName)) });
}

// ---------------------------------------------------------------------------
// Path 1 — Auth: unauthenticated redirect → login → sign-in → dashboard
// ---------------------------------------------------------------------------

test("1. unauthenticated visitor is redirected to /login and can sign in", async ({ browser }) => {
  // Fresh context with no cookies — must not inherit the project storageState
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();

  // Visiting the root without auth should redirect to /login
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  // Login page must show the Google OAuth button (translation: "Continue with Google")
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

  // Sign in via preview-credentials (the OAuth stub for CI).
  // Works for both password-gated and button-only preview mode.
  const previewLoginButton = page.getByRole("button", { name: "Preview Login" });
  await previewLoginButton.waitFor({ timeout: 60_000 });
  const passwordInput = page.locator('input[name="password"]');
  if (await passwordInput.count()) {
    await passwordInput.fill(process.env.E2E_PASSWORD ?? "e2e-smoke-test");
  }
  await previewLoginButton.click();

  // After sign-in the user should land on the dashboard (root path)
  await page.waitForURL((url) => !url.pathname.includes("login"), {
    timeout: 30_000,
  });
  await expect(page).not.toHaveURL(/\/login/);

  await ctx.close();
});

// ---------------------------------------------------------------------------
// Path 2 — Create account → add holding → holding appears
// ---------------------------------------------------------------------------

test("2. create an account, add a holding manually, and see it in the list", async ({ page }) => {
  await page.goto("/accounts");

  // ── Create account ──────────────────────────────────────────────────────
  const addAccountButton = page.getByRole("button", { name: "Add Account" });
  await expect(addAccountButton).toBeVisible({ timeout: 15_000 });
  await addAccountButton.click();

  // Dialog must be visible
  await expect(page.getByRole("dialog")).toBeVisible();

  const accountName = `E2E Brokerage ${Date.now()}`;
  await page.fill('input[placeholder="e.g. Chase Checking"]', accountName);

  // Change category to Brokerage so we can add stock holdings to it
  await page
    .getByRole("combobox")
    .filter({ hasText: /bank|brokerage/i })
    .first()
    .click();
  await page.getByRole("option", { name: "Brokerage" }).click();

  await page.getByRole("button", { name: "Create Account" }).click();

  // The mutation succeeds immediately, but the current client view can stay
  // stale until the route is reloaded. Reload before asserting against the
  // persisted account list.
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
  await page.reload();

  // Account should appear in the active layout: desktop renders the account
  // name as a row header, while mobile renders it inside a linked card.
  await expect(getAccountLocator(page, accountName)).toBeVisible({ timeout: 15_000 });

  // ── Add holding ─────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Add Item" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Skip the search step and enter the ticker manually
  await page.getByRole("button", { name: "Enter manually" }).click();

  const symbol = `TSTT${Date.now().toString().slice(-4)}`; // unique-ish symbol
  // Fill name BEFORE symbol: the name input is inside {!symbol && ...} in the component
  // and disappears as soon as the symbol field has a value.
  await page.fill('input[placeholder="e.g. Apple Inc."]', "E2E Test Corp");
  await page.fill('input[placeholder="e.g. AAPL"]', symbol);
  await page.fill('input[placeholder="e.g. 100"]', "5");

  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Account-selection step: choose the account we just created
  // If it's the only matching account it is pre-selected; otherwise pick it.
  const selectTrigger = page.getByRole("combobox").filter({ hasText: /choose an account/i });
  if (await selectTrigger.isVisible()) {
    await selectTrigger.click();
    await page.getByRole("option", { name: accountName }).click();
  }

  await page.getByRole("button", { name: "Add Holding" }).click();

  // Holding symbol must appear somewhere on the page
  await expect(page.getByText(symbol)).toBeVisible({ timeout: 15_000 });

  // Wait for the "Add Holding" dialog to fully close before hovering
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

  // ── Cleanup: delete the test account ────────────────────────────────────
  // Open the per-row ⋮ overflow menu and click Delete. The accounts list renders
  // a table on lg+ (desktop) and collapsible cards on mobile, so we branch on
  // which view is actually visible.
  const desktopRow = page.getByRole("row").filter({ hasText: accountName });
  if (await desktopRow.isVisible()) {
    // Desktop table: hover the row to reveal the ⋮ button, then open the menu
    await desktopRow.hover();
    await desktopRow.getByRole("button").click();
  } else {
    // Mobile cards: hover the card to reveal the ⋮ button in the parent wrapper
    const mobileCard = page.locator("a", { hasText: accountName });
    await mobileCard.hover();
    await mobileCard.locator("..").getByRole("button").click();
  }
  // Register the dialog handler BEFORE clicking Delete — confirm() fires
  // synchronously inside the onClick, so a handler registered after would miss it.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("menuitem", { name: /delete/i }).click();
  await page.reload();
  await expect(getAccountLocator(page, accountName)).toHaveCount(0, { timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Path 3 — Dashboard: net-worth card + trend chart visible
// ---------------------------------------------------------------------------

test("3. dashboard renders the net-worth card and trend chart section", async ({ page }) => {
  await page.goto("/");

  // Net-worth card: scope to the card's data-testid to skip the hidden
  // MobileHeader subtitle ("Net Worth") that appears earlier in DOM order.
  const netWorthCard = page.getByTestId("net-worth-card");
  await expect(netWorthCard.getByText(/net worth/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // Total-assets sub-card label
  await expect(netWorthCard.getByText(/total assets/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // Trend-chart section heading
  await expect(
    page
      .getByRole("main")
      .getByText(/net worth trend/i)
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  });
});
