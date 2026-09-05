import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `vercel.json`'s ignoreCommand decides whether Vercel builds at all. Vercel
 * defines exit code 0 as "skip the build" and 1 as "build", so a wrong exit
 * code here silently stops deploying. This file runs the real command string
 * from `vercel.json` against throwaway repositories.
 */
const ignoreCommand = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    ignoreCommand: string;
  }
).ignoreCommand;

const SKIP_BUILD = 0;
const RUN_BUILD = 1;

let repo: string;

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function commit(files: Record<string, string>, message: string) {
  for (const [name, contents] of Object.entries(files)) {
    fs.mkdirSync(path.join(repo, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(repo, name), contents);
  }
  git("add", "-A");
  git(
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    message,
  );
  return git("rev-parse", "HEAD");
}

/** Runs the ignoreCommand the way Vercel does: a shell, with the SHA injected. */
function runIgnoreCommand(previousSha: string) {
  return spawnSync("sh", ["-c", ignoreCommand], {
    cwd: repo,
    env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previousSha },
  }).status;
}

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "ignore-command-"));
  git("init", "-q");
  // Every test resolves HEAD, so none of them may depend on an earlier one
  // having committed first — `vitest run -t "<name>"` has to work too.
  commit({ "src/seed.ts": "export const seed = 0;\n" }, "seed");
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("vercel.json ignoreCommand", () => {
  it("skips the build when only markdown changed since the last deployment", () => {
    const deployed = commit({ "src/app.ts": "export const a = 1;\n" }, "code");
    commit({ "README.md": "# hi\n", "docs/nested/note.md": "nested\n" }, "docs");

    expect(runIgnoreCommand(deployed)).toBe(SKIP_BUILD);
  });

  it("builds when a non-markdown file changed", () => {
    const deployed = git("rev-parse", "HEAD");
    commit({ "src/app.ts": "export const a = 2;\n" }, "code again");

    expect(runIgnoreCommand(deployed)).toBe(RUN_BUILD);
  });

  it("builds when code landed earlier in the same push and the head commit is docs-only", () => {
    // Vercel deploys the head commit of a push, so an HEAD^ comparison would
    // miss the code commit behind it and skip a build that was never deployed.
    const deployed = git("rev-parse", "HEAD");
    commit({ "src/app.ts": "export const a = 3;\n" }, "code");
    commit({ "docs/CI.md": "docs\n" }, "docs on top of code");

    expect(runIgnoreCommand(deployed)).toBe(RUN_BUILD);
  });

  it("builds when the previous SHA is empty, as on a branch's first deployment", () => {
    expect(runIgnoreCommand("")).toBe(RUN_BUILD);
  });

  it("builds when nothing changed, as on an empty commit or a redeploy of the same SHA", () => {
    // Both are the habitual ways to force a deployment after an environment
    // change. An empty diff must not read as "nothing to do".
    expect(runIgnoreCommand(git("rev-parse", "HEAD"))).toBe(RUN_BUILD);
  });
});
