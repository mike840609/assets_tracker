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

Workflow definitions:

- `.github/workflows/ci.yml`
- `.github/workflows/docker.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/vercel-preview-e2e.yml`
