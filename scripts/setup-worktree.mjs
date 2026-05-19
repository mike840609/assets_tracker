import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function resolveCacheDir() {
  if (process.env.ASSET_TRACKER_NPM_CACHE) {
    return process.env.ASSET_TRACKER_NPM_CACHE;
  }
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "asset_tracker", "npm");
}

const cacheDir = resolveCacheDir();
mkdirSync(cacheDir, { recursive: true });

console.log(`[setup-worktree] Using shared npm cache: ${cacheDir}`);
console.log(`[setup-worktree] Override with $ASSET_TRACKER_NPM_CACHE.`);

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
