# Development

## Local setup

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:up
pnpm exec prisma migrate deploy
pnpm dev
```

The application runs at `http://localhost:3000`. `pnpm db:up` starts only PostgreSQL; the application runs directly on the host for faster hot reload.

## Validation

Run the same fast checks used for pull requests:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

Run a production build when changing routing, server components, environment handling, or build configuration:

```bash
pnpm build
```

Run the Playwright suite when changing user-facing flows:

```bash
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:e2e:report
```

The E2E global setup creates a dedicated test user so test data does not mix with a normal account.

## Database changes

Use Prisma migrations for persistent schema changes:

```bash
pnpm exec prisma migrate dev --name <description>
pnpm exec prisma migrate deploy
```

`prisma db push` is reserved for disposable experiments. See [DATABASE.md](./DATABASE.md).

## Git worktrees

Worktrees allow several isolated branches to share one Git object database and pnpm content-addressable store:

```bash
git worktree add ../asset_tracker-<task-name> -b <branch-name>
cd ../asset_tracker-<task-name>
pnpm setup:worktree
pnpm dev
```

`setup:worktree` copies `.env` and `.env.local` from the main worktree when they are absent, installs with the frozen lockfile, and regenerates the Prisma client. Set `ASSET_TRACKER_SKIP_ENV_COPY=1` to skip environment copying or pass `-- --prune` to clean unreferenced packages from the pnpm store.

Remove the worktree after merging:

```bash
cd ../asset_tracker
git worktree remove ../asset_tracker-<task-name>
```

## Useful diagnostics

```bash
pnpm store path
pnpm store status
pnpm exec prisma migrate status
```

Never commit `.env`, `.env.local`, database exports, credentials, test reports, or generated Prisma clients.
