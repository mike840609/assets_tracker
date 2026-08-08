import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import pg from "pg";

const authFile = path.join(__dirname, ".auth/user.json");

async function cleanupPublicDemoUsers() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return;
  }
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) return;

  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      DELETE FROM "User"
      WHERE id IN (SELECT "userId" FROM "DemoWorkspace")
    `);
  } finally {
    await pool.end();
  }
}

async function globalTeardown() {
  await cleanupPublicDemoUsers();
  if (!fs.existsSync(authFile)) return;

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: authFile });

  try {
    const res = await context.request.get(`${baseURL}/api/accounts`, { timeout: 60_000 });
    if (res.ok()) {
      const { data: accounts }: { data: { id: string; name: string }[] } = await res.json();
      const e2eIds = accounts.filter((a) => a.name.startsWith("E2E ")).map((a) => a.id);
      if (e2eIds.length > 0) {
        await context.request.delete(`${baseURL}/api/accounts`, {
          data: { ids: e2eIds },
        });
      }
    }
  } finally {
    await browser.close();
  }
}

export default globalTeardown;
