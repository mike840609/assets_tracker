import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, describe, expect, it } from "vitest";

/**
 * `vercel.json`'s ignoreCommand decides whether Vercel builds at all. Vercel
 * defines exit code 0 as "skip the build" and 1 as "build", so a wrong exit
 * code here silently stops deploying. This file runs the real command string
 * from `vercel.json` against throwaway repositories and file:// remotes.
 */
const ignoreCommand = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    ignoreCommand: string;
  }
).ignoreCommand;

const SKIP_BUILD = 0;
const RUN_BUILD = 1;

type Fixture = {
  root: string;
  repo: string;
  origin: string;
  branch: string;
  masterSha: string;
};

const fixtures = new Set<string>();

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commit(cwd: string, files: Record<string, string>, message: string) {
  for (const [name, contents] of Object.entries(files)) {
    fs.mkdirSync(path.join(cwd, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(cwd, name), contents);
  }
  git(cwd, "add", "-A");
  git(
    cwd,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--allow-empty",
    "-m",
    message,
  );
  return git(cwd, "rev-parse", "HEAD");
}

function copyIgnoreScript(repo: string) {
  // The initial RED run still uses the existing inline command. Once the
  // implementation script exists, fixtures include it exactly as Vercel does.
  const source = path.join(process.cwd(), "scripts/vercel-ignore.mjs");
  if (!fs.existsSync(source)) return;
  const destination = path.join(repo, "scripts/vercel-ignore.mjs");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function makeFixture(branch: string, setupBranch: (repo: string) => void): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vercel-ignore-command-"));
  fixtures.add(root);
  const origin = path.join(root, "origin.git");
  const source = path.join(root, "source");
  const repo = path.join(root, "checkout");

  fs.mkdirSync(source, { recursive: true });
  git(source, "-c", "init.defaultBranch=master", "init", "-q");
  git(source, "config", "user.email", "t@t");
  git(source, "config", "user.name", "t");
  commit(source, { "src/base.ts": "export const base = true;\n" }, "base");

  git(root, "init", "--bare", "-q", origin);
  git(source, "remote", "add", "origin", pathToFileURL(origin).href);
  git(source, "push", "-q", "origin", "master");
  const masterSha = git(source, "rev-parse", "master");

  git(source, "switch", "-c", branch);
  setupBranch(source);
  git(source, "push", "-q", "origin", branch);

  git(
    root,
    "clone",
    "-q",
    "--depth=10",
    "--single-branch",
    "--branch",
    branch,
    pathToFileURL(origin).href,
    repo,
  );
  copyIgnoreScript(repo);
  return { root, repo, origin, branch, masterSha };
}

function runIgnore(
  fixture: Fixture,
  options: {
    previousSha?: string;
    environment?: string;
    branch?: string;
  } = {},
) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("VERCEL_")) delete env[name];
  }
  if (options.previousSha !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = options.previousSha;
  if (options.environment !== undefined) env.VERCEL_ENV = options.environment;
  if (options.branch !== undefined) env.VERCEL_GIT_COMMIT_REF = options.branch;
  return (
    spawnSync("sh", ["-c", ignoreCommand], {
      cwd: fixture.repo,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).status ?? RUN_BUILD
  );
}

afterEach(() => {
  for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true });
  fixtures.clear();
});

afterAll(() => {
  for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true });
});

