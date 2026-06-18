import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (existsSync(".env")) {
  process.loadEnvFile?.();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations use the direct (non-pooled) connection to avoid
    // pooler-mediated timeouts and advisory-lock issues in CI / Vercel builds.
    // Falls back to DATABASE_URL when DIRECT_URL is unset (local dev convenience).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
