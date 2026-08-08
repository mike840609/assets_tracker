import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.AUTH_SECRET ??= "integration-auth-secret-not-real";
process.env.CRON_SECRET ??= "integration-cron-secret-not-real";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: false,
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
