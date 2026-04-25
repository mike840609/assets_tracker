import { chromium } from "@playwright/test"
import path from "path"
import fs from "fs"

const authFile = path.join(__dirname, ".auth/user.json")

async function globalTeardown() {
  if (!fs.existsSync(authFile)) return

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000"
  const browser = await chromium.launch()
  const context = await browser.newContext({ storageState: authFile })

  try {
    const res = await context.request.get(`${baseURL}/api/accounts`)
    if (res.ok()) {
      const accounts: { id: string; name: string }[] = await res.json()
      const e2eIds = accounts
        .filter((a) => a.name.startsWith("E2E "))
        .map((a) => a.id)
      if (e2eIds.length > 0) {
        await context.request.delete(`${baseURL}/api/accounts`, {
          data: { ids: e2eIds },
        })
      }
    }
  } finally {
    await browser.close()
  }
}

export default globalTeardown
