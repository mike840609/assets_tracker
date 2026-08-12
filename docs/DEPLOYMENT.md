# Deployment and Self-Hosting

astt can run as a single Docker container backed by PostgreSQL or as a Vercel project backed by Neon. The application must use HTTPS in production because authentication credentials and financial data should never travel over plaintext connections.

## Required environment variables

| Variable                  | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `DATABASE_URL`            | Runtime PostgreSQL connection                    |
| `DIRECT_URL`              | Optional direct migration connection             |
| `AUTH_SECRET`             | NextAuth signing/encryption secret               |
| `AUTH_SELF_HOST_PASSWORD` | Single-owner password for a non-Vercel self-host |
| `CRON_SECRET`             | Bearer token for `/api/cron/snapshot`            |
| `NEXT_PUBLIC_APP_URL`     | Canonical public application URL                 |
| `POSTGRES_PASSWORD`       | Bundled Docker PostgreSQL password               |

Generate URL-safe secrets with `openssl rand -hex 32`. `AUTH_SELF_HOST_PASSWORD` must contain at least 16 characters. See [`.env.example`](../.env.example) for optional Google OAuth, Preview, and Sentry settings.

Non-Vercel production requires at least one authentication method:

- Set `AUTH_SELF_HOST_PASSWORD` for the built-in single-owner login.
- Optionally set both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to enable Google OAuth alongside or instead of the self-host password.

Vercel production requires Google OAuth and never enables the self-host credentials provider. Google OAuth requires an authorized origin matching `NEXT_PUBLIC_APP_URL` and an authorized redirect URI at:

```text
https://your-domain.example/api/auth/callback/google
```

## Docker Compose

The default Compose profile starts PostgreSQL only for local development:

```bash
pnpm db:up
```

The `full` profile pulls and starts the published migration and application images:

```bash
cp .env.example .env
# Set AUTH_SECRET, AUTH_SELF_HOST_PASSWORD, CRON_SECRET, and NEXT_PUBLIC_APP_URL
docker compose --profile full pull
docker compose --profile full up --no-build -d
```

Set `ASSETS_TRACKER_VERSION` in `.env` to pin both images to a release tag. Leave it unset to follow `latest`. To build both images from source, use `docker compose --profile full up --build -d`.

Services start in this order:

1. `db` becomes ready.
2. `migrate` applies every committed Prisma migration and exits successfully.
3. `app` starts only after migrations complete.

The database port binds to localhost on `POSTGRES_PORT` (default `5432`), while the application is exposed on `APP_PORT` (default `3000`). Put a TLS-terminating reverse proxy such as Caddy, nginx, or your hosting platform in front of the application for public access.

Useful commands:

```bash
docker compose --profile full ps
docker compose --profile full logs -f app
docker compose --profile full run --rm migrate
docker compose --profile full down
```

Do not add `-v` to `down` unless you intend to delete the PostgreSQL volume.

### Building public variables

Variables prefixed with `NEXT_PUBLIC_` are embedded during `docker build`. Rebuild the image after changing `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SENTRY_DSN`.

### Scaling

The bundled configuration targets one application instance. Multiple replicas need a shared Next.js cache handler and coordinated scheduled jobs. Running the cron endpoint from more than one scheduler may duplicate work.

## Vercel and Neon

Configure Production and Preview variables separately in Vercel. The Neon integration should map each environment to a different database branch so previews cannot access production financial data.

The Vercel build command is `pnpm run build:vercel`, which:

1. Runs `prisma migrate deploy`.
2. Regenerates the Prisma client.
3. Runs `next build`.

A migration failure stops publication. `SKIP_PRISMA_MIGRATE_DEPLOY=1` is an emergency-only escape hatch and must not be left configured.

Preview authentication requires `PREVIEW_AUTH_PASSWORD` when `VERCEL_ENV=preview`. `AUTH_REDIRECT_PROXY_URL` may be used for providers that require a stable callback URL.

## Public Demo rollout and rollback

The anonymous public Demo is disabled by default and must be enabled separately in each environment with `PUBLIC_DEMO_ENABLED=true`. Apply the `DemoWorkspace` migration before enabling it. Start in an isolated Preview database; do not enable the flag in Production until the Preview checklist below is complete. Internal Test Login remains governed only by the existing Preview authentication settings.

Each workspace is isolated under its own temporary `User` and expires after 24 hours. Capacity is limited to 250 active workspaces globally and five per pseudonymous source. A workspace permits 30 mutations per minute, 250 lifetime mutations, three resets, and three market refreshes per ten minutes. Expired users are deleted in batches of 25, up to 250 users and a five-second cleanup budget per cron invocation. Size the database for the active cap plus up to 24 hours of deletion lag.

Operational logs and dashboards may contain only low-cardinality lifecycle event names and aggregate durations/counts. Never log visitor cookies, source hashes, user or row IDs, symbols, tokens, or financial values. The source hash is purpose-separated and used only for abuse/capacity control; raw IP addresses are not stored by the Demo feature.

Rollout checklist:

- In Preview, run ten concurrent distinct visitor creates after one warm-up and confirm p95 is under five seconds.
- Confirm create and reset make zero external calls and fixture persistence uses at most 15 statement groups.
- Record database CPU utilization and application compute CPU utilization for representative formal cron runs over a 24-hour pre-enable baseline window, compare the same metrics over an equivalent post-enable window, and immediately set `PUBLIC_DEMO_ENABLED=false` and redeploy/restart if either exceeds the baseline by more than 10%.
- Watch only low-cardinality created, resumed, reset, expired, deleted, limited, and failure counts.
- Exercise the kill switch and verify formal authentication and Preview Internal Test Login still work.

To roll back, set `PUBLIC_DEMO_ENABLED=false` first and redeploy/restart. This immediately hides the entry point, blocks active Demo sessions and APIs, and leaves formal authentication available. Keep the migration and cleanup job in place until all expired temporary users have been removed. Do not drop `DemoWorkspace` while temporary users remain: the relation is the authoritative cleanup boundary. Re-enable the flag to resume an unexpired visitor's existing workspace and original expiry.

## Scheduled snapshots

Vercel reads `vercel.json` and calls `/api/cron/snapshot` daily at 21:30 UTC. The endpoint requires:

```http
Authorization: Bearer <CRON_SECRET>
```

Outside Vercel, configure exactly one trusted scheduler to send the same authenticated request. The job refreshes prices and exchange rates, materializes due recurring transactions, and writes net-worth snapshots.

## Health and monitoring

`GET /api/health` reports database, snapshot, and cron freshness without exposing user data. A fresh installation returns `503 degraded` until it has a successful snapshot and cron run; this is readiness information, not an application-process failure. The Docker container therefore uses `/login` for its liveness check.

Sentry is optional. Leave every Sentry variable unset for a no-op integration, or configure both server and browser DSNs as described in `.env.example`.

## Upgrades and backups

Back up PostgreSQL before upgrading. Then pull the release and rebuild:

```bash
git pull
docker compose --profile full up --build -d
```

The migration service applies pending schema changes before the new application starts. Review release notes for manual actions and test database restoration periodically. See [DATABASE.md](./DATABASE.md).
