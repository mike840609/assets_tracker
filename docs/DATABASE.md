# Database and Migrations

Assets Tracker uses PostgreSQL through Prisma. Standard PostgreSQL connections use `@prisma/adapter-pg`; Neon connections automatically use `@prisma/adapter-neon`.

## Connection variables

- `DATABASE_URL` — runtime connection. A pooled Neon URL is recommended for hosted deployments.
- `DIRECT_URL` — optional direct connection used by Prisma migrations. When omitted, Prisma falls back to `DATABASE_URL`.

For local development, `.env.example` contains URLs for the PostgreSQL service in `docker-compose.yml`.

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
