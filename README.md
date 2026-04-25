# 💰 Assets Tracker

A modern, high-performance net worth and investment tracker. Built with **Next.js 16**, **Prisma**, and **Tailwind CSS**.

![Assets Tracker](./public/opengraph-image.png)

## ✨ Features

- **🔐 Google OAuth**: Secure multi-user authentication via NextAuth.js v5.
- **🚀 Real-time Tracking**: Automatically fetch latest prices for Stocks, ETFs, and Cryptocurrencies (via Yahoo Finance + CoinGecko fallback).
- **🌍 Multi-Currency Support**: Track assets in USD, TWD, EUR, and more. All values are automatically converted to your selected **Base Currency**.
- **📈 Trend Visualization**: Interactive charts showing your net worth, assets, and liabilities over time.
- **🔄 Lossless History**: Snapshots store original account balances and currencies, allowing perfectly accurate history normalization even if you change your base currency later.
- **🤖 Automated Snapshots**: Built-in Vercel Cron integration to automatically record your net worth daily.
- **🌗 Light / Dark / System Theme**: Full theme support with smooth toggle.
- **💼 Unified Portfolio**: Combine bank accounts, brokerages, and crypto wallets into one dashboard.
- **🌐 Internationalization**: English (en-US) and Traditional Chinese (zh-TW), auto-detected from browser.
- **📊 Lossless Data Integrity**: Detailed breakdown of historical snapshots ensuring currency conversion accuracy over time.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: PostgreSQL via Prisma 7 (Neon serverless adapter)
- **Auth**: NextAuth.js v5 (Google OAuth, JWT sessions)
- **Styling**: Tailwind CSS 4 + shadcn/ui v4
- **i18n**: next-intl
- **Icons**: Lucide React
- **Charts**: Recharts
- **Validation**: Zod 4

## 🚀 Getting Started

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
```

> [!TIP]
> Generate `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`.

### 3. Installation

```bash
npm install
npx prisma generate
npx prisma db push
```

### 4. Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your dashboard.

### 5. End-to-End Tests

A Playwright suite lives in `tests/e2e/`. The global setup provisions a dedicated test user so runs don't pollute real data.

```bash
npm run test:e2e         # Run headless
npm run test:e2e:ui      # Open the Playwright UI runner
npm run test:e2e:report  # Open the last HTML report
```

## 🤖 Automated Snapshots (Cron Jobs)

This project is optimized for **Vercel** and includes native Cron Job support via `vercel.json`.

- **Endpoint**: `/api/cron/snapshot`
- **Schedule**: Every day at 21:30 UTC (`30 21 * * *`).
- **Security**: Protected via `CRON_SECRET` header verification.
- **Region**: Functions are pinned to `sin1` to colocate with the Neon database. If your Neon project lives in a different region, update `regions` in `vercel.json` to match.

To enable automation, deploy to Vercel and set all environment variables in your project settings.

## 💹 Net Worth History & Currency Normalization

Tracking net worth across multiple currencies and time periods is complex. This project uses a **Lossless Snapshot** architecture to ensure your history remains accurate even if you change your base currency.

### 1. Snapshot Creation (`snapshot-service.ts`)
When a snapshot is taken (manually or via Cron), the system:
- Calculates your current net worth in your current **Base Currency**.
- Stores a **Lossless Breakdown** in a JSON field, recording every account's **original balance** and **original currency**.

### 2. History Normalization (`history-service.ts`)
When you view your history chart or table, the system:
- Fetches all historical snapshots for your user ID.
- Identifies your current preferred **Base Currency** from settings.
- **On-the-fly Conversion**: For each snapshot, it converts every account balance from its original currency to your current base currency using the **latest available exchange rates**.
- **Legacy Support**: If a snapshot was taken before the lossless system was implemented, it converts the snapshot's total value from its original base currency to your current one.

This approach ensures that your trend lines always remain continuous and comparable, regardless of currency fluctuations or setting changes.

## 📝 Roadmap

- [SUGGESTIONS.md](./docs/SUGGESTIONS.md) — prioritized feature roadmap across the whole app.
- [ANALYSIS_ROADMAP.md](./docs/ANALYSIS_ROADMAP.md) — phased roadmap for the `/analysis` tab.

## 📄 License

MIT
