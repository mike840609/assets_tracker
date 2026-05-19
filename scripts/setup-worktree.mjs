import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { cp } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ENV_FILES = [".env", ".env.local"];
const PRISMA_CLIENT_DIR = "src/generated/prisma";
const HUSKY_INIT_DIR = ".husky/_";
const BUCKET_PRISMA_DIR = "prisma-client";
const BUCKET_HUSKY_DIR = "husky-init";

function cacheRoot() {
  if (process.env.ASSET_TRACKER_CACHE_ROOT) return process.env.ASSET_TRACKER_CACHE_ROOT;
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "asset_tracker");
}

function npmCacheDir() {
  return process.env.ASSET_TRACKER_NPM_CACHE || join(cacheRoot(), "npm");
}

function modulesCacheRoot() {
  return join(cacheRoot(), "modules");
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

function lockfileHash() {
  const inputs = ["package-lock.json", "prisma/schema.prisma"];
  const h = createHash("sha256");
  for (const p of inputs) {
    if (!existsSync(p)) continue;
    h.update(p);
    h.update("\0");
    h.update(readFileSync(p));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function symlinkTargetAbs(linkPath) {
  try {
    const t = readlinkSync(linkPath);
    return resolve(dirname(linkPath), t);
  } catch {
    return null;
  }
}

async function ensurePrismaClient(bucketDir) {
  if (existsSync(PRISMA_CLIENT_DIR)) return 0;
  const cached = join(bucketDir, BUCKET_PRISMA_DIR);
  if (existsSync(cached)) {
    mkdirSync(dirname(PRISMA_CLIENT_DIR), { recursive: true });
    await cp(cached, PRISMA_CLIENT_DIR, { recursive: true });
    console.log("[setup-worktree] Restored Prisma client from cache.");
    return 0;
  }
  console.log("[setup-worktree] Prisma client not cached; running `prisma generate`.");
  const bin =
    process.platform === "win32" ? "node_modules\\.bin\\prisma.cmd" : "node_modules/.bin/prisma";
  const r = spawnSync(bin, ["generate"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) throw r.error;
  if (r.status !== 0) return r.status;
  // Backfill the cache for future hits.
  if (existsSync(PRISMA_CLIENT_DIR)) {
    mkdirSync(bucketDir, { recursive: true });
    await cp(PRISMA_CLIENT_DIR, cached, { recursive: true });
  }
  return 0;
}

async function ensureHusky(bucketDir) {
  if (!existsSync(".husky")) return 0;
  if (existsSync(HUSKY_INIT_DIR)) return 0;
  const cached = join(bucketDir, BUCKET_HUSKY_DIR);
  if (existsSync(cached)) {
    await cp(cached, HUSKY_INIT_DIR, { recursive: true });
    console.log("[setup-worktree] Restored .husky/_ from cache.");
    return 0;
  }
  console.log("[setup-worktree] Husky init not cached; running `husky`.");
  const bin =
    process.platform === "win32" ? "node_modules\\.bin\\husky.cmd" : "node_modules/.bin/husky";
  const r = spawnSync(bin, [], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) throw r.error;
  if (r.status !== 0) return r.status;
  if (existsSync(HUSKY_INIT_DIR)) {
    mkdirSync(bucketDir, { recursive: true });
    await cp(HUSKY_INIT_DIR, cached, { recursive: true });
  }
  return 0;
}

async function finalizeCacheHit(bucketDir) {
  const [prisma, husky] = await Promise.all([
    ensurePrismaClient(bucketDir),
    ensureHusky(bucketDir),
  ]);
  return prisma || husky;
}

function pruneStaleCacheBuckets(keepHash) {
  const root = modulesCacheRoot();
  if (!existsSync(root)) return;
  let removed = 0;
  for (const entry of readdirSync(root)) {
    if (entry === keepHash) continue;
    const full = join(root, entry);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    rmSync(full, { recursive: true, force: true });
    console.log(`[setup-worktree] Pruned stale cache bucket: ${entry}`);
    removed += 1;
  }
  if (removed === 0) {
    console.log("[setup-worktree] No stale cache buckets to prune.");
  }
}

async function stashIntoBucket(bucketDir, sourceRel, bucketSubdir) {
  if (!existsSync(sourceRel)) return;
  const target = join(bucketDir, bucketSubdir);
  if (existsSync(target)) return;
  mkdirSync(bucketDir, { recursive: true });
  await cp(sourceRel, target, { recursive: true });
}

async function setupNodeModules() {
  const hash = lockfileHash();
  const bucketDir = join(modulesCacheRoot(), hash);
  const cacheTarget = join(bucketDir, "node_modules");
  const wtNm = resolve("node_modules");

  if (isSymlink(wtNm)) {
    const currentTarget = symlinkTargetAbs(wtNm);
    if (currentTarget === cacheTarget && existsSync(cacheTarget)) {
      console.log(`[setup-worktree] node_modules already symlinked to cache (hash ${hash}).`);
      return finalizeCacheHit(bucketDir);
    }
  }

  if (existsSync(cacheTarget)) {
    if (existsSync(wtNm) || isSymlink(wtNm)) {
      rmSync(wtNm, { recursive: true, force: true });
    }
    mkdirSync(bucketDir, { recursive: true });
    symlinkSync(cacheTarget, wtNm, "dir");
    console.log(
      `[setup-worktree] Cache hit (hash ${hash}); symlinked node_modules → ${cacheTarget}.`,
    );
    return finalizeCacheHit(bucketDir);
  }

  if (isSymlink(wtNm)) {
    rmSync(wtNm, { force: true });
  }

  console.log(`[setup-worktree] Cache miss (hash ${hash}); running npm ci.`);
  const env = { ...process.env, NPM_CONFIG_CACHE: npmCacheDir() };
  const result = spawnSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) return result.status;

  mkdirSync(bucketDir, { recursive: true });
  if (existsSync(cacheTarget)) {
    rmSync(wtNm, { recursive: true, force: true });
  } else {
    renameSync(wtNm, cacheTarget);
  }
  symlinkSync(cacheTarget, wtNm, "dir");

  await Promise.all([
    stashIntoBucket(bucketDir, PRISMA_CLIENT_DIR, BUCKET_PRISMA_DIR),
    stashIntoBucket(bucketDir, HUSKY_INIT_DIR, BUCKET_HUSKY_DIR),
  ]);

  console.log(`[setup-worktree] Promoted node_modules + side artifacts to cache: ${bucketDir}.`);
  return 0;
}

mkdirSync(npmCacheDir(), { recursive: true });
mkdirSync(modulesCacheRoot(), { recursive: true });

console.log(`[setup-worktree] npm cache:     ${npmCacheDir()}`);
console.log(`[setup-worktree] modules cache: ${modulesCacheRoot()}`);
console.log(
  "[setup-worktree] Override roots with $ASSET_TRACKER_CACHE_ROOT or $ASSET_TRACKER_NPM_CACHE.",
);
console.log(
  "[setup-worktree] Skip env copy with $ASSET_TRACKER_SKIP_ENV_COPY=1; pass --prune to evict stale cache buckets.",
);

copyEnvFromMainWorktree();
const status = await setupNodeModules();
if (status === 0 && process.argv.includes("--prune")) {
  pruneStaleCacheBuckets(lockfileHash());
}
process.exit(status);
