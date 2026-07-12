# Architecture Notes

## Net worth history & currency normalization

Tracking net worth across multiple currencies and time periods is complex. This project uses a **Lossless Snapshot** architecture to ensure your history remains accurate even if you change your base currency.

### 1. Snapshot creation (`snapshot-service.ts`)

When a snapshot is taken (manually or via Cron), the system:

- Calculates your current net worth in your current **Base Currency**.
- Stores a **Lossless Breakdown** in a JSON field, recording every account's **original balance** and **original currency**.

### 2. History normalization (`history-service.ts`)

When you view your history chart or table, the system:

- Fetches all historical snapshots for your user ID.
- Identifies your current preferred **Base Currency** from settings.
- **On-the-fly Conversion**: For each snapshot, it converts every account balance from its original currency to your current base currency using the **latest available exchange rates**.
- **Legacy Support**: If a snapshot was taken before the lossless system was implemented, it converts the snapshot's total value from its original base currency to your current one.

This approach ensures that your trend lines always remain continuous and comparable, regardless of currency fluctuations or setting changes.

## Automated snapshots (cron)

- **Endpoint**: `/api/cron/snapshot`
- **Schedule**: Every day at 21:30 UTC (`30 21 * * *`, configured in `vercel.json`).
- **Security**: Protected via `CRON_SECRET` header verification.
- **Region**: Functions are pinned to `sin1` to colocate with the Neon database. If your database lives in a different region, update `regions` in `vercel.json` to match.
- **Work done**: Refreshes prices, materializes any due recurring cash/investment transactions (with catch-up), writes a `NetWorthSnapshot` per user, and records a `CronRun` row.
- **Health probe**: `GET /api/health` is an unauthenticated, rate-limited liveness/readiness check. It reports DB reachability plus cron and snapshot freshness (`ok` / `degraded` / `unhealthy`, 503 when stale > 36h) and exposes no user data.

See also [DATABASE.md](./DATABASE.md) for the schema reference.
