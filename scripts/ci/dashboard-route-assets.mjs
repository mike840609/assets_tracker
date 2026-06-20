#!/usr/bin/env node

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const ROUTE = "/(main)/page";
const RSC_MANIFEST = join(ROOT, ".next/server/app/(main)/page_client-reference-manifest.js");
const BUILD_MANIFEST = join(ROOT, ".next/server/app/(main)/page/build-manifest.json");

export function measureDashboardRoute() {
  if (!existsSync(RSC_MANIFEST) || !existsSync(BUILD_MANIFEST)) {
    throw new Error("Dashboard build manifests not found; run `pnpm build` first");
  }

  const sandbox = { globalThis: {} };
  runInNewContext(readFileSync(RSC_MANIFEST, "utf8"), sandbox);
  const manifest = sandbox.globalThis.__RSC_MANIFEST?.[ROUTE];
  if (!manifest) throw new Error(`Route manifest ${ROUTE} not found`);

  const buildManifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf8"));
  const files = new Set([
    ...buildManifest.polyfillFiles,
    ...buildManifest.rootMainFiles,
    ...Object.values(manifest.clientModules).flatMap((module) => module.chunks),
    ...Object.values(manifest.entryCSSFiles).flatMap((entries) =>
      entries.map((entry) => entry.path),
    ),
  ]);

  let jsGzipBytes = 0;
  let cssGzipBytes = 0;
  for (const file of files) {
    const relative = file.replace(/^\/_next\//, "");
    const full = join(ROOT, ".next", relative);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const bytes = gzipSync(readFileSync(full)).length;
    if (full.endsWith(".js")) jsGzipBytes += bytes;
    if (full.endsWith(".css")) cssGzipBytes += bytes;
  }

  return {
    totalGzipBytes: jsGzipBytes + cssGzipBytes,
    jsGzipBytes,
    cssGzipBytes,
    fileCount: files.size,
  };
}

const result = measureDashboardRoute();
const output = `${JSON.stringify(result, null, 2)}\n`;
const writeIndex = process.argv.indexOf("--write");
if (writeIndex >= 0) writeFileSync(process.argv[writeIndex + 1], output);
process.stdout.write(output);
