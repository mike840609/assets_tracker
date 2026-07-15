# Deployment and Self-Hosting

Assets Tracker can run as a single Docker container backed by PostgreSQL or as a Vercel project backed by Neon. The application must use HTTPS in production because authentication credentials and financial data should never travel over plaintext connections.

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

The `full` profile builds and starts migrations plus the standalone Next.js application:

```bash
cp .env.example .env
# Set AUTH_SECRET, AUTH_SELF_HOST_PASSWORD, CRON_SECRET, and NEXT_PUBLIC_APP_URL
docker compose --profile full up --build -d
```

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
