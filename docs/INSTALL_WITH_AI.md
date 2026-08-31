# Installing astt with an AI Agent

> This guide is written for an LLM/AI coding agent to follow verbatim. Read this entire file before running any command. The only file you must protect is `.env` — never commit it. If a step fails, stop and report.

There are two supported install paths — decide which one the user wants in §2 before running any command:

- **Path A — Local development**: the app runs on the host with `pnpm dev`; only PostgreSQL runs in a Docker container. Best for trying the app, development, and demo data.
- **Path B — Production deployment**: the whole stack (app + migrations + database) runs in Docker Compose from prebuilt GHCR images. Best for long-term self-hosting.

## 1. Goal

Bring up a working astt instance — reachable at http://localhost:3000 for a local setup, or at the user's public origin for a production deployment — with secrets generated, migrations applied, and a working sign-in. "Done" = every item in the checklist for your chosen path (§6) passes.

## 2. Which install path?

|                   | Path A — Local development                  | Path B — Production (Docker Compose)                     |
| ----------------- | ------------------------------------------- | -------------------------------------------------------- |
| How the app runs  | on the host via `pnpm dev`                  | in a Docker container (Next.js server)                   |
| Database          | bundled PostgreSQL container (`pnpm db:up`) | bundled PostgreSQL container                             |
| Host requirements | Node.js 24, pnpm (corepack), Docker         | Docker with Compose (no Node needed for prebuilt images) |
| Best for          | trying the app, development, demo data      | long-term self-hosting                                   |
| Image source      | source checkout                             | prebuilt GHCR images (or build from source)              |
| End state         | dev server on http://localhost:3000         | production server on http://localhost:3000               |

Ask the user which path they want. If they are unsure, recommend **Path B** — it needs only Docker and has the fewest install steps.

## 3. Path A — Local development

### 3.1 Prerequisites

| Command                                                                               | Expected                               | If it fails                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `node -v`                                                                             | `v24.x`                                | install Node 24 and retry (engines require Node 24; pnpm dev fails fast via check-node-version.mjs) |
| `corepack --version`                                                                  | prints a version                       | see Troubleshooting (corepack missing)                                                              |
| `docker version` and `docker compose version`                                         | both succeed                           | install Docker + Docker Compose                                                                     |
| `docker info`                                                                         | succeeds (daemon running)              | start Docker Desktop, wait for it to be ready, retry                                                |
| working directory is a clone of mike840609/assets_tracker with `.env.example` present | `.env.example` exists in the repo root | clone the repository (see Step 1) and run the rest from the repo root                               |

### 3.2 Installation steps

#### Step 1 — Clone the repository (skip if already present)

```bash
git clone https://github.com/mike840609/assets_tracker.git
cd assets_tracker
```

Gate: `test -f .env.example` succeeds.

Only continue when the gate passes.

#### Step 2 — Create the environment file

```bash
cp .env.example .env
```

Gates:

- `test -f .env` succeeds.
- `grep -c "replace-with-long-random-secret" .env` prints `3` (the three placeholder secrets).

Only continue when the gates pass.

#### Step 3 — Generate secrets and write them into `.env` in place

```bash
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
AUTH_SELF_HOST_PASSWORD=$(openssl rand -hex 32)
```

Each is 64 hex chars, comfortably above the required 16-char minimum for `AUTH_SELF_HOST_PASSWORD`. Replace the three placeholder values in-place (for example with `perl -i -pe` or `sed`). Leave `DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_APP_URL` at the `.env.example` localhost defaults.

Gates:

- `grep '^AUTH_SECRET=' .env` shows a 64-hex value, not the placeholder.
- `grep '^CRON_SECRET=' .env` shows a 64-hex value.
- `grep '^AUTH_SELF_HOST_PASSWORD=' .env | wc -c` prints a number ≥ 16.
- `git check-ignore .env` prints `.env` (confirmed gitignored).

Only continue when the gates pass.

#### Step 4 — Enable corepack and install dependencies

```bash
corepack enable
pnpm install
```

Gates:

- `pnpm --version` prints `11.6.0`.
- `test -d node_modules/.bin` succeeds.

Only continue when the gates pass.

#### Step 5 — Start the local database

```bash
pnpm db:up
```

This runs `docker compose up -d db`.

Gates:

- `docker compose ps` shows a `db` container Up/healthy.
- Postgres is listening on 5432 (`lsof -iTCP:5432 -sTCP:LISTEN`).

