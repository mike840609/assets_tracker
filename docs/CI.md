# Continuous Integration

Assets Tracker uses a light-versus-heavy CI split to keep pull-request feedback fast and control GitHub Actions usage.

## Pull requests

Pull requests run:

- Prettier formatting checks
- ESLint
- TypeScript type checking
- Vitest unit tests
- Bundle-size checks when relevant
- Playwright smoke tests against an isolated local PostgreSQL database and application build

`.github/workflows/e2e.yml` runs independently of Vercel and uses fixed, non-sensitive test credentials. This makes the check available to external pull requests without exposing repository secrets. The Vercel Git integration also creates a preview deployment; for trusted same-repository pull requests, `.github/workflows/vercel-preview-e2e.yml` reruns the suite against that deployed preview.

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
