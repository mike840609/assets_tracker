# Contributing

## Development

1. Copy `.env.example` to `.env` and provide your own local credentials.
2. Start PostgreSQL with `pnpm db:up`.
3. Sync the schema with `pnpm exec prisma db push`.
4. Start the app with `pnpm dev`.

Never commit `.env`, `.env.local`, database exports, or credentials. Report
vulnerabilities through [the security policy](SECURITY.md), not a public issue.

## Before opening a pull request

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit`.
Update tests and documentation when the change affects behavior.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full local-verification
steps, git-worktree workflow, and preview-deployment setup.

## CI policy (to control free-plan minutes)

This repository uses a **light-vs-heavy CI split**:

- **Pull requests**: run fast checks only (`format:check`, `lint`, `typecheck`, `test:unit`).
- **Push to `master`** (production merge path): run heavy checks (`build`).
- **Vercel preview deployments**: the Playwright `e2e` smoke suite runs against the live preview URL (`deployment_status` trigger; production deployments are skipped since they never render the preview-credentials login). Requires the `E2E_PASSWORD` repo secret to match `PREVIEW_AUTH_PASSWORD` on Vercel previews.
- **Docs-only / markdown-only changes** on push are skipped via workflow `paths-ignore`.
- Add `[skip ci]` to a commit message to skip push-triggered heavy jobs.
- Add `[skip ci]` to PR title/body to skip PR lint/typecheck jobs.

Workflow files: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`.
