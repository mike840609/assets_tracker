# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Assets Tracker — Project Guide

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
npm run dev          # Start dev server; binds 0.0.0.0 (LAN-reachable) on port 3000

# Build & Production
npm run build        # Production build
npm run start        # Start production server
ANALYZE=true npm run build  # Build with @next/bundle-analyzer HTML reports

# Linting
npm run lint         # Run ESLint

# Database
npx prisma generate  # Regenerate Prisma client after schema changes
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
│   ├── page.tsx            # Dashboard
│   ├── accounts/page.tsx   # Accounts list
│   ├── accounts/[id]/      # Account detail page
│   └── settings/           # User settings
└── api/
    ├── auth/[...nextauth]/ # NextAuth handlers
    ├── accounts/           # CRUD for accounts
    ├── accounts/[id]/holdings/          # Holdings CRUD
    ├── accounts/[id]/transactions/      # HoldingTransaction CRUD
    ├── accounts/[id]/cash-transactions/ # CashTransaction CRUD
    ├── exchange-rates/     # Fetch + refresh exchange rates
    ├── prices/refresh/     # Manual price refresh trigger
    ├── snapshots/          # Net worth snapshot history
    ├── search/             # Holding symbol search (Yahoo Finance)
    ├── settings/           # User settings API
    └── cron/snapshot/      # Daily cron job (requires CRON_SECRET bearer token)
