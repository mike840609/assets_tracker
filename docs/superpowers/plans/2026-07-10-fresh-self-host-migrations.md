# Fresh Self-host Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh PostgreSQL database install and upgrade through the documented `prisma migrate deploy` workflow.

**Architecture:** Restore the original baseline migration and Prisma lock file verbatim from the known historical commit, preserving the existing migration sequence and checksums. The README then uses the same formal command that Vercel already runs; a disposable Docker PostgreSQL database supplies the end-to-end verification.

**Tech Stack:** PostgreSQL 15, Prisma 7, pnpm, Docker Compose, Markdown.

## Global Constraints

- Restore `20260101000000_initial_schema` and `migration_lock.toml` byte-for-byte from commit `b6651475`.
- Keep `prisma migrate deploy` as the formal schema-install and schema-upgrade command for production, preview, and self-hosted deployments.
- `prisma db push` may remain an optional local prototyping tool, but is not the documented installation path.
- Do not automate `prisma migrate resolve`; existing database operators must perform it explicitly only when their migration table lacks the restored baseline record.
- Do not change application code, Prisma schema, existing later migrations, Vercel build behavior, dependencies, or CI workflow scope.
- The verification database must be separate from all developer and production data and be dropped after the test.

---

### Task 1: Restore the migration baseline and align local setup documentation

**Files:**

- Create: `prisma/migrations/20260101000000_initial_schema/migration.sql`
- Create: `prisma/migrations/migration_lock.toml`
- Modify: `README.md:97-117`

**Interfaces:**

- Consumes: historical source blobs at `b6651475:prisma/migrations/20260101000000_initial_schema/migration.sql` and `b6651475:prisma/migrations/migration_lock.toml`.
- Produces: a complete ordered Prisma migration chain consumable by `pnpm exec prisma migrate deploy`.

- [ ] **Step 1: Capture the pre-fix fresh-install failure**

With Docker running, create a disposable database and run the formal install command before restoring the baseline:

```bash
pnpm db:up
docker compose exec -T db createdb -U postgres asset_tracker_fresh_self_host_verify
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
  pnpm exec prisma migrate deploy
```

Expected: Prisma fails on `202604120001_add_hot_path_indexes` because
`HoldingTransaction` does not exist. Record the expected P3018 failure, then
remove only the disposable database and confirm it is absent:

```bash
docker compose exec -T db dropdb -U postgres asset_tracker_fresh_self_host_verify
docker compose exec -T db psql -U postgres -d postgres -Atc \
  "SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'asset_tracker_fresh_self_host_verify');"
```

Expected: the catalog query prints `t`. Task 2 creates a new clean database for
post-fix verification.

- [ ] **Step 2: Restore the exact historical baseline files**

Use the historical blobs as the source of truth. Add their exact contents with
`apply_patch`, then prove they are byte-identical:

```bash
git show b6651475:prisma/migrations/20260101000000_initial_schema/migration.sql \
  | shasum -a 256
shasum -a 256 prisma/migrations/20260101000000_initial_schema/migration.sql

git show b6651475:prisma/migrations/migration_lock.toml | shasum -a 256
shasum -a 256 prisma/migrations/migration_lock.toml
```

Expected: each historical/current checksum pair is identical. The restored
baseline creates the original enum types, auth tables, `Setting`, `Account`,
`Holding`, transactions, cache, exchange-rate, and net-worth tables before the
existing `202604120001` migration creates its indexes.

- [ ] **Step 3: Update the local self-host documentation**

In `README.md`, replace the local setup command:

```markdown
pnpm exec prisma db push
```

with:

```markdown
pnpm exec prisma migrate deploy
```

Replace the reset note with:

```markdown
> [!TIP]
> **Resetting the local database**: To clear all local data and rebuild the schema from the committed migration history, run `pnpm exec prisma migrate reset`. This destroys every row in the target database. `prisma db push --force-reset` remains useful for disposable prototypes, but bypasses migration history.
```

- [ ] **Step 4: Verify formatting and the restored migration chain**

Run:

```bash
pnpm exec prettier --check README.md
find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql | sort
```

Expected: Prettier passes and the first listed migration is
`prisma/migrations/20260101000000_initial_schema/migration.sql`.

- [ ] **Step 5: Commit the baseline repair**

```bash
git add prisma/migrations/20260101000000_initial_schema/migration.sql prisma/migrations/migration_lock.toml README.md
git commit -m "fix: restore fresh database migration baseline"
```

### Task 2: Verify a fresh self-hosted database end-to-end

**Files:**

- No repository files created or modified.

**Interfaces:**

- Consumes: the restored migration chain and disposable database `asset_tracker_fresh_self_host_verify`.
- Produces: terminal evidence that a fresh PostgreSQL schema receives every committed migration and is cleanly removed afterward.

- [ ] **Step 1: Create a new disposable verification database**

Run:

```bash
docker compose exec -T db createdb -U postgres asset_tracker_fresh_self_host_verify
```

Expected: the command succeeds because Task 1 removed this exact database after
recording the expected pre-fix failure.

- [ ] **Step 2: Apply all migrations to the clean database**

Run:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
  pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/asset_tracker_fresh_self_host_verify" \
  pnpm exec prisma migrate status
```

Expected: deploy succeeds, and status reports the database schema is up to date.

- [ ] **Step 3: Verify migration records and a representative application table**

Run:

```bash
docker compose exec -T db psql -U postgres -d asset_tracker_fresh_self_host_verify -Atc \
  'SELECT COUNT(*) FROM "_prisma_migrations";'
docker compose exec -T db psql -U postgres -d asset_tracker_fresh_self_host_verify -Atc \
  'SELECT to_regclass('"'"'public."User"'"'"') IS NOT NULL;'
```

Expected: the migration count equals the number of `migration.sql` files and
the `User` table check returns `t`.

- [ ] **Step 4: Run regression checks**

Run:

```bash
pnpm typecheck
pnpm test:unit
```

Expected: type checking succeeds and every unit test passes.

- [ ] **Step 5: Remove only the disposable verification database**

Run:

```bash
docker compose exec -T db dropdb -U postgres asset_tracker_fresh_self_host_verify
docker compose exec -T db psql -U postgres -d postgres -Atc \
  "SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'asset_tracker_fresh_self_host_verify');"
```

Expected: the final command prints `t`.

- [ ] **Step 6: Confirm verification did not change tracked files**

Run:

```bash
git status --short
```

Expected: no output. Do not create an empty commit for verification.