Only continue when the gates pass.

#### Step 6 — Apply migrations

```bash
pnpm exec prisma migrate deploy
```

Gate: the command exits 0 and output contains "All migrations have been applied".

Only continue when the gate passes.

#### Step 7 — Start the app

```bash
pnpm dev
```

Keep it running in a background or dedicated terminal.

Gate: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login` prints `200`.

Note: `GET /api/health` reports `503 degraded` on a fresh install until the first snapshot and cron run have succeeded — that is readiness information, not a failure. Use the `/login` check above (the same check the container healthcheck uses) as the liveness gate.

Only continue when the gate passes.

#### Step 8 — Verify sign-in

Open http://localhost:3000, use the one-click Internal Test Login (Path A only — local dev, no password) or the owner `AUTH_SELF_HOST_PASSWORD` login, and confirm the dashboard loads. Optionally `pnpm seed:demo`.

Gate: the dashboard renders after sign-in.

Only continue when the gate passes.

## 4. Path B — Production deployment with Docker Compose

The whole stack — `db`, the one-shot `migrate` service, and `app` — runs in Docker Compose. `app` waits for `migrate` to complete successfully before starting. Data persists in the `postgres_data` volume across restarts.

### 4.1 Prerequisites

| Command                               | Expected             | If it fails                           |
| ------------------------------------- | -------------------- | ------------------------------------- |
| `docker version` and `docker compose` | both succeed         | install Docker + Docker Compose       |
| `docker info`                         | succeeds (daemon up) | start Docker Desktop, wait, retry     |
| `git --version`                       | prints a version     | install git (needed to clone/upgrade) |
| `.env.example` present in repo root   | file exists          | clone the repository first (Step 0)   |

### 4.2 Clone the repository (skip if already in a clone)

```bash
git clone https://github.com/mike840609/assets_tracker.git
cd assets_tracker
```

Gate: `test -f .env.example` succeeds.

Only continue when the gate passes.

### 4.3 Configure the environment

```bash
cp .env.example .env
```

Set production values in `.env`:

- `NEXT_PUBLIC_APP_URL` — the canonical HTTPS origin users will reach the app at (not localhost).
- `POSTGRES_PASSWORD` — a strong value; the app and migrate services reuse it for the bundled database.
- `AUTH_SECRET` — `openssl rand -hex 32` (required; Compose fails fast if unset).
- `CRON_SECRET` — `openssl rand -hex 32` (required; Compose fails fast if unset).
- `AUTH_SELF_HOST_PASSWORD` — `openssl rand -hex 32`, ≥ 16 chars, for the single-owner login.
- Optionally `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` to enable Google OAuth.

Gates:

- `grep '^AUTH_SECRET=' .env` shows a 64-hex value, not the placeholder.
- `grep '^CRON_SECRET=' .env` shows a 64-hex value.
- `grep '^AUTH_SELF_HOST_PASSWORD=' .env | wc -c` prints a number ≥ 16.
- `git check-ignore .env` prints `.env` (confirmed gitignored).
- `NEXT_PUBLIC_APP_URL` is set to the real public origin.

Only continue when the gates pass.

### 4.4 Deploy the full stack

Pull the prebuilt application and migration images from GHCR, then start the stack:

```bash
docker compose --profile full pull
docker compose --profile full up --no-build -d
```

Gates:

- `docker compose ps` shows `migrate` exited with code 0 and `app` Up.
- `docker compose logs migrate` shows the migrations were applied (Prisma "All migrations have been applied") and no errors.
- `docker compose ps` shows `app` as healthy once the healthcheck passes.

Only continue when the gates pass.

### 4.5 Verify

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:${APP_PORT:-3000}/login
```

Gate: prints `200`.

Note: `GET /api/health` reports `503 degraded` on a fresh install until the first snapshot and cron run have succeeded. That is readiness information, not a failure — use the `/login` check above (the same check the container healthcheck uses) as the liveness gate. Open the app in a browser and confirm sign-in works with `AUTH_SELF_HOST_PASSWORD` (or Google OAuth if configured).

Only continue when the gates pass.

### 4.6 Build from source (optional)

Instead of pulling prebuilt images:

```bash
docker compose --profile full up --build -d
```

Gates are the same as §4.4 and §4.5.

### 4.7 Upgrade

