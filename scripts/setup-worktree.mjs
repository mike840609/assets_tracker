import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// This script does the one thing pnpm can't do on its own for a fresh worktree:
// copy the env files from the main worktree. Dependency dedup is handled natively
// by pnpm's global content-addressable store (a single shared store hardlinks
// node_modules across every worktree), and the store location is configured
// natively too — pnpm's default global store locally, or `npm_config_store_dir`
// / an `.npmrc` `store-dir` in ephemeral sandboxes (see .codex/environments).

const ENV_FILES = [".env", ".env.local"];

function gitRevParse(arg) {
  const r = spawnSync("git", ["rev-parse", arg], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

function copyEnvFromMainWorktree() {
  if (process.env.ASSET_TRACKER_SKIP_ENV_COPY) {
    console.log("[setup-worktree] ASSET_TRACKER_SKIP_ENV_COPY set; skipping env file copy.");
    return;
  }

  const commonDir = gitRevParse("--git-common-dir");
  const topLevel = gitRevParse("--show-toplevel");
  if (!commonDir || !topLevel) {
    console.log("[setup-worktree] Not in a git worktree; skipping env file copy.");
    return;
  }

  const mainWorktree = resolve(dirname(commonDir));
  const currentWorktree = resolve(topLevel);

  if (mainWorktree === currentWorktree) {
    console.log("[setup-worktree] Running in the main worktree; skipping env file copy.");
    return;
  }

  for (const name of ENV_FILES) {
    const source = join(mainWorktree, name);
    const target = join(currentWorktree, name);
    if (existsSync(target)) {
      console.log(`[setup-worktree] ${name} already present; leaving it alone.`);
      continue;
    }
    if (!existsSync(source)) continue;
    copyFileSync(source, target);
    console.log(`[setup-worktree] Copied ${name} from main worktree.`);
  }
}

function installDeps() {
  // --frozen-lockfile mirrors CI/Vercel. pnpm hardlinks node_modules from the
  // shared store, and runs `postinstall` (prisma generate) + `prepare` (husky).
  const result = spawnSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function pruneStore() {
  const result = spawnSync("pnpm", ["store", "prune"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

console.log(
  "[setup-worktree] Copying env files from the main worktree, then running pnpm install.",
);
console.log(
  "[setup-worktree] Skip env copy with $ASSET_TRACKER_SKIP_ENV_COPY=1; pass --prune to garbage-collect the pnpm store.",
);

copyEnvFromMainWorktree();
const status = installDeps();
if (status === 0 && process.argv.includes("--prune")) {
  pruneStore();
}
process.exit(status);