```

### Next.js 16 Breaking Changes

- **`params` is a `Promise`** — page components receive `params: Promise<{ id: string }>` and must `await params` before accessing fields.
- Read `node_modules/next/dist/docs/` for any Next.js APIs before using them — many APIs changed from earlier versions.

### Cache model (`cacheComponents: true`)

`next.config.ts` enables `cacheComponents: true` (Next.js 16's dynamic-IO / PPR-era cache flag). Service-layer reads throughout `src/lib/services/` use the `"use cache"` directive with `cacheTag("...")` — see `getNetWorthSummary`, `getNormalizedHistory`, settings, and the `/analysis` + `/history` reads (landed per `docs/VERCEL_ANALYSIS.md` V18/V26/V27). Follow the same pattern for new server reads; then invalidate from mutation routes via `revalidateTag(...)`.

`next.config.ts` also declares `serverExternalPackages: ["ws", "@neondatabase/serverless"]`. Any new server-only dep that imports Node built-ins (fs, net, tls) must be added here or the build breaks with Edge-incompat errors.

### Auth Architecture (Split Config Pattern)

NextAuth v5 requires two files to avoid loading Node.js-only modules in Edge middleware:

- `src/auth.config.ts` — Edge-compatible config (providers only, no adapter)
- `src/auth.ts` — Full server config (imports Prisma adapter, used in RSC and API routes)
- `src/middleware.ts` — Uses `auth.config.ts` to protect all routes except the public-route allowlist in its matcher: `/login`, `/privacy`, `/api/auth/*`, and the file-based metadata routes `/opengraph-image.png` + `/twitter-image.png`. Any new public page must be added to the matcher exclusion.

The `session.user.id` is populated from `token.sub` in the JWT callback.

In RSC/pages, always get the session via `getSession()` from `src/lib/auth-session.ts` — it wraps `auth()` in React `cache()` to deduplicate the JWT decode per render.

### RSC → Client Component Serialization

Prisma models contain `Decimal` and `Date` objects which cannot be passed directly from Server Components to Client Components. Always use the serialize helpers in `src/lib/types.ts`:

- `serializeAccount(account)` → `SerializedAccount` (Decimal→number, Date→ISO string)
- `serializeHolding(holding)` → `SerializedHolding`
- `serializeAccountWithHoldings(...)` → `SerializedAccountWithHoldings`

**Do not spread Prisma model instances** — Decimal/Date fields won't strip properly. Use the explicit serializers which reconstruct plain objects field-by-field.

In-app calculation types build on these: `HoldingWithPrice`, `AccountWithValue`, `NetWorthSummary`.

### Database (Neon Serverless)

`src/lib/prisma.ts` uses `PrismaNeon` adapter (`@prisma/adapter-neon`) with WebSocket support via the `ws` package. The `DATABASE_URL` must be a Neon PostgreSQL connection string. The client is singleton-cached in `globalThis` for dev hot-reload safety.

### i18n (next-intl)

Supported locales: `en-US` (default), `zh-TW`. Message files live in `messages/`. Locale is resolved from:
1. `NEXT_LOCALE` cookie (set by settings UI)
2. `Accept-Language` request header

In RSC/pages: `const t = await getTranslations("namespace")` from `next-intl/server`.  
Config entry point: `src/i18n/request.ts` (loaded by `next.config.ts` via `createNextIntlPlugin`).

### Currency Utilities (`src/lib/currencies.ts`)

- `CURRENCIES` — static list of supported currencies with code/name/symbol
- `formatCurrency(amount, currencyCode, compact?)` — Intl-formatted currency string
- `formatNumber(amount, decimals?)` — Intl-formatted number
- `getCurrencySymbol(code)` — symbol lookup
- `getLocaleDefaultCurrency(locale)` — returns `"TWD"` for `zh-TW`, otherwise `"USD"`

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

`GET /api/cron/snapshot` — requires `Authorization: Bearer <CRON_SECRET>` header. Refreshes all prices, then creates `NetWorthSnapshot` records for every user. Scheduled in `vercel.json` at `30 21 * * *` (21:30 UTC daily); `maxDuration` is 60s and the function region is pinned to `sin1` to match the Neon database region.

### Component Organization

```
src/components/
├── ui/           # shadcn/ui primitives (button, dialog, table, etc.)
├── accounts/     # Account detail, holding form, transaction history, inline editors
├── dashboard/    # Net worth card, allocation chart, trend chart, accounts summary
├── layout/       # Sidebar, mobile header, theme provider/toggle
└── settings/     # Settings form
```

### Key Conventions

- Use `@/*` path alias for all imports from `src/`
- Prefer RSC by default; add `"use client"` only when needed
- Use `Decimal` in Prisma operations — never `number` for monetary/quantity values
- Use Tailwind CSS 4 utilities only — no inline styles or CSS Modules
- Add shadcn/ui components via `npx shadcn@latest add <component>`
- Zod 4 schemas live in `@/lib/validators.ts`
- Prisma schema: `prisma/schema.prisma`; generator config: `prisma.config.ts` (Prisma 7 convention); generated client: `src/generated/prisma/` (gitignored). `Decimal` is imported from `@/generated/prisma/runtime/library`, not `@prisma/client`.
- i18n strings go in `messages/en-US.json` and `messages/zh-TW.json`

### Required Environment Variables

```
DATABASE_URL        # PostgreSQL connection string
AUTH_SECRET         # NextAuth secret
AUTH_GOOGLE_ID      # Google OAuth client ID
AUTH_GOOGLE_SECRET  # Google OAuth client secret
CRON_SECRET         # Bearer token for /api/cron/snapshot
```

`DATABASE_URL` is scoped per Vercel environment — Production uses the prod Neon branch, Preview uses a separate shared `preview` Neon branch, so previews never touch live data. The `build` script in `package.json` runs `prisma migrate deploy && next build` so each deploy applies pending migrations to whichever DB is wired in for that environment.

### Long-form analysis docs (`docs/`)

Before proposing changes, check whether the work is already tracked in one of these — items are status-marked and cross-referenced:

- `docs/SUGGESTIONS.md` — master backlog (110+ items, ✅/❌ tracked)
- `docs/VERCEL_ANALYSIS.md` — Vercel-side perf + security items (V1–V33)
- `docs/BUNDLE_ANALYSIS.md` — bundle-size reduction work
- `docs/RENDERING_ANALYSIS.md` — SSG → PPR → ISR strategy
- `docs/ANALYSIS_ROADMAP.md` — `/analysis` tab feature roadmap
- `docs/RELEASE_READINESS.md` — pre-market-launch blockers (R1–R26)
- `docs/DOCS_REVIEW_SUGGESTIONS.md` — consolidated cross-doc recommendations
