# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Assets Tracker — Project Guide

## Overview

A personal net-worth / asset tracking application built with **Next.js 16** (App Router), **Prisma 7** (PostgreSQL), **Tailwind CSS 4**, and **shadcn/ui v4** (base-nova style). It tracks accounts, holdings, exchange rates, price caches, and net-worth snapshots.

## Tech Stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16.2 (App Router, React 19, RSC)         |
| Language   | TypeScript 5, strict mode                        |
| Database   | PostgreSQL via Prisma 7 (`@prisma/client`)       |
| Styling    | Tailwind CSS 4 + shadcn/ui v4 (base-nova style)  |
| Auth       | NextAuth.js v5 (Google OAuth, JWT sessions)      |
| UI Icons   | Lucide React                                     |
| Charts     | Recharts 3                                       |
| Price Data | Yahoo Finance 2 (primary) + CoinGecko (fallback) |
| Validation | Zod 4                                            |
| Fonts      | Geist Sans / Geist Mono via `next/font/google`   |

## Commands

> This project uses **pnpm** (pinned via the `packageManager` field + Corepack). Run `corepack enable` once, then use `pnpm <script>` / `pnpm exec <bin>` instead of `npm run` / `npx`.

```bash
# Development
pnpm dev             # Start dev server; binds 0.0.0.0 (LAN-reachable) on port 3000

# Build & Production
pnpm build           # Production build
pnpm start           # Start production server
ANALYZE=true pnpm build  # Build with @next/bundle-analyzer HTML reports

# Linting
pnpm lint            # Run ESLint

# Database
pnpm db:up           # Start local PostgreSQL via docker-compose (recommended for dev — avoids Neon compute costs; then `pnpm exec prisma db push`)
pnpm db:down         # Stop the local PostgreSQL container
pnpm exec prisma generate                                # Regenerate Prisma client after schema changes (also runs automatically via `postinstall` after `pnpm install`)
pnpm exec prisma migrate dev --name <description>        # Author a new migration locally (commits to prisma/migrations/)
pnpm exec prisma migrate deploy                          # Apply pending migrations against $DATABASE_URL (run by build:vercel on Vercel)
pnpm exec prisma migrate resolve --applied <migration>   # One-shot baseline: mark a migration as already-applied (e.g. when adopting migrations on a DB seeded via db push)
pnpm exec prisma db push                                 # Quick prototype-only schema sync — bypasses migration history; commit a migrate dev before merging
pnpm exec prisma db push --force-reset                    # Reset local DB (drops all tables, recreates schema directly, bypassing migration history)
pnpm exec prisma studio                                  # Open Prisma Studio GUI

# Dead-code detection
pnpm exec knip       # Find unused files/exports/deps (config: knip.json; shadcn ui/ primitives are ignored)

# Unit tests (Vitest) — pure service-layer logic, no DB/env needed
pnpm test:unit           # Run the unit suite once (tests/unit/)
pnpm test:unit:watch     # Watch mode

# E2E tests (Playwright)
pnpm test:e2e            # Run Playwright suite headless
pnpm test:e2e:ui         # Open the Playwright UI runner
pnpm test:e2e:report     # Open the last HTML report

# Worktree / sandbox setup
pnpm setup:worktree      # Copies .env / .env.local from the main worktree, then runs
                         # `pnpm install --frozen-lockfile` against a shared pnpm store.
                         # pnpm hardlinks node_modules from the store, so packages are never
                         # duplicated across worktrees and each worktree has a real node_modules.
                         # Store defaults to ~/.cache/asset_tracker/pnpm-store; override the root
                         # with $ASSET_TRACKER_CACHE_ROOT. Set $ASSET_TRACKER_SKIP_ENV_COPY=1 to
                         # skip the env-copy step; pass `-- --prune` to GC the store.
```

## Pre-PR Checklist

Before pushing or opening a pull request, always run the full CI-equivalent check suite:

```bash
pnpm format:check   # Prettier format — must match .prettierrc.json exactly
pnpm lint           # ESLint with Next.js + TypeScript rules
pnpm typecheck      # TypeScript strict mode (no DB needed)
```

Or use the combined script (also runs `build`, which requires DB env vars — skip if unavailable):

```bash
pnpm check
```

Fix all errors before pushing. CI runs these steps in order and fails fast on the first error.

> The `.husky/pre-push` hook enforces `format:check + lint + typecheck` on every `git push`, so the push will be rejected if any check fails. Run `pnpm format` to auto-fix formatting issues before committing.

## Architecture