describe("vercel.json ignoreCommand", () => {
  it("skips a first preview deployment when the whole branch is markdown-only", () => {
    const fixture = makeFixture("feature/docs-only", (repo) => {
      commit(repo, { "README.md": "# hi\n", "docs/nested/note.md": "nested\n" }, "docs");
    });

    expect(
      runIgnore(fixture, {
        previousSha: "",
        environment: "preview",
        branch: fixture.branch,
      }),
    ).toBe(SKIP_BUILD);
  });

  it("fetches the missing production baseline for a first docs-only preview", () => {
    const fixture = makeFixture("feature/docs-baseline", (repo) => {
      commit(repo, { "docs/one.md": "one\n" }, "docs");
    });

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(SKIP_BUILD);
    expect(git(fixture.repo, "rev-parse", "--verify", "refs/remotes/origin/master")).toBe(
      fixture.masterSha,
    );
  });

  it("builds a first preview when code and markdown both changed", () => {
    const fixture = makeFixture("feature/mixed", (repo) => {
      commit(repo, { "src/app.ts": "export const app = 1;\n" }, "code");
      commit(repo, { "docs/app.md": "app\n" }, "docs");
    });

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(RUN_BUILD);
  });

  it("builds when code landed before the last ten shallow commits", () => {
    const fixture = makeFixture("feature/shallow-code", (repo) => {
      commit(
        repo,
        { "src/early.ts": "export const early = true;\n" },
        "code before shallow boundary",
      );
      for (let index = 0; index < 10; index += 1) {
        commit(repo, { [`docs/note-${index}.md`]: `${index}\n` }, `docs ${index}`);
      }
    });

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(RUN_BUILD);
  });

  it("builds when a docs-only branch remains beyond the bounded shallow history", () => {
    const fixture = makeFixture("feature/deep-docs", (repo) => {
      for (let index = 0; index < 51; index += 1) {
        commit(repo, { [`docs/note-${index}.md`]: `${index}\n` }, `docs ${index}`);
      }
    });

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(RUN_BUILD);
  });

  it("builds when the production baseline is unavailable", () => {
    const fixture = makeFixture("feature/no-origin", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });
    git(fixture.repo, "remote", "remove", "origin");

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(RUN_BUILD);
  });

  it("builds when fetching the production baseline fails", () => {
    const fixture = makeFixture("feature/fetch-failure", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });
    git(
      fixture.repo,
      "remote",
      "set-url",
      "origin",
      pathToFileURL(path.join(fixture.root, "missing.git")).href,
    );

    expect(
      runIgnore(fixture, { previousSha: "", environment: "preview", branch: fixture.branch }),
    ).toBe(RUN_BUILD);
  });

  it.each([
    ["production", "production"],
    ["missing environment", undefined],
    ["unknown environment", "development"],
  ])("builds for the %s environment guard", (_name, environment) => {
    const fixture = makeFixture("feature/guard", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    const options: { previousSha: string; branch: string; environment?: string } = {
      previousSha: "",
      branch: fixture.branch,
    };
    if (environment !== undefined) options.environment = environment;
    expect(runIgnore(fixture, options)).toBe(RUN_BUILD);
  });

  it("builds when the first deployment metadata names master", () => {
    const fixture = makeFixture("feature/master-guard", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    expect(runIgnore(fixture, { previousSha: "", environment: "preview", branch: "master" })).toBe(
      RUN_BUILD,
    );
  });

  it("builds when the first deployment branch metadata is invalid", () => {
    const fixture = makeFixture("feature/invalid-metadata", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    expect(
      runIgnore(fixture, {
        previousSha: "",
        environment: "preview",
        branch: "feature/../../run-away",
      }),
    ).toBe(RUN_BUILD);
  });

  it("builds when the first deployment branch metadata is missing", () => {
    const fixture = makeFixture("feature/missing-metadata", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    expect(runIgnore(fixture, { previousSha: "", environment: "preview" })).toBe(RUN_BUILD);
  });

  it("builds for an invalid nonempty previous SHA", () => {
    const fixture = makeFixture("feature/invalid-previous", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    expect(runIgnore(fixture, { previousSha: "not-a-commit" })).toBe(RUN_BUILD);
  });

  it("builds when the previous SHA equals HEAD", () => {
    const fixture = makeFixture("feature/same-sha", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });

    expect(runIgnore(fixture, { previousSha: git(fixture.repo, "rev-parse", "HEAD") })).toBe(
      RUN_BUILD,
    );
  });

  it("skips markdown-only changes from an existing deployment without fetching", () => {
    const fixture = makeFixture("feature/existing-previous", (repo) => {
      commit(repo, { "docs/note.md": "docs\n" }, "docs");
    });
    git(
      fixture.repo,
      "remote",
      "set-url",
      "origin",
      pathToFileURL(path.join(fixture.root, "missing.git")).href,
    );

    expect(runIgnore(fixture, { previousSha: fixture.masterSha })).toBe(SKIP_BUILD);
  });

  it("builds when docs follow code across multiple commits", () => {
    const fixture = makeFixture("feature/docs-after-code", (repo) => {
      commit(repo, { "src/app.ts": "export const app = 2;\n" }, "code");
      commit(repo, { "docs/app.md": "app\n" }, "docs");
    });

    expect(runIgnore(fixture, { previousSha: fixture.masterSha })).toBe(RUN_BUILD);
  });

  it("builds when no files changed since the previous deployment", () => {
    const fixture = makeFixture("feature/no-diff", () => undefined);

    expect(runIgnore(fixture, { previousSha: fixture.masterSha })).toBe(RUN_BUILD);
  });
});
