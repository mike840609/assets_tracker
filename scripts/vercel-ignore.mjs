import { spawnSync } from "node:child_process";

const BUILD = 1;
const SKIP = 0;
const DEFAULT_BRANCH = "master";
const DEFAULT_BRANCH_REMOTE_REF = `refs/remotes/origin/${DEFAULT_BRANCH}`;
const FETCH_DEPTH = 50;
const GIT_TIMEOUT_MS = 5_000;
// The fetch talks to GitHub; local plumbing does not. A cold shallow fetch of
// this repository can take far longer than the 5s the other commands need.
const FETCH_TIMEOUT_MS = 30_000;

function git(args, captureOutput = false, timeoutMs = GIT_TIMEOUT_MS) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: captureOutput ? ["ignore", "pipe", "ignore"] : "ignore",
    timeout: timeoutMs,
  });

  if (result.error || result.status === null) return undefined;
  return captureOutput ? { status: result.status, stdout: result.stdout.trim() } : result.status;
}

// Every uncertain-history path builds, which is safe but silent: in the build
// log "the fetch never worked" and "this branch changed more than Markdown"
// look identical. Say which one happened.
function bail(reason) {
  console.error(`vercel-ignore: ${reason}; building.`);
  return false;
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
  if (process.env.VERCEL_ENV !== "preview" || !branch || branch === DEFAULT_BRANCH) return false;
  if (git(["check-ref-format", `refs/heads/${branch}`]) !== 0) return false;
  if (git(["remote", "get-url", "origin"]) !== 0) return false;

  // --depth bounds a shallow clone; against a complete one it would *truncate*
  // history that the build itself may later need, so only pass it when the
  // repository is already shallow.
  const shallow = git(["rev-parse", "--is-shallow-repository"], true);
  if (shallow?.status !== 0) return false;

  const remoteBranch = `refs/remotes/origin/${branch}`;
  const fetched = git(
    [
      "fetch",
      "--no-tags",
      ...(shallow.stdout === "true" ? [`--depth=${FETCH_DEPTH}`] : []),
      "origin",
      `+refs/heads/${DEFAULT_BRANCH}:${DEFAULT_BRANCH_REMOTE_REF}`,
      `+refs/heads/${branch}:${remoteBranch}`,
    ],
    false,
    FETCH_TIMEOUT_MS,
  );
  if (fetched !== 0) return bail(`${DEFAULT_BRANCH} fetch failed (${fetched ?? "timed out"})`);

  // Confirm that the fetched branch really contains this deployed commit. This
  // also prevents a shallow or rewritten ref from becoming a guessed baseline.
  if (git(["merge-base", "--is-ancestor", "HEAD", remoteBranch]) !== 0) {
    return bail("deployed commit is not on the fetched branch");
  }

  const mergeBase = git(["merge-base", "HEAD", DEFAULT_BRANCH_REMOTE_REF], true);
  if (!mergeBase || mergeBase.status !== 0 || !/^[0-9a-f]{40}$/i.test(mergeBase.stdout)) {
    return bail(`no ${DEFAULT_BRANCH} merge base reachable in this shallow clone`);
  }
  if (git(["merge-base", "--is-ancestor", mergeBase.stdout, "HEAD"]) !== 0) return false;
  if (git(["merge-base", "--is-ancestor", mergeBase.stdout, DEFAULT_BRANCH_REMOTE_REF]) !== 0) {
    return false;
  }
  if (!hasCompleteRange(mergeBase.stdout)) return bail("merge base range is incomplete");

  return changedOnlyMarkdown(mergeBase.stdout);
}

const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;

if (previousSha) {
  const previousCommit = resolveCommit(previousSha);
  process.exitCode = previousCommit && changedOnlyMarkdown(previousCommit) ? SKIP : BUILD;
} else {
  process.exitCode = firstPreviewDocsOnly() ? SKIP : BUILD;
}
