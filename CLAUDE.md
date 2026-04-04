# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Asset Tracker — Project Guide

## Overview

A personal net-worth / asset tracking application built with **Next.js 16** (App Router), **Prisma 7** (PostgreSQL), **Tailwind CSS 4**, and **shadcn/ui v4** (base-nova style). It tracks accounts, holdings, exchange rates, price caches, and net-worth snapshots.

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Framework      | Next.js 16.2 (App Router, React 19, RSC)        |
| Language       | TypeScript 5, strict mode                       |
| Database       | PostgreSQL via Prisma 7 (`@prisma/client`)      |
| Styling        | Tailwind CSS 4 + shadcn/ui v4 (base-nova style) |
| Auth           | NextAuth.js v5 (Google OAuth, JWT sessions)     |
| UI Icons       | Lucide React                                    |
| Charts         | Recharts 3                                      |
| Price Data     | Yahoo Finance 2 (primary) + CoinGecko (fallback)|
| Validation     | Zod 4                                           |
| Fonts          | Geist Sans / Geist Mono via `next/font/google`  |

## Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Build & Production
npm run build        # Production build
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint

# Database
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema to database (dev)
npx prisma studio    # Open Prisma Studio GUI
```

## Architecture

### Route Structure

```
src/app/
├── layout.tsx              # Root layout (fonts, global CSS)
├── login/page.tsx          # Public login page
├── (main)/                 # Auth-gated route group
│   ├── layout.tsx          # Sidebar + mobile header shell
│   ├── page.tsx            # Dashboard (revalidate: 60s)
│   ├── accounts/[id]/      # Account detail page
│   └── settings/           # User settings
└── api/
    ├── auth/[...nextauth]/ # NextAuth handlers
    ├── accounts/           # CRUD for accounts + holdings + transactions
    ├── exchange-rates/     # Fetch + refresh exchange rates
    ├── prices/refresh/     # Manual price refresh trigger
    ├── snapshots/          # Net worth snapshot history
    ├── search/             # Holding symbol search (Yahoo Finance)
    ├── settings/           # User settings API
    └── cron/snapshot/      # Daily cron job (requires CRON_SECRET bearer token)
```

### Auth Architecture (Split Config Pattern)

NextAuth v5 requires two files to avoid loading Node.js-only modules in Edge middleware:

- `src/auth.config.ts` — Edge-compatible config (providers only, no adapter)
- `src/auth.ts` — Full server config (imports Prisma adapter, used in RSC and API routes)
- `src/middleware.ts` — Uses `auth.config.ts` to protect all routes except `/login` and `/api/auth/*`

The `session.user.id` is populated from `token.sub` in the JWT callback.

### RSC → Client Component Serialization

Prisma models contain `Decimal` and `Date` objects which cannot be passed directly from Server Components to Client Components. Always use the serialize helpers in `src/lib/types.ts`:

- `serializeAccount(account)` → `SerializedAccount` (Decimal→number, Date→ISO string)
- `serializeHolding(holding)` → `SerializedHolding`
- `serializeAccountWithHoldings(...)` → `SerializedAccountWithHoldings`

**Do not spread Prisma model instances** — Decimal/Date fields won't strip properly. Use the explicit serializers which reconstruct plain objects field-by-field.

In-app calculation types build on these: `HoldingWithPrice`, `AccountWithValue`, `NetWorthSummary`.

### Price & Exchange Rate Pipeline

**Price fetching** (`src/lib/services/price-service.ts`):
- Stocks/ETFs/bonds: Yahoo Finance 2
- Crypto: Yahoo Finance 2 first, then CoinGecko API (free tier, no key) as fallback
- Prices are cached in the `PriceCache` table (keyed by symbol)

**Exchange rates** (`src/lib/services/exchange-rate-service.ts`):
- Stored in `ExchangeRate` table
- `getAllExchangeRates()` bulk-loads all rates into a Map
- `resolveRate()` handles identity (same currency) and inverse rates
- Missing rates are fetched lazily and saved

**Net worth calculation** (`src/lib/services/net-worth-service.ts`):
- Two-pass algorithm: first pass collects missing rate pairs, second pass computes values after batch-fetching missing rates
- `getNetWorthSummary(userId, baseCurrency)` returns fully computed `NetWorthSummary`

### Daily Snapshot Cron

`GET /api/cron/snapshot` — requires `Authorization: Bearer <CRON_SECRET>` header. Refreshes all prices, then creates `NetWorthSnapshot` records for every user. Intended to be called by a scheduler (e.g., Vercel Cron).

### Key Conventions

- Use `@/*` path alias for all imports from `src/`
- Prefer RSC by default; add `"use client"` only when needed
- Use `Decimal` in Prisma operations — never `number` for monetary/quantity values
- Use Tailwind CSS 4 utilities only — no inline styles or CSS Modules
- Add shadcn/ui components via `npx shadcn@latest add <component>`
- Zod 4 schemas live in `@/lib/validators.ts`
- Prisma schema: `prisma/schema.prisma`; generated client: `src/generated/prisma/` (gitignored)

### Required Environment Variables

```
DATABASE_URL        # PostgreSQL connection string
AUTH_SECRET         # NextAuth secret
AUTH_GOOGLE_ID      # Google OAuth client ID
AUTH_GOOGLE_SECRET  # Google OAuth client secret
CRON_SECRET         # Bearer token for /api/cron/snapshot
```
