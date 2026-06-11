#!/usr/bin/env node
/**
 * Bundle-size CI gate (S18).
 *
 * Measures the total gzipped bytes of client assets (`.js` + `.css`) under
 * `.next/static` after a production build, and compares a PR's measurement
 * against the baseline saved by the most recent master-push build.
 *
 * Usage:
 *   node scripts/ci/bundle-size.mjs --write <out.json>
 *   node scripts/ci/bundle-size.mjs --compare <baseline.json> --against <head.json> [--max-growth 0.05]
 *
 * Handling deliberate bundle growth:
 *   The gate only blocks the PR that introduces the growth. If the growth is
 *   intentional (new feature, new dependency that earns its weight), note the
 *   justification in the PR and merge with the failing job acknowledged (or
 *   temporarily raise --max-growth in the workflow within the same PR). The
 *   baseline self-heals: the next push to master rebuilds and saves a fresh
 *   baseline that includes the growth, so subsequent PRs compare against it.
 *
 *   A missing baseline (first run, or GitHub Actions cache eviction) is a
 *   soft pass: the compare step prints a warning and exits 0, and the next
 *   master push restores the baseline.
 *
 * Zero dependencies — uses node:fs, node:path, node:zlib only.
 */

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const STATIC_DIR = join(process.cwd(), ".next", "static");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function measure() {
  if (!existsSync(STATIC_DIR)) {
    console.error(`::error::${STATIC_DIR} not found — run \`npm run build\` first`);
    process.exit(1);
  }
  let jsGzipBytes = 0;
  let cssGzipBytes = 0;
  let fileCount = 0;
  for (const file of walk(STATIC_DIR)) {
    const ext = extname(file);
    if (ext !== ".js" && ext !== ".css") continue;
    const gz = gzipSync(readFileSync(file)).length;
    if (ext === ".js") jsGzipBytes += gz;
    else cssGzipBytes += gz;
    fileCount += 1;
  }
  return {
    totalGzipBytes: jsGzipBytes + cssGzipBytes,
    jsGzipBytes,
    cssGzipBytes,
    fileCount,
    generatedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA ?? null,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function readArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const writeOut = readArg("--write");
const baselinePath = readArg("--compare");

if (writeOut) {
  const result = measure();
  writeFileSync(writeOut, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `Measured ${result.fileCount} files: total ${formatBytes(result.totalGzipBytes)} gzip ` +
      `(js ${formatBytes(result.jsGzipBytes)}, css ${formatBytes(result.cssGzipBytes)}) → ${writeOut}`,
  );
  process.exit(0);
}

if (baselinePath) {
  const headPath = readArg("--against");
  const maxGrowth = Number(readArg("--max-growth") ?? "0.05");
  if (!headPath) {
    console.error("::error::--compare requires --against <head.json>");
    process.exit(1);
  }
  if (!existsSync(baselinePath)) {
    console.log("::warning::No bundle baseline found (first run or cache evicted) — skipping gate");
    process.exit(0);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const head = JSON.parse(readFileSync(headPath, "utf8"));
  const deltaBytes = head.totalGzipBytes - baseline.totalGzipBytes;
  const growth = baseline.totalGzipBytes > 0 ? deltaBytes / baseline.totalGzipBytes : 0;
  const growthPct = (growth * 100).toFixed(2);

  const rows = [
    ["Total gzip", baseline.totalGzipBytes, head.totalGzipBytes],
    ["JS gzip", baseline.jsGzipBytes, head.jsGzipBytes],
    ["CSS gzip", baseline.cssGzipBytes, head.cssGzipBytes],
  ];
  const summaryLines = [
    "## Bundle size (gzip, `.next/static`)",
    "",
    `Baseline sha: \`${baseline.sha ?? "unknown"}\` · Head sha: \`${head.sha ?? "unknown"}\` · Limit: +${(maxGrowth * 100).toFixed(0)}%`,
    "",
    "| Metric | Baseline | Head | Delta | Delta % |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows.map(([label, base, cur]) => {
      const d = cur - base;
      const pct = base > 0 ? ((d / base) * 100).toFixed(2) : "n/a";
      const sign = d >= 0 ? "+" : "";
      return `| ${label} | ${formatBytes(base)} | ${formatBytes(cur)} | ${sign}${d} B | ${sign}${pct}% |`;
    }),
    "",
  ];
  console.log(summaryLines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n") + "\n");
  }

  if (growth > maxGrowth) {
    console.error(
      `::error::Client bundle grew ${growthPct}% (>${(maxGrowth * 100).toFixed(0)}% limit)`,
    );
    process.exit(1);
  }
  console.log(`Bundle growth ${growthPct}% is within the +${(maxGrowth * 100).toFixed(0)}% limit.`);
  process.exit(0);
}

console.error(
  "::error::Usage: bundle-size.mjs --write <out.json> | --compare <baseline.json> --against <head.json> [--max-growth 0.05]",
);
process.exit(1);
