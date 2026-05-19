import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

function resolveCacheDir() {
  if (process.env.ASSET_TRACKER_NPM_CACHE) {
    return process.env.ASSET_TRACKER_NPM_CACHE;
  }
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "asset_tracker", "npm");
}

function gitRevParse(arg) {
  const r = spawnSync("git", ["rev-parse", arg], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

function copyEnvFromMainWorktree() {
  const commonDir = gitRevParse("--git-common-dir");
  const topLevel = gitRevParse("--show-toplevel");
  if (!commonDir || !topLevel) {
    console.log("[setup-worktree] Not in a git worktree; skipping .env copy.");
    return;
  }

  const mainWorktree = resolve(dirname(commonDir));
  const currentWorktree = resolve(topLevel);

  if (mainWorktree === currentWorktree) {
    console.log("[setup-worktree] Running in the main worktree; skipping .env copy.");
    return;
  }

  const sourceEnv = join(mainWorktree, ".env");
  const targetEnv = join(currentWorktree, ".env");

  if (existsSync(targetEnv)) {
    console.log("[setup-worktree] .env already present in this worktree; leaving it alone.");
    return;
  }
  if (!existsSync(sourceEnv)) {
    console.log(`[setup-worktree] No .env at ${sourceEnv}; skipping copy.`);
    return;
  }

  copyFileSync(sourceEnv, targetEnv);
  console.log(`[setup-worktree] Copied .env from main worktree: ${sourceEnv}`);
}

const cacheDir = resolveCacheDir();
mkdirSync(cacheDir, { recursive: true });

console.log(`[setup-worktree] Using shared npm cache: ${cacheDir}`);
console.log(`[setup-worktree] Override with $ASSET_TRACKER_NPM_CACHE.`);

copyEnvFromMainWorktree();

const env = { ...process.env, NPM_CONFIG_CACHE: cacheDir };

const result = spawnSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
