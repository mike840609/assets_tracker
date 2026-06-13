import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit-test config (E22). Runs the pure service-layer suites in tests/unit/.
// E2E lives separately under tests/e2e/ and is driven by Playwright, so it is
// explicitly excluded here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` path alias for runtime resolution.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real `server-only` module throws outside an RSC bundle; stub it so
      // server-only service modules can be imported in the Node test env.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
