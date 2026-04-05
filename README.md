# 💰 Asset Tracker

A modern, high-performance net worth and investment tracker. Built with **Next.js 16**, **Prisma**, and **Tailwind CSS**.

![Dashboard Mockup](https://images.unsplash.com/photo-1611974714013-3c8c0d088bd3?auto=format&fit=crop&q=80&w=1200&h=400)

## ✨ Features

- **🔐 Google OAuth**: Secure multi-user authentication via NextAuth.js v5.
- **🚀 Real-time Tracking**: Automatically fetch latest prices for Stocks, ETFs, and Cryptocurrencies (via Yahoo Finance + CoinGecko fallback).
- **🌍 Multi-Currency Support**: Track assets in USD, TWD, EUR, and more. All values are automatically converted to your selected **Base Currency**.
- **📈 Trend Visualization**: Interactive charts showing your net worth, assets, and liabilities over time.
- **🤖 Automated Snapshots**: Built-in Vercel Cron integration to automatically record your net worth daily.
- **🌗 Light / Dark / System Theme**: Full theme support with smooth toggle.
- **💼 Unified Portfolio**: Combine bank accounts, brokerages, and crypto wallets into one dashboard.
- **🌐 Internationalization**: English (en-US) and Traditional Chinese (zh-TW), auto-detected from browser.

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

- Node.js 18+
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

## 🤖 Automated Snapshots (Cron Jobs)

This project is optimized for **Vercel** and includes native Cron Job support via `vercel.json`.

- **Endpoint**: `/api/cron/snapshot`
- **Schedule**: Every day at 00:00 UTC.
- **Security**: Protected via `CRON_SECRET` header verification.

To enable automation, deploy to Vercel and set all environment variables in your project settings.

## 📝 Roadmap

Check the [SUGGESTIONS.md](./SUGGESTIONS.md) file for the prioritized feature roadmap.

## 📄 License

MIT
