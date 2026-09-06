import { spawnSync } from "node:child_process";

const BUILD = 1;
const SKIP = 0;
const FETCH_DEPTH = 50;
const GIT_TIMEOUT_MS = 5_000;

function git(args, captureOutput = false) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: captureOutput ? ["ignore", "pipe", "ignore"] : "ignore",
    timeout: GIT_TIMEOUT_MS,
  });

  if (result.error || result.status === null) return undefined;
  return captureOutput ? { status: result.status, stdout: result.stdout.trim() } : result.status;
}

function changedOnlyMarkdown(base) {
  const hasChanges = git(["diff", "--quiet", base, "HEAD"]);
  if (hasChanges !== 1) return false;

  return git(["diff", "--quiet", base, "HEAD", "--", ".", ":(exclude)*.md"]) === 0;
}

function resolveCommit(value) {
  if (!/^[0-9a-f]{40}$/i.test(value)) return undefined;

  const result = git(["rev-parse", "--verify", `${value}^{commit}`], true);
  return result?.status === 0 && /^[0-9a-f]{40}$/i.test(result.stdout) ? result.stdout : undefined;
}

function hasCompleteRange(base) {
  const commits = git(["rev-list", "--parents", `${base}..HEAD`], true);
  return (
    commits?.status === 0 &&
    commits.stdout.split("\n").every((commit) => commit.split(" ").filter(Boolean).length > 1)
  );
}

function firstPreviewDocsOnly() {
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL_ENV !== "preview" || !branch || branch === "master") return false;
  if (git(["check-ref-format", `refs/heads/${branch}`]) !== 0) return false;
  if (git(["remote", "get-url", "origin"]) !== 0) return false;

  const remoteBranch = `refs/remotes/origin/${branch}`;
  const fetched = git([
    "fetch",
    "--no-tags",
    `--depth=${FETCH_DEPTH}`,
    "origin",
    "+refs/heads/master:refs/remotes/origin/master",
    `+refs/heads/${branch}:${remoteBranch}`,
  ]);
  if (fetched !== 0) return false;

  // Confirm that the fetched branch really contains this deployed commit. This
  // also prevents a shallow or rewritten ref from becoming a guessed baseline.
  if (git(["merge-base", "--is-ancestor", "HEAD", remoteBranch]) !== 0) return false;

  const mergeBase = git(["merge-base", "HEAD", "refs/remotes/origin/master"], true);
  if (!mergeBase || mergeBase.status !== 0 || !/^[0-9a-f]{40}$/i.test(mergeBase.stdout))
    return false;
  if (git(["merge-base", "--is-ancestor", mergeBase.stdout, "HEAD"]) !== 0) return false;
  if (git(["merge-base", "--is-ancestor", mergeBase.stdout, "refs/remotes/origin/master"]) !== 0) {
    return false;
  }
  if (!hasCompleteRange(mergeBase.stdout)) return false;

  return changedOnlyMarkdown(mergeBase.stdout);
}

const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;

if (previousSha) {
  const previousCommit = resolveCommit(previousSha);
  process.exitCode = previousCommit && changedOnlyMarkdown(previousCommit) ? SKIP : BUILD;
} else {
  process.exitCode = firstPreviewDocsOnly() ? SKIP : BUILD;
}
