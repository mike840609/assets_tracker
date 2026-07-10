# Fresh self-host migrations design

## Goal

Make a fresh self-hosted PostgreSQL database install correctly through the
repository's documented `prisma migrate deploy` workflow.

## Root cause

The first committed migration currently starts by creating indexes on existing
tables. The original baseline migration,
`20260101000000_initial_schema`, and Prisma's `migration_lock.toml` still
exist in Git history at commit `b6651475`, but are absent from the current
branch. Consequently, a fresh database cannot apply the migration sequence.

## Design

Restore the baseline migration and lock file byte-for-byte from `b6651475`.
This preserves the migration identity that existing databases may already
record in `_prisma_migrations`, then lets every later committed migration run
in its original chronological order.

Keep `scripts/vercel-build.mjs` unchanged: `prisma migrate deploy` remains the
single formal schema-install and schema-upgrade command for production,
preview, and self-hosted deployments. `prisma db push` remains an optional
local prototyping tool, not the documented installation path.

Update the README's local-database steps to use `prisma migrate deploy` and
change the reset guidance to `prisma migrate reset`, which becomes valid after
the baseline is restored. State clearly that either reset command removes local
data.

## Existing database safety

No deployment script will run `prisma migrate resolve` automatically. Before
deploying this change to an existing database, the maintainer must inspect
`_prisma_migrations`:

- If it already records `20260101000000_initial_schema`, deploy normally.
- If the schema exists but that migration is absent, run
  `prisma migrate resolve --applied 20260101000000_initial_schema` exactly
  once against that database before the next `migrate deploy`.

## Verification

Use an empty temporary PostgreSQL database, separate from all developer data:

1. Start the repository's Docker PostgreSQL service.
2. Create a dedicated temporary database inside that service.
3. Set `DATABASE_URL` to that database and run `pnpm exec prisma migrate deploy`.
4. Run `pnpm exec prisma migrate status` and query `_prisma_migrations` to
   confirm every committed migration, including the baseline, was applied.
5. Run `pnpm typecheck` and `pnpm test:unit`.
6. Drop only the dedicated temporary database after the checks pass.

If Docker remains unavailable, report that environmental blocker rather than
claiming fresh-install verification passed.
