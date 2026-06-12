#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGET_BYTES = 150 * 1024 * 1024;
const DEFAULT_PATHS = [
  ".next/cache",
  ".next/cache/turbopack",
  ".next/cache/webpack",
  ".next/cache/swc",
  "node_modules/.prisma",
  "playwright-report",
  "test-results",
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

async function sizeOf(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return 0;
  }

  if (!stat.isDirectory()) return stat.size;

  let total = 0;
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    total += await sizeOf(join(path, entry.name));
  }
  return total;
}

async function directChildren(path) {
  if (!existsSync(path)) return [];
  const entries = await readdir(path, { withFileTypes: true });
  const children = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const childPath = join(path, entry.name);
    children.push({ path: childPath, bytes: await sizeOf(childPath) });
  }
  return children.sort((a, b) => b.bytes - a.bytes);
}

const rows = [];
for (const candidate of DEFAULT_PATHS) {
  const absolute = join(ROOT, candidate);
  if (existsSync(absolute)) {
    rows.push({ path: candidate, bytes: await sizeOf(absolute) });
  }
}

const nextCache = rows.find((row) => row.path === ".next/cache");
const nextCacheBytes = nextCache?.bytes ?? 0;

console.log("Build cache audit");
console.log("=================");

if (rows.length === 0) {
  console.log("No local build/cache artifacts found. Run `npm run build` first for a local audit.");
  process.exit(0);
}

for (const row of rows.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`${formatBytes(row.bytes).padStart(9)}  ${row.path}`);
}

const children = await directChildren(join(ROOT, ".next/cache"));
if (children.length > 0) {
  console.log("\n.next/cache contributors");
  for (const child of children.slice(0, 12)) {
    console.log(`${formatBytes(child.bytes).padStart(9)}  ${relative(ROOT, child.path)}`);
  }
}

console.log(`\nTarget: .next/cache < ${formatBytes(TARGET_BYTES)}`);
if (nextCacheBytes > TARGET_BYTES) {
  console.log(
    `Status: over target by ${formatBytes(nextCacheBytes - TARGET_BYTES)}. Inspect the largest contributors above before changing cache policy.`,
  );
} else {
  console.log("Status: at or below target.");
}
