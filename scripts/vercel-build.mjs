import { spawnSync } from "node:child_process";

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result.status ?? 1;
}

// Skip `prisma migrate deploy` when this commit range touched no migration
// files. Falls open (runs migrate) on any uncertainty: missing previous SHA,
// shallow clone that can't reach it, or git failure.
function migrationsChanged() {
  if (process.env.FORCE_PRISMA_MIGRATE_DEPLOY === "1") return true;

  const prevSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (!prevSha) return true;

  const reachable = spawnSync("git", ["cat-file", "-e", prevSha], { stdio: "ignore" });
  if (reachable.status !== 0) return true;

  const diff = spawnSync(
    "git",
    ["diff", "--name-only", `${prevSha}...HEAD`, "--", "prisma/migrations"],
    { encoding: "utf8" },
  );
  if (diff.status !== 0) return true;

  return diff.stdout.trim().length > 0;
}

const shouldAttemptMigrate = process.env.SKIP_PRISMA_MIGRATE_DEPLOY !== "1" && migrationsChanged();

if (shouldAttemptMigrate) {
  const migrateStatus = run("prisma", ["migrate", "deploy"], { allowFailure: true });

  if (migrateStatus !== 0) {
    console.warn("\n[build:vercel] prisma migrate deploy failed; continuing with Next.js build.");
    console.warn("[build:vercel] Set SKIP_PRISMA_MIGRATE_DEPLOY=1 to skip migration entirely.\n");
  }
} else {
  console.log(
    "[build:vercel] No migration files changed since previous deploy — skipping prisma migrate deploy.",
  );
  console.log("[build:vercel] Set FORCE_PRISMA_MIGRATE_DEPLOY=1 to force it.\n");
}

// Always (re)generate the Prisma client before building. We can't rely on the
// `postinstall` hook here: Vercel restores node_modules from its build cache, so
// `pnpm install --frozen-lockfile` reports "Already up to date" and skips
// lifecycle scripts — and `src/generated/prisma/` is gitignored, so it isn't in
// the cache. Generating explicitly keeps the build correct on cold and warm caches.
run("prisma", ["generate"]);

run("next", ["build"]);
