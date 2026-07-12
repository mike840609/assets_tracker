# Development Guide

Everything beyond the README's Quick Start: local database workflows, verification steps that mirror CI, git worktrees, and preview deployments.

## Local database

We recommend a local PostgreSQL via Docker for development to avoid incurring Neon compute costs.

```bash
pnpm db:up                        # start local PostgreSQL (Docker)
pnpm exec prisma migrate deploy   # apply committed migrations
pnpm dev                          # http://localhost:3000
pnpm db:down                      # stop the database when done
```

- **New schema changes**: use `pnpm exec prisma migrate dev --name <description>` to generate a migration file. `prisma db push` is still useful for quick prototyping but bypasses migration history; commit a migration before pushing the change.
- **Resetting**: `pnpm exec prisma migrate reset` clears all local data and rebuilds the schema from committed migrations. This destroys every row in the target database. `prisma db push --force-reset` remains useful for disposable prototypes.

## Preview login (no Google OAuth needed)

Locally (and on Vercel preview deployments), a credentials-based **Preview Login** is available on the login page:

- `PREVIEW_AUTH_DISABLED=true` — passwordless Preview Login button; signs in a dedicated test user (`e2e-test@preview.local`).
- `PREVIEW_AUTH_PASSWORD=<value>` — Preview Login gated by a shared password (required on Vercel previews unless disabled).

This means you can develop and run E2E tests without configuring a Google OAuth app — set dummy `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` values.

## Tests

**Unit tests (Vitest).** A fast, DB-free suite lives in `tests/unit/`, covering the pure service-layer logic — net-worth two-pass valuation, exchange-rate resolution, history normalize/dedupe, analysis aggregations, serializers, and Zod validators. Server-only/DB modules are exercised through their real public functions with their dependencies mocked, so no database or env vars are needed.

```bash
pnpm test:unit        # Run once (headless)
pnpm test:unit:watch  # Watch mode
```

**End-to-end tests (Playwright).** A suite lives in `tests/e2e/`. The global setup provisions a dedicated test user so runs don't pollute real data.

```bash
pnpm test:e2e         # Run headless
pnpm test:e2e:ui      # Open the Playwright UI runner
pnpm test:e2e:report  # Open the last HTML report
```

## Verifying locally

Steps to validate a fresh checkout end-to-end — these mirror what CI and Vercel run.

**1. Activate the pinned pnpm**

```bash
corepack enable
pnpm --version          # should print the version pinned in package.json (pnpm 11)
```

> If you still have a `node_modules` from an older npm setup, pnpm may ask to purge it once. Let it (`CI=true pnpm install` auto-confirms in non-interactive shells).

**2. Install + the CI check suite (no database needed)**

```bash
pnpm install --frozen-lockfile   # hardlinks from the shared store; runs prisma generate + husky
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

**3. Production build**

```bash
pnpm build                       # uses your .env
```

No `.env`? Use the CI placeholders just to confirm it compiles:

```bash
DATABASE_URL="postgresql://ci:ci@localhost:5432/ci" \
AUTH_SECRET=x AUTH_GOOGLE_ID=x AUTH_GOOGLE_SECRET=x CRON_SECRET=x \
pnpm build
```

**4. (Optional) Inspect the shared pnpm store**

```bash
pnpm store path                  # global store location (default ~/.local/share/pnpm/store)
pnpm store status
```

Every worktree's `node_modules` hardlinks into this one store, so package files are stored once.

**5. (Optional) Run the app**

```bash
pnpm db:up
pnpm exec prisma db push
pnpm dev                         # http://localhost:3000
pnpm db:down                     # when done
```

> [!NOTE]
> `.nvmrc` pins Node 24. On a different version pnpm prints an `Unsupported engine` warning — harmless; run `nvm use` to match.

## Git worktrees (parallel dev / AI agents)

When you want to work on several branches in parallel — or hand a branch to an AI agent in an isolated sandbox — use git worktrees with the bundled setup script. pnpm keeps a single global **content-addressable store** and builds each worktree's `node_modules` from **hardlinks** into it, so every worktree gets a real `node_modules` while package files are never duplicated on disk and installs after the first are near-instant.

```bash
# 1. Create a worktree for the branch you want to work on
git worktree add ../asset_tracker-<task-name> -b <branch-name>
cd ../asset_tracker-<task-name>

# 2. Install deps + auto-copy env files from the main worktree
pnpm setup:worktree

# 3. Develop as usual
pnpm dev
```

`setup:worktree`:

- Copies `.env` and `.env.local` from the main worktree on first run (won't overwrite — delete in the worktree to refresh; set `ASSET_TRACKER_SKIP_ENV_COPY=1` to opt out). This env-copy is the only thing the script does that pnpm can't.
- Runs `pnpm install --frozen-lockfile`. pnpm hardlinks `node_modules` from its shared global store (so packages are never duplicated across worktrees), and the `postinstall` (`prisma generate`) and `prepare` (`husky`) lifecycle scripts run automatically, so `src/generated/prisma/` and `.husky/_/` are always regenerated.
- Pass `--prune` to garbage-collect unreferenced packages from the store (`pnpm setup:worktree -- --prune`).

When the task is done:

```bash
cd ../asset_tracker             # back to the main checkout
git worktree remove ../asset_tracker-<task-name>
```

> [!TIP]
> pnpm uses one global store (default `~/.local/share/pnpm/store`) shared across all projects and worktrees, so dedup is automatic — no config needed for normal local dev. In ephemeral sandboxes/containers where `$HOME` isn't persisted across sessions, redirect the store to a persistent volume with pnpm's native setting, e.g. `export npm_config_store_dir=/persistent/pnpm-store` before installing. Hardlinks need the store and worktree on the same filesystem; if they differ, pnpm transparently falls back to copying (still correct, just less space-efficient).

> [!NOTE]
> Because each worktree has its own real `node_modules`, you can run `pnpm add <pkg>` directly in a worktree — it updates `package.json` + `pnpm-lock.yaml` without affecting other worktrees.

## Preview deployments (Vercel)

Vercel preview deployments use a **separate Neon branch** so they never touch production data:

- Set `DATABASE_URL` with two scopes in Vercel → Settings → Environment Variables: one for **Production** (prod Neon branch) and one for **Preview** (a dedicated `preview` Neon branch). If your `DATABASE_URL` is managed by the Neon-Vercel integration, configure the per-environment branch mapping inside the integration UI instead.
- The Vercel build runs `pnpm run build:vercel`, which runs the idempotent `prisma migrate deploy` command before `next build`. Migration failures stop the deployment so a build cannot be published against a stale schema. `SKIP_PRISMA_MIGRATE_DEPLOY=1` remains an explicit emergency escape hatch.
- CI / local `pnpm build` is plain `next build` and does **not** require a database.
- Preview access is gated by `PREVIEW_AUTH_PASSWORD` (see [Preview login](#preview-login-no-google-oauth-needed)). `AUTH_REDIRECT_PROXY_URL` can point at a stable preview host so Google OAuth works on ephemeral preview URLs.
