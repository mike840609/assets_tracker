# 💰 Asset Tracker

A modern, high-performance, and visually stunning net worth and investment tracker. Built with **Next.js 16**, **Prisma**, and **Tailwind CSS**.

![Dashboard Mockup](https://images.unsplash.com/photo-1611974714013-3c8c0d088bd3?auto=format&fit=crop&q=80&w=1200&h=400)

## ✨ Features

- **🚀 Real-time Tracking**: Automatically fetch latest prices for Stocks, ETFs, and Cryptocurrencies (via Yahoo Finance).
- **🌍 Multi-Currency Support**: Track assets in USD, TWD, EUR, and more. All values are automatically converted to your selected **Base Currency**.
- **📈 Trend Visualization**: Interactive charts showing your net worth, assets, and liabilities over time.
- **🤖 Automated Snapshots**: Built-in Vercel Cron integration to automatically record your net worth daily.
- **🌗 Cyber-Glassmorphism UI**: Beautiful, premium design with full support for Light, Dark, and System modes.
- **💼 Unified Portfolio**: Combine bank accounts, brokerages, and crypto wallets into one single dashboard.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (via Prisma ORM)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 18+
- A PostgreSQL database (e.g., Neon, Supabase, or Prisma Postgres)

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="your_postgresql_connection_string"
CRON_SECRET="your_secure_random_string"
```

> [!TIP]
> You can generate a random `CRON_SECRET` using `openssl rand -base64 32`.

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

Open [http://localhost:3000](http://localhost:3000) to see your dashboard!

## 🤖 Automated Snapshots (Cron Jobs)

This project is optimized for **Vercel** and includes native Cron Job support via `vercel.json`.

- **Endpoint**: `/api/cron/snapshot`
- **Schedule**: Every day at 00:00 UTC.
- **Security**: Protected via `CRON_SECRET` header verification.

To enable automation, deploy to Vercel and ensure the `CRON_SECRET` environment variable is set in your project settings.

## 📝 Roadmap

Check the [SUGGESTIONS.md](./SUGGESTIONS.md) file for our prioritized feature roadmap, including cost basis tracking, performance reports, and data migration.

## 📄 License

MIT
