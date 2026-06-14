import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ENV_FILES = [".env", ".env.local"];

function cacheRoot() {
  if (process.env.ASSET_TRACKER_CACHE_ROOT) return process.env.ASSET_TRACKER_CACHE_ROOT;
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "asset_tracker");
}

// pnpm keeps a single global content-addressable store and builds each worktree's
// node_modules from hardlinks into it, so packages are never duplicated on disk.
// We point the store at a stable location so it survives across worktrees and
// (when pointed at a persistent volume) across ephemeral sandbox sessions.
function storeDir() {
  return join(cacheRoot(), "pnpm-store");
}

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
  const store = storeDir();
  // --frozen-lockfile mirrors CI/Vercel: install exactly what pnpm-lock.yaml pins.
  // pnpm's `postinstall` (prisma generate) and `prepare` (husky) run automatically.
  // Note: hardlinks require the store and worktree to share a filesystem; if
  // $ASSET_TRACKER_CACHE_ROOT points at a different volume, pnpm transparently
  // falls back to copying (still correct, just less space-efficient).
  const result = spawnSync(
    "pnpm",
    ["install", "--frozen-lockfile", "--prefer-offline", "--store-dir", store],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function pruneStore() {
  const result = spawnSync("pnpm", ["store", "prune", "--store-dir", storeDir()], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

mkdirSync(storeDir(), { recursive: true });

console.log(`[setup-worktree] pnpm store: ${storeDir()}`);
console.log("[setup-worktree] Override the store root with $ASSET_TRACKER_CACHE_ROOT.");
console.log(
  "[setup-worktree] Skip env copy with $ASSET_TRACKER_SKIP_ENV_COPY=1; pass --prune to garbage-collect the store.",
);

copyEnvFromMainWorktree();
const status = installDeps();
if (status === 0 && process.argv.includes("--prune")) {
  pruneStore();
}
process.exit(status);
