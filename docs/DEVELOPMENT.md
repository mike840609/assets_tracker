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

Local development includes a one-click **Preview Login** for the dedicated test user. It does not require `PREVIEW_AUTH_PASSWORD`; hosted Vercel previews remain password-protected by default.

Docker and other non-Vercel production deployments use `AUTH_SELF_HOST_PASSWORD` for the single-owner login by default. The separate preview credentials provider remains disabled. Set `PREVIEW_AUTH_ENABLED=true` only for a non-Vercel production-mode preview; when enabled in production, `PREVIEW_AUTH_PASSWORD` is required unless `PREVIEW_AUTH_DISABLED` is explicitly enabled.

## Demo data

The preview user starts with zero accounts. Populate it without waiting for the daily cron:

```bash
pnpm seed:demo
```

This seeds `e2e-test@preview.local` from `demo-data.json` (repo root) — the same file users can import via Settings → Data: a TWD bank account, Yuanta Securities (2330 + 0050), Charles Schwab (NVDA/TSLA incl. a SELL), Firstrade (AAPL/VOO), a credit-card liability, a goal, recurring rules, a stock watchlist, and 180 consecutive daily net-worth snapshots built from real historical closes (total assets ≈ $62k / NT$2M, base currency USD). All dates are shifted at seed time so the newest snapshot lands on today's Taiwan calendar day — the history always covers the trailing 180 days — and fixed offline prices/exchange rates are cached so nothing calls a market-data service. The command is idempotent (wipes and re-inserts that user's data in a transaction) and refuses to run against a non-localhost `DATABASE_URL` unless `--force` is passed. Restart the dev server afterwards if already-cached pages still show the empty state.

To exercise the real cron pipeline instead (price/FX refresh, recurring materialization, today's snapshot):

```bash
curl -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron/snapshot
```

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

### Reset the local database

These commands permanently delete all local database data. Before running them, confirm that `DATABASE_URL` points to `localhost` or `127.0.0.1`.

Reset the configured development database and reapply all migrations:

```bash
pnpm exec prisma migrate reset --force
```

Optionally repopulate the preview user afterwards:

```bash
pnpm seed:demo
```

To also delete and recreate the Docker database volume:

```bash
docker compose down -v
pnpm db:up
pnpm exec prisma migrate deploy
```

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
