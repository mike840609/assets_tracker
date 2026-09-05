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

A new commit cancels the superseded preview run for the same pull request. The grouping key is the pull request number, which only the authorize job can resolve, so the group lives on the e2e job rather than the workflow: Vercel sets `deployment.ref` to the commit SHA, and workflow-level `concurrency` cannot read `needs`. A commit is associated with every pull request stacked above it, so the job prefers the pull request whose head is that exact commit. One consequence of resolving the key in a first job: a run only enters its group once authorize finishes, so a slower authorize on a newer commit can be cancelled by an older one — the fix is to push again, not to debug the workflow.

Changes to Docker, Compose, Prisma packaging, or runtime environment configuration also trigger `.github/workflows/docker.yml`. That workflow builds the production image, applies every migration to a fresh PostgreSQL database, starts the application, checks `/login`, and reruns migrations to prove they are idempotent.

## Master branch

Pushes to `master` run the production build path and the self-contained Playwright smoke suite. Documentation-only changes are skipped only by workflows that define path filters.

## Required configuration

- GitHub `E2E_PASSWORD` must match Vercel Preview `PREVIEW_AUTH_PASSWORD` for the optional deployed-preview suite. The required local E2E workflow does not use this secret.
- Preview and Production deployments must use separate databases.
- Vercel must report deployment status back to GitHub for the optional deployed-preview suite. Branch protection should require `Playwright smoke tests` from `.github/workflows/e2e.yml`, not the deployment-triggered workflow.

## Skipping CI

Use `[skip ci]` only for changes that cannot affect application behavior, configuration, deployment, migrations, or generated output. GitHub and Vercel may apply their own path filters independently.

Vercel skips its own build for commits that touch only `*.md`, via `ignoreCommand` in `vercel.json`. Four details in that command are load-bearing:

- The base is `$VERCEL_GIT_PREVIOUS_SHA`, the last successfully deployed commit, not `HEAD^`. A push of several commits produces one deployment for the head commit only, so an `HEAD^` comparison would skip the build whenever the last commit of the push happened to be documentation — losing the deployment and its preview check for code that was never deployed.
- `$VERCEL_GIT_PREVIOUS_SHA` stays double-quoted. It is empty on a branch's first deployment; unquoted, the command would degrade there to `git diff --quiet HEAD`, compare against a clean working tree, exit 0, and skip that build with nothing to explain why.
- `|| exit 1` normalizes git's error codes. Vercel defines only 0 (skip) and 1 (build), and every failure mode above — empty base, a SHA missing from the shallow clone — must fall through to building.
- An empty diff builds. An empty commit and a redeploy of the same SHA are the two habitual ways to force a deployment after an environment-variable change or a flaky build; without the leading guard both would produce no diff, exit 0, and silently do nothing.

A skipped build produces no deployment, so a documentation-only pull request has no preview and no `vercel-preview-e2e.yml` run. The required `Playwright smoke tests` check from `e2e.yml` runs on `pull_request` and is unaffected.

The rule assumes no `*.md` file is ever served or read by the application. Nothing under `public/` may be markdown, and no build step may read one.

Workflow definitions:

- `.github/workflows/ci.yml`
- `.github/workflows/docker.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/vercel-preview-e2e.yml`
