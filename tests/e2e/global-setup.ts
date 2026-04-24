import { chromium } from "@playwright/test"
import path from "path"
import fs from "fs"

const authFile = path.join(__dirname, ".auth/user.json")

/**
 * Logs in once via the preview-credentials endpoint and saves storage state.
 * All smoke tests that need authentication reuse this saved state.
 *
 * Requirements on the server:
 *   VERCEL_ENV=preview
 *   PREVIEW_AUTH_PASSWORD=<same value as E2E_PASSWORD env var here>
 */
async function globalSetup() {
  const authDir = path.dirname(authFile)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000"
  const password = process.env.E2E_PASSWORD ?? "e2e-smoke-test"

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${baseURL}/login`)

  // Preview-mode password form (only shown when VERCEL_ENV=preview)
  await page.waitForSelector('input[name="password"]', { timeout: 30_000 })
  await page.fill('input[name="password"]', password)
  await page.getByRole("button", { name: "Preview Login" }).click()

  // Wait until we leave /login (dashboard redirect)
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30_000 })

  await context.storageState({ path: authFile })
  await browser.close()
}

export default globalSetup
