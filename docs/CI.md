# Continuous Integration

astt uses a light-versus-heavy CI split to keep pull-request feedback fast and control GitHub Actions usage.

## Pull requests

Pull requests run:

- Prettier formatting checks
- ESLint
- TypeScript type checking
- Vitest unit tests
- Bundle-size checks when relevant
- Playwright smoke tests against an isolated local PostgreSQL database and application build

`.github/workflows/e2e.yml` runs independently of Vercel and uses fixed, non-sensitive test credentials. This makes the check available to external pull requests without exposing repository secrets. The Vercel Git integration also creates a preview deployment; for trusted same-repository pull requests, `.github/workflows/vercel-preview-e2e.yml` runs two specs on desktop Chromium against that deployed preview: `tests/e2e/smoke.spec.ts` for sign-in, landing, dashboard, and the create-account to add-holding write path, and `tests/e2e/landing-social-preview.spec.ts`, whose subject — `getAppAssetUrl`'s `VERCEL_ENV=preview` with `VERCEL_URL` branch — is unreachable on localhost, where `VERCEL_URL` is never set. Full Desktop + Mobile regression stays in `e2e.yml` on localhost.

The deployed-preview workflow authorizes only a successful non-Production deployment created by Vercel, at an HTTPS `*.vercel.app` URL, for a trusted same-repository pull request that is open and whose current head is the deployed SHA. GitHub can associate one commit with every pull request stacked above it, so the workflow refreshes exact-head candidates instead of relying on API order, and drops any candidate it cannot re-read — authorization is the security gate, so an unverifiable pull request is never trusted on the list endpoint's snapshot. Several open pull requests can legitimately share one head commit; all of them are trusted by that point, so the lowest number wins rather than the check being dropped. The selected pull request number keeps concurrency groups independent between stacked pull requests.

Only the newest deployment of a commit runs the suite. Cancellation is off, and a redeployment of the same commit is not stale by the head-SHA test, so authorize skips a deployment that already has a newer non-Production one. A duplicate created after that read still gets its own run: the cost is a repeated suite, never a cancelled one.

Runs for one pull request use the concurrency queue in serialized mode. An already-running five-test smoke run can finish, and newer runs may wait behind it; this avoids an out-of-order old deployment event cancelling a current run or replacing it while pending. The workflow refreshes the pull request before costly setup and again immediately before Playwright, so queued stale commits stop without generating preview test traffic. Unlike authorize, these two reads fail open: trust is already established, so an unreachable API costs at most one suite against a superseded preview rather than turning a GitHub outage into a red check. A superseded run reports green with its steps skipped, which is why the preview job is not a required check — the green belongs to the superseded commit, not to the pull request head. GitHub concurrency admission and API reads are not atomic: a push immediately after the final refresh can still make an already-starting test run stale briefly.

Changes to Docker, Compose, Prisma packaging, or runtime environment configuration also trigger `.github/workflows/docker.yml`. That workflow builds the production image, applies every migration to a fresh PostgreSQL database, starts the application, checks `/login`, and reruns migrations to prove they are idempotent.

## Master branch

Pushes to `master` run the production build path and the self-contained Playwright smoke suite. Documentation-only changes are skipped only by workflows that define path filters.

## Required configuration

- GitHub `E2E_PASSWORD` must match Vercel Preview `PREVIEW_AUTH_PASSWORD` for the optional deployed-preview suite. The required local E2E workflow does not use this secret.
- Preview and Production deployments must use separate databases.
- Vercel must report deployment status back to GitHub for the optional deployed-preview suite. Branch protection should require `Playwright smoke tests` from `.github/workflows/e2e.yml`, not the deployment-triggered workflow.

## Skipping CI

Use `[skip ci]` only for changes that cannot affect application behavior, configuration, deployment, migrations, or generated output. GitHub and Vercel may apply their own path filters independently.

Vercel skips its own build for commits that touch only `*.md`, via `scripts/vercel-ignore.mjs`, which is called by `ignoreCommand` in `vercel.json`. The script returns Vercel's exit codes directly: 0 skips and 1 builds. Its existing-deployment path has three load-bearing details:

- The base is `$VERCEL_GIT_PREVIOUS_SHA`, the last successfully deployed commit, not `HEAD^`. A push of several commits produces one deployment for the head commit only, so an `HEAD^` comparison would skip the build whenever the last commit of the push happened to be documentation — losing the deployment and its preview check for code that was never deployed.
- An invalid or unavailable previous SHA builds. Every Git failure returns 1, so corrupt history cannot turn into a skip.
- An empty diff builds. An empty commit and a redeploy of the same SHA are the two habitual ways to force a deployment after an environment-variable change or a flaky build; without the leading guard both would produce no diff, exit 0, and silently do nothing.

Any code change between the usable base and `HEAD` builds, even if the latest commit itself changes only Markdown. This protects multi-commit pushes from skipping code that has never been deployed.

When a Preview branch has no previous successful deployment, the script also checks the complete change from a bounded, fetched `master` merge base. It skips only if that diff is nonempty and Markdown-only. This fallback is limited to Preview branches with valid non-`master` metadata; unavailable references, fetch failures, a shallow boundary in the compared branch range, rewritten branch history, and all other uncertainty build. Production is unchanged. A skipped update leaves any existing Preview deployment in place; it does not delete it.

To force a documentation-only Preview build, use Vercel's **Redeploy** control and uncheck **Use project's Ignore Build Step**. This is especially useful before a branch has a successful deployment, where Git metadata alone cannot distinguish a manual trigger from the initial deploy.

A skipped build produces no new deployment, so a documentation-only pull request has no new preview and no `vercel-preview-e2e.yml` run. The required `Playwright smoke tests` check from `e2e.yml` runs on `pull_request` and is unaffected.

The rule assumes no `*.md` file is ever served or read by the application. Nothing under `public/` may be markdown, and no build step may read one.

Workflow definitions:

- `.github/workflows/ci.yml`
- `.github/workflows/docker.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/vercel-preview-e2e.yml`
