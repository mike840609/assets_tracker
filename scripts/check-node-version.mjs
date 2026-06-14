// Fail fast with an actionable message when the active Node.js major doesn't
// match the project's pinned version. Prisma 7 / Next 16 break on older Node
// (e.g. v18 throws ERR_REQUIRE_ESM deep inside @prisma/dev), and nvm does NOT
// auto-switch unless a shell hook runs `nvm use` — so `npm run dev` silently
// inherits whatever Node is on PATH. This surfaces the mismatch cleanly.
//
// Source of truth: `engines.node` in package.json (".nvmrc" pins the exact
// patch for nvm; engines pins the major we actually require).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRequiredMajor() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const engines = pkg.engines?.node ?? "";
  // Accept forms like "24.x", ">=24", "24.6.0", "^24".
  const match = engines.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

const requiredMajor = readRequiredMajor();
const currentMajor = Number(process.versions.node.split(".")[0]);

if (requiredMajor !== null && currentMajor !== requiredMajor) {
  let nvmrc = "";
  try {
    nvmrc = readFileSync(join(root, ".nvmrc"), "utf8").trim();
  } catch {
    // .nvmrc is optional; fall back to the engines major.
  }
  const target = nvmrc || `${requiredMajor}`;
  console.error(
    [
      "",
      `\x1b[31m✖ Node ${process.versions.node} is active, but this project requires Node ${requiredMajor}.x.\x1b[0m`,
      "",
      "  nvm does not switch automatically. In this shell, run:",
      `\x1b[36m      nvm use\x1b[0m   (reads .nvmrc → ${target})`,
      "",
      "  then re-run your command.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`[dev] Node.js ${process.version} ${process.execPath}`);
