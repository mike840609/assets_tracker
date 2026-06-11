import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-smoke-test";

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup",
  globalTeardown: "./tests/e2e/global-teardown",
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The PWA service worker (#404) intercepts fetches, which bypasses
    // page.route() mocks (e.g. the /api/search mock in stocks.spec.ts).
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
  ],
  ...(process.env.PLAYWRIGHT_TEST_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run start",
          url: BASE_URL,
          reuseExistingServer: false,
          env: {
            VERCEL_ENV: "preview",
            PREVIEW_AUTH_PASSWORD: E2E_PASSWORD,
          },
        },
      }),
});
