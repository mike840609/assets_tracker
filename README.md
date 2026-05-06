# Assets Tracker

A modern, high-performance net worth and investment tracker. Built with **Next.js 16**, **Prisma 7**, and **Tailwind CSS 4**.

![Assets Tracker](./public/opengraph-image.png)

## Features

- **Google OAuth**: Secure multi-user authentication via NextAuth.js v5.
- **Real-time Price Tracking**: Automatically fetches latest prices for stocks, ETFs, and cryptocurrencies via Yahoo Finance 2, with CoinGecko as a fallback for crypto.
- **Multi-Currency Support**: Track assets in USD, TWD, EUR, and more. All values are automatically converted to your selected base currency.
- **Portfolio Analysis**: Dedicated `/analysis` tab with allocation breakdowns, performance metrics, and insights across your full portfolio.
- **Trend Visualization**: Interactive charts showing net worth, assets, and liabilities over time.
- **Lossless History**: Snapshots store original account balances and currencies, enabling accurate history normalization even after changing your base currency.
- **Automated Daily Snapshots**: Built-in Vercel Cron integration records your net worth automatically every day.
- **Light / Dark / System Theme**: Full theme support with smooth toggle.
- **Unified Portfolio**: Combine bank accounts, brokerages, and crypto wallets into one dashboard.
- **Internationalization**: English (en-US) and Traditional Chinese (zh-TW), auto-detected from browser locale or configurable via settings.

## Tech Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16.2 (App Router, React 19, RSC)             |
| Language   | TypeScript 5, strict mode                            |
| Database   | PostgreSQL via Prisma 7 (Neon serverless adapter)    |
| Auth       | NextAuth.js v5 (Google OAuth, JWT sessions)          |
| Styling    | Tailwind CSS 4 + shadcn/ui v4 (base-nova style)      |
| i18n       | next-intl                                            |
| Icons      | Lucide React                                         |
| Charts     | Recharts 3                                           |
| Validation | Zod 4                                                |
| Fonts      | Geist Sans / Geist Mono (via `next/font/google`)     |
| Price Data | Yahoo Finance 2 (primary) + CoinGecko (crypto fallback) |

## Getting Started

### 1. Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- A [Neon](https://neon.tech) PostgreSQL database (or any PostgreSQL with a Neon-compatible connection string)
- A Google OAuth app (for authentication)

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="your_neon_postgresql_connection_string"
AUTH_SECRET="your_secure_random_string"
AUTH_GOOGLE_ID="your_google_oauth_client_id"
AUTH_GOOGLE_SECRET="your_google_oauth_client_secret"
CRON_SECRET="your_secure_random_string"

# Preview-only (required when VERCEL_ENV=preview):
# PREVIEW_AUTH_PASSWORD="shared_password_to_gate_preview_access"
# PREVIEW_AUTH_DISABLED="true"  # optional, disables preview password gate
# AUTH_REDIRECT_PROXY_URL="https://stable-preview-host.vercel.app"  # optional, for Google OAuth on preview URLs
```

> [!TIP]
> Generate `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.

### 3. Installation

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # apply committed migrations to your database
```

> [!NOTE]
> For new schema changes during local development, use `npx prisma migrate dev --name <description>` to generate a migration file. `prisma db push` is useful for quick prototyping but bypasses migration history; commit a proper migration before merging.

### 4. Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your dashboard.

### 5. Build

```bash
npm run build              # Standard production build
ANALYZE=true npm run build # Build with bundle analyzer HTML reports
```

### 6. End-to-End Tests

A Playwright suite lives in `tests/e2e/`. The global setup provisions a dedicated test user so runs don't pollute real data.

```bash
npm run test:e2e         # Run headless
npm run test:e2e:ui      # Open the Playwright UI runner
npm run test:e2e:report  # Open the last HTML report
```

## Automated Snapshots (Cron Jobs)

This project is optimized for **Vercel** and includes native cron job support via `vercel.json`.

- **Endpoint**: `/api/cron/snapshot`
- **Schedule**: Every day at 21:30 UTC (`30 21 * * *`)
- **Security**: Protected via `CRON_SECRET` bearer token header verification
- **Region**: Functions are pinned to `sin1` to colocate with the Neon database. If your Neon project is in a different region, update `regions` in `vercel.json` to match.

To enable automation, deploy to Vercel and set all environment variables in your project settings. Vercel only runs cron jobs on production deployments.

### Preview Deployments

Vercel preview deployments use a **separate Neon branch** so they never touch production data:

- Set `DATABASE_URL` with two scopes in Vercel → Settings → Environment Variables: one for **Production** (prod Neon branch) and one for **Preview** (a dedicated `preview` Neon branch). If your `DATABASE_URL` is managed by the Neon-Vercel integration, configure the per-environment branch mapping inside the integration UI instead.
- The Vercel build runs `npm run build:vercel` (= `prisma migrate deploy && next build`), so each deploy applies pending migrations to whichever DB is wired in for that environment.
- CI / local `npm run build` is plain `next build` and does **not** require a database.

## Net Worth History & Currency Normalization

Tracking net worth across multiple currencies and time periods is complex. This project uses a **lossless snapshot** architecture to ensure your history remains accurate even if you change your base currency.

### Snapshot Creation (`snapshot-service.ts`)

When a snapshot is taken (manually or via cron), the system:
- Calculates your current net worth in your current base currency.
- Stores a lossless breakdown in a JSON field, recording every account's original balance and original currency.

### History Normalization (`history-service.ts`)

When you view your history chart or table, the system:
- Fetches all historical snapshots for your user.
- Identifies your current preferred base currency from settings.
- For each snapshot, converts every account balance from its original currency to your current base currency using the latest available exchange rates.
- For snapshots taken before the lossless system was implemented, converts the snapshot's total value from its original base currency to your current one.

This ensures trend lines remain continuous and comparable regardless of currency fluctuations or setting changes.

## Roadmap

- [SUGGESTIONS.md](./docs/SUGGESTIONS.md) — prioritized feature backlog across the whole app
- [ANALYSIS_ROADMAP.md](./docs/ANALYSIS_ROADMAP.md) — phased roadmap for the `/analysis` tab

## License

MIT