### Route Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, global CSS)
│   ├── login/page.tsx          # Public login page
│   ├── privacy/, terms/        # Public legal pages
│   ├── (main)/                 # Auth-gated route group
│   │   ├── layout.tsx          # Sidebar + mobile header shell
│   │   ├── page.tsx            # Dashboard
│   │   ├── accounts/           # Accounts list + [id] detail
│   │   ├── analysis/           # Analysis tab (charts: assets/liabilities, cash flow, movers)
│   │   ├── goals/              # Net worth goals & milestones
│   │   ├── history/            # Net worth history view
│   │   ├── projections/        # FIRE/retirement projection page
│   │   ├── settings/           # User settings
│   │   └── stocks/             # Stock watchlist / tracker
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handlers
│       ├── accounts/           # CRUD for accounts
│       ├── accounts/[id]/holdings/          # Holdings CRUD
│       ├── accounts/[id]/transactions/      # HoldingTransaction CRUD
│       ├── accounts/[id]/cash-transactions/ # CashTransaction CRUD
│       ├── exchange-rates/     # Fetch + refresh exchange rates
│       ├── goals/              # Goals CRUD
│       ├── options/chain/      # Options chain data (Yahoo Finance)
│       ├── prices/refresh/     # Manual price refresh trigger
│       ├── snapshots/          # Net worth snapshot history
│       ├── search/             # Holding symbol search (Yahoo Finance)
│       ├── settings/           # User settings API
│       ├── stocks/             # Stock watchlist CRUD + quote + refresh
│       ├── _metrics/vitals/    # Web Vitals ingestion
│       └── cron/snapshot/      # Daily cron job (requires CRON_SECRET bearer token)
├── hooks/                      # Client hooks (use-chart-animation, use-count-up, use-is-mobile, use-refresh-cooldown, …)
└── proxy.ts                    # Server-side proxy module (used by service layer)
```

### Next.js 16 Breaking Changes

> ⚠️ This is **not** the Next.js most training data describes. APIs, conventions, and file structure have shifted. Before writing code that touches a Next.js API, read the relevant page in `node_modules/next/dist/docs/` and heed deprecation notices — guessing from memory will produce broken code.

- **`params` is a `Promise`** — page components receive `params: Promise<{ id: string }>` and must `await params` before accessing fields.

### Cache model (`cacheComponents: true`)

`next.config.ts` enables `cacheComponents: true` (Next.js 16's dynamic-IO / PPR-era cache flag). Service-layer reads throughout `src/lib/services/` use the `"use cache"` directive with `cacheTag("...")` — see `getCachedNetWorthSummary`, `getNormalizedHistory`, settings, and the `/analysis` + `/history` reads (landed per `docs/VERCEL_ANALYSIS.md` V18/V26/V27). Follow the same pattern for new server reads; then invalidate from mutation routes via `revalidateTag(...)`.

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
- All Yahoo calls go through the shared lazily-instantiated client in `src/lib/services/yahoo-client.ts` (`getYahooClient()`) — never instantiate `yahoo-finance2` directly

**Manual refresh throttling** (see `docs/REFRESH_THROTTLING_PLAN.md`):

- `src/lib/refresh-policy.ts` — isomorphic TTL constants (`PRICE_REFRESH_TTL_MS`, `FX_REFRESH_TTL_MS`, `CLIENT_REFRESH_COOLDOWN_MS`) shared by server freshness gates and the client cooldown so the two layers can't drift
- `src/lib/refresh-client.ts` — client-side entry point for every "refresh market data" surface (dashboard button, pull-to-refresh, settings); module-level cooldown + `refresh:cooldown` event
- `src/hooks/use-refresh-cooldown.ts` — React hook over that cooldown state
- The server enforces its own freshness gate (skips external fetches for recently-cached symbols/rates) and per-user rate limits regardless of client behavior; throttled responses carry `Retry-After`

**Exchange rates** (`src/lib/services/exchange-rate-service.ts`):

- Stored in `ExchangeRate` table
- `getAllExchangeRates()` bulk-loads all rates into a Map
- `resolveRate()` handles identity (same currency), inverse rates, and USD cross-rate derivation
- Rates are warmed by the daily cron and `refreshExchangeRates()` (manual refresh / on-write); read paths never fetch externally — unresolvable pairs fall back to 1 with a warning

**Net worth calculation** (`src/lib/services/net-worth-service.ts`):

- Two-pass algorithm: first pass prices holdings, second pass converts values using the preloaded rate map
- `getCachedNetWorthSummary(userId, baseCurrency)` returns fully computed `NetWorthSummary`

**Other services in `src/lib/services/`:**

- `account-service.ts` — `getAccountDetail` (per-account RSC read, React `cache()`-memoized), `getAccountPriceMap`
- `snapshot-service.ts` — creates `NetWorthSnapshot` rows with the lossless per-account breakdown
- `history-service.ts` — reads snapshots and renormalizes them on the fly into the user's current base currency
- `analysis-service.ts` — backs the `/analysis` tab
- `analysis-payload-service.ts` — `getCachedAnalysisPayload`: bundles the four `/analysis` history/cash-flow reads behind one `unstable_cache` entry
- `goal-service.ts` — goals CRUD + progress computation against the cached net-worth summary (backs `/goals`)
- `stock-watch-service.ts` — stock watchlist (`StockWatchItem`) reads/refresh (backs `/stocks`)
- `yahoo-client.ts` — shared `yahoo-finance2` client singleton (see Price Pipeline above)
- `projection-service.ts` — `getProjectionData` for FIRE/retirement projections (uses `"use cache"`)
- `settings-service.ts` — user settings reads/writes
- `balance.ts` — shared balance/value computation helpers

### API utilities

- `src/lib/api-handler.ts` + `src/lib/api-responses.ts` — standardized request handling and JSON response shapes for route handlers.
- `src/lib/rate-limit.ts` — in-process rate limiter; wrap any new public-facing or cron-adjacent API route with it.
- `src/lib/validators.ts` — Zod 4 schemas for all API input validation.

### Shared lib utilities

- `src/lib/env.ts` — Zod-validated typed env. Import `env` (or named exports like `DATABASE_URL`) from here rather than reading `process.env` directly. Fails fast at startup with a clear error if required vars are missing.
- `src/lib/logger.ts` — structured JSON logger (`log.info / warn / error / debug`). Server-only. All API routes and services should use this instead of `console.*`.
- `src/lib/enums.ts` — runtime arrays of enum values: `ACCOUNT_TYPES`, `ACCOUNT_CATEGORIES`, `HOLDING_ASSET_TYPES`. Import from here for dropdowns, Zod `.enum()`, etc.
- `src/lib/chart-formatters.ts` — `formatChartTick(v)`: shared Recharts Y-axis formatter (K/M suffixes). Import instead of writing inline formatters.
- `src/lib/i18n-utils.ts` — `pickMessages(messages, namespaces)`: limits which i18n namespaces are serialized into HTML for `NextIntlClientProvider`. Always use this when passing messages to a client boundary.

### Daily Snapshot Cron

`GET /api/cron/snapshot` — requires `Authorization: Bearer <CRON_SECRET>` header. Refreshes all prices, then creates `NetWorthSnapshot` records for every user. Scheduled in `vercel.json` at `30 21 * * *` (21:30 UTC daily); `maxDuration` is 60s and the function region is pinned to `sin1` to match the Neon database region. (Note: `README.md` still says "00:00 UTC" — `vercel.json` and this file are the source of truth.)

### Unit Testing (Vitest)

- Specs live in `tests/unit/` (config: `vitest.config.ts`). The suite targets the pure service-layer logic — net-worth two-pass valuation + missing-rate fallback, `resolveRate`, history normalize/dedupe, analysis aggregations, `types.ts` serializers, and `validators.ts` edge cases.
- **No DB or env vars needed.** `vitest.config.ts` mirrors the `@/*` alias and aliases `server-only` to a stub (`tests/stubs/server-only.ts`) so server-only modules import in Node. DB/cache/logger modules are mocked per-file (`vi.mock`), and `resolveRate` stays real so the missing-rate path is genuinely exercised.
- New service tests should follow the same pattern: test the real exported function, mock `@/lib/prisma` / `@/lib/logger` / `next/cache` (and React `cache()` where a `"use cache"` wrapper is in the path), and assert on the returned shape.
- Runs in CI via the `unit` job in `.github/workflows/ci.yml`, alongside lint/typecheck on every PR.

### E2E Testing (Playwright)

- Specs live in `tests/e2e/` (`smoke.spec.ts` is the entry; `global-setup.ts` / `global-teardown.ts` provision and tear down a dedicated test user so runs don't pollute real user data — see commit `3289e91`).
- Stored auth state: `tests/e2e/.auth/user.json` (loaded by the `chromium` project).
- The config auto-starts `pnpm dev` with `VERCEL_ENV=preview` and `PREVIEW_AUTH_PASSWORD=<E2E_PASSWORD>` unless `PLAYWRIGHT_TEST_BASE_URL` is set; CI sets that var to skip the bootstrap and run against an existing deployment.
- `fullyParallel: false` and `workers: 1` — the suite is intentionally serial; do not parallelize without revisiting the global setup.

### Component Organization

```
src/components/
├── ui/           # shadcn/ui primitives (button, dialog, table, etc.)
├── accounts/     # Account detail, holding form, transaction history, inline editors
├── analysis/     # Analysis view, assets/liabilities chart, cash flow chart, movers list
├── dashboard/    # Net worth card, allocation chart, trend chart, accounts summary
├── goals/        # Goal cards, goal form dialog, goals view + onboarding
├── history/      # History table, pull-to-refresh
├── layout/       # Sidebar, mobile header, theme provider/toggle
├── onboarding/   # First-run empty-state surface (shared by feature onboardings)
├── projections/  # FIRE projection chart and view
├── settings/     # Settings form
└── stocks/       # Stock tracker view + onboarding
```

### Key Conventions

- Use `@/*` path alias for all imports from `src/`
- Prefer RSC by default; add `"use client"` only when needed
- Use `Decimal` in Prisma operations — never `number` for monetary/quantity values
- `Holding` supports an `OPTION` asset type with extra fields: `underlyingSymbol`, `optionType` (CALL/PUT), `strike`, `expiration`, `contractMultiplier`
- Use Tailwind CSS 4 utilities only — no inline styles or CSS Modules
- Add shadcn/ui components via `pnpm dlx shadcn@latest add <component>`
- Zod 4 schemas live in `@/lib/validators.ts`
- Prisma schema: `prisma/schema.prisma`; generator config: `prisma.config.ts` (Prisma 7 convention); generated client: `src/generated/prisma/` (gitignored). `Decimal` is imported from `@/generated/prisma/runtime/library`, not `@prisma/client`.
- i18n strings go in `messages/en-US.json` and `messages/zh-TW.json`

### Required Environment Variables

```
# Required
DATABASE_URL        # PostgreSQL connection string
AUTH_SECRET         # NextAuth secret
AUTH_GOOGLE_ID      # Google OAuth client ID
AUTH_GOOGLE_SECRET  # Google OAuth client secret
CRON_SECRET         # Bearer token for /api/cron/snapshot

# Optional
AUTH_REDIRECT_PROXY_URL   # OAuth proxy URL (for tunneled preview deployments)
PREVIEW_AUTH_PASSWORD     # Required when VERCEL_ENV=preview (unless PREVIEW_AUTH_DISABLED)
PREVIEW_AUTH_DISABLED     # Set to "1"/"true" to skip preview password gate
VERCEL_ENV                # Set automatically by Vercel (production | preview | development)
```

`DATABASE_URL` is scoped per Vercel environment — Production uses the prod Neon branch, Preview uses a separate shared `preview` Neon branch, so previews never touch live data. Vercel runs the `build:vercel` script (wired via `vercel.json` → `buildCommand`); it runs `prisma migrate deploy` followed by `next build`, skipping the migrate step when no files under `prisma/migrations/` changed since `VERCEL_GIT_PREVIOUS_SHA` (`FORCE_PRISMA_MIGRATE_DEPLOY=1` overrides; `SKIP_PRISMA_MIGRATE_DEPLOY=1` skips unconditionally). CI/local `pnpm build` stays as plain `next build` so it doesn't need a database.

### Long-form analysis docs (`docs/`)

Before proposing changes, check whether the work is already tracked in one of these — items are status-marked and cross-referenced:

- `docs/PERFORMANCE.md` — bundle optimization (B1–B15), rendering strategy (S/P/I/X), enhancement roadmap (PE1–PE19), React best-practices review (F1–F10)
- `docs/PLATFORM.md` — Vercel platform (V1–V36), launch readiness (R1–R26), Fluid CPU optimization (P1–P9), Vercel MCP findings (F1–F8), firewall setup
- `docs/DATABASE.md` — Neon database audit (DB1–DB14): schema overview, index analysis, enhancement backlog
- `docs/UI_UX.md` — UI/UX improvements (1–15), `/analysis` tab feature roadmap (Phases 1–4), desktop + mobile enhancements, animation polish
- `docs/CODE_QUALITY.md` — engineering hygiene (Q1–Q20), documentation gaps (C1–C14), cross-doc synthesis (D1–D10)
- `docs/SUGGESTIONS.md` — master backlog (151 items, ✅/❌ tracked)
- `docs/ROADMAP.md` — prioritized current work (S1–S32) and future features (F1–F25, themes: projections, P&L, cashflow, portfolio intelligence, etc.)
- `docs/LOG.md` — running engineering log / decision journal
