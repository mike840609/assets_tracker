import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, ".auth/user.json");

/**
 * Logs in once via the preview-credentials endpoint and saves storage state.
 * All smoke tests that need authentication reuse this saved state.
 *
 * Requirements on the server:
 *   VERCEL_ENV=preview
 *   PREVIEW_AUTH_ENABLED=true
 *   PREVIEW_AUTH_PASSWORD=<same value as E2E_PASSWORD env var here>
 */
async function globalSetup() {
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
  const password = process.env.E2E_PASSWORD || "e2e-smoke-test";

  if (process.env.CI && !process.env.E2E_PASSWORD) {
    throw new Error(
      "E2E_PASSWORD is empty. Set the GitHub Actions secret E2E_PASSWORD to the " +
        "same value as PREVIEW_AUTH_PASSWORD on the Vercel deployment.",
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Programmatic credentials sign-in (more deterministic than UI server-action submit).
  const csrfRes = await context.request.get(`${baseURL}/api/auth/csrf`, { timeout: 60_000 });
  if (!csrfRes.ok()) {
    throw new Error(`Failed to get CSRF token: ${csrfRes.status()} ${csrfRes.statusText()}`);
  }
  const csrfBody = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfBody.csrfToken) {
    throw new Error("Missing csrfToken from /api/auth/csrf");
  }

  await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrfBody.csrfToken,
      password,
      callbackUrl: `${baseURL}/`,
    },
    timeout: 60_000,
  });

  const sessionRes = await context.request.get(`${baseURL}/api/auth/session`, { timeout: 60_000 });
  if (!sessionRes.ok()) {
    throw new Error(
      `Failed to verify auth session: ${sessionRes.status()} ${sessionRes.statusText()}`,
    );
  }
  const sessionBody = (await sessionRes.json()) as { user?: { id?: string } };
  if (!sessionBody.user?.id) {
    throw new Error(
      "Global setup could not establish authenticated session via credentials provider.",
    );
  }

  // Do not visit an application page here. A fresh self-host has no data yet,
  // and rendering the dashboard before per-test fixtures are seeded would warm
  // Next.js caches with an empty result.
  await context.storageState({ path: authFile });
  await browser.close();
}

export default globalSetup;