```bash
git pull
docker compose --profile full pull
docker compose --profile full up --no-build -d
```

Back up the database (the `postgres_data` volume) before upgrading. Review the release notes on the astt GitHub releases page first.

### 4.8 Stop and reset

```bash
# Stop the stack; data stays in the postgres_data volume
docker compose --profile full down

# Full reset — DELETE all database data (destructive)
docker compose --profile full down -v
```

## 5. If something fails — stop, report, roll back

- Report the exact command, full error output, and step number. Do not invent fixes.
- Never commit `.env`; `git status` must always show it as ignored/untracked.
- Safe rollback:

```bash
# Path A (fresh install only)
pnpm db:down
docker compose down -v        # nuke DB data (destructive)
rm -rf node_modules && pnpm install
git clean -fd                 # reset untracked files (use with care)

# Path B — stop the stack; add -v to also delete database data (destructive)
docker compose --profile full down
```

## 6. Done? Run this final checklist

### 6.1 Path A — Local development

- [ ] `node -v` → Node 24.x
- [ ] `.env` exists and all three secrets are generated 64-hex values (no placeholders)
- [ ] `docker compose ps` → db running/healthy
- [ ] `pnpm exec prisma migrate deploy` → all migrations applied
- [ ] `curl http://localhost:3000/login` → 200
- [ ] http://localhost:3000 loads and sign-in works (Internal Test Login or owner password)
- [ ] `git status` shows `.env` is NOT tracked
- [ ] stop with `pnpm db:down` when done

### 6.2 Path B — Production deployment

- [ ] `.env` exists; `AUTH_SECRET` and `CRON_SECRET` are generated 64-hex values; `AUTH_SELF_HOST_PASSWORD` is ≥ 16 chars
- [ ] `NEXT_PUBLIC_APP_URL` is the real public origin; `POSTGRES_PASSWORD` is changed from the default
- [ ] `docker compose --profile full pull` succeeded
- [ ] `docker compose ps` → `migrate` exited 0, `app` Up and healthy
- [ ] `curl http://localhost:3000/login` → 200
- [ ] sign-in works in a browser with `AUTH_SELF_HOST_PASSWORD` (or Google OAuth)
- [ ] `git status` shows `.env` is NOT tracked
- [ ] data persists in `postgres_data` across `docker compose down` / `up`

## 7. Troubleshooting

| Symptom                                  | Likely cause                                  | Fix                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Port 3000 in use                         | another dev server                            | `lsof -iTCP:3000 -sTCP:LISTEN`; stop/kill it; keep NEXT_PUBLIC_APP_URL consistent with any port change (or set APP_PORT)                     |
| Docker daemon down                       | Docker Desktop stopped                        | `docker info` fails; start Docker, wait, retry `pnpm db:up` / `docker compose ... up`                                                        |
| corepack/pnpm missing                    | Node without corepack                         | `corepack enable`; if still missing `corepack prepare pnpm@11.6.0 --activate`; verify `pnpm --version`                                       |
| Node version mismatch                    | wrong Node                                    | check-node-version.mjs fails fast; switch to Node 24 (`nvm use 24` / volta) and retry                                                        |
| `prisma migrate deploy` fails            | DB not up, or DATABASE_URL not local          | confirm the db container is healthy (Path A Step 5 gate); confirm DATABASE_URL/DIRECT_URL point at the local container; retry                |
| `pnpm seed:demo` refuses                 | seed only allows localhost DATABASE_URL       | use the local dev DB (default); pass `--force` only when intentionally targeting a non-local DB                                              |
| Compose fails: "Set AUTH_SECRET in .env" | AUTH_SECRET unset in .env                     | generate with `openssl rand -hex 32` and write it into `.env`; same for CRON_SECRET; re-run `docker compose --profile full up --no-build -d` |
| `migrate` service fails                  | db not healthy, or POSTGRES_PASSWORD mismatch | `docker compose logs migrate`; confirm the db container is healthy; keep POSTGRES_PASSWORD consistent across `.env` and the compose URLs     |
| `app` shows Unhealthy                    | app not responding on /login                  | `docker compose logs app`; confirm `curl -s -o /dev/null -w '%{http_code}' http://localhost:${APP_PORT:-3000}/login` prints 200              |
| `/api/health` returns 503                | fresh install before first snapshot           | expected until the first snapshot and cron run succeed; use the `/login` liveness check instead                                              |
