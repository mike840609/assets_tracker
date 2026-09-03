# Database and Migrations

astt uses PostgreSQL through Prisma. Standard PostgreSQL connections use `@prisma/adapter-pg`; Neon connections automatically use `@prisma/adapter-neon`.

## Connection variables

- `DATABASE_URL` — runtime connection. A pooled Neon URL is recommended for hosted deployments.
- `DIRECT_URL` — optional direct connection used by Prisma migrations. When omitted, Prisma falls back to `DATABASE_URL`.

For local development, `.env.example` contains URLs for the PostgreSQL service in `docker-compose.yml`.

## Numeric precision

Balances, amounts, quantities and prices are `DECIMAL(28, 8)`; net-worth snapshot aggregates are `DECIMAL(28, 2)`. Option strikes stay `DECIMAL(18, 4)`. Exchange rates are `DECIMAL(28, 16)` — wider than the money columns because each refresh also stores the inverse rate, and eight decimals cannot hold `1 / 89500` without a visible error.

The API accepts a smaller range than the columns hold: every amount crosses the wire as a JSON `number`, and an IEEE double keeps roughly 15.95 significant digits, so the validators in `src/lib/validators.ts` reject any magnitude at or above `1e15` (`1e14` for option strikes) with a 400.

That `1e15` bound is a magnitude guard, not a promise that the column's eight fractional decimals survive the wire. A double resolves all eight of them only below `2^26` (about `6.7e7`), where one unit in the last place is `2^-27` ≈ `7.5e-9`; above that the step exceeds `1e-8`, and at `1e15` a double moves in whole steps of `0.125`. Realistic balances sit far below that, and the `DECIMAL(28, 8)` columns leave enough headroom that an accumulating `cashBalance` is impractical to overflow — repeated individually-valid increments could still reach the ceiling in principle, so the column bound is a backstop rather than a guarantee.

## Creating migrations

Create schema changes against a disposable development database:

```bash
pnpm exec prisma migrate dev --name <description>
```

Commit the generated directory under `prisma/migrations/`. Do not edit a migration after it has been deployed to a shared environment.

## Applying migrations

Apply committed migrations in CI, production, or a fresh self-host:

```bash
pnpm exec prisma migrate deploy
```

The Docker Compose `migrate` service and Vercel `build:vercel` command run this operation before starting or publishing the application.

Use `prisma db push` only for disposable prototypes. It bypasses migration history and must not be used as the upgrade mechanism for a persistent installation.

## Resetting local data

```bash
pnpm exec prisma migrate reset
```

This destroys all rows in the target database and rebuilds the schema from committed migrations. Never run it against production.

## Backups

Create and test a database backup before upgrading. For a standard PostgreSQL instance:

```bash
pg_dump --format=custom --file=asset-tracker.dump "${DIRECT_URL:-$DATABASE_URL}"
pg_restore --clean --if-exists --dbname="${DIRECT_URL:-$DATABASE_URL}" asset-tracker.dump
```

Managed providers such as Neon may also offer snapshots or point-in-time restore. A backup is only useful after its restore process has been tested.

## Troubleshooting migration state

Inspect the current state with:

```bash
pnpm exec prisma migrate status
```

`prisma migrate resolve` changes migration metadata and should only be used after verifying that the corresponding schema change already exists or has been rolled back manually. Record any production use in the deployment runbook.
