# Architecture

astt is a Next.js App Router application backed by PostgreSQL through Prisma. Server Components read through service modules, Route Handlers and Server Actions perform mutations, and cache tags invalidate affected views.

The current application stack is Next.js 16, React 19, Prisma 7, PostgreSQL, Tailwind CSS 4, and NextAuth.js 5.

## Major boundaries

- `src/app/` — routes, layouts, Server Components, and API handlers
- `src/components/` — interactive UI and shared presentation
- `src/lib/services/` — database-backed domain operations
- `src/lib/types.ts` — serialization between Prisma models and Client Components
- `prisma/schema.prisma` — persistent data model
- `prisma/migrations/` — ordered production schema history

## Client persistence

App-owned `localStorage` and `sessionStorage` keys use
`asset-tracker:v<version>:<name>`. The current version is `v1`, and
`src/lib/client-storage.ts` is the registry for every key and its legacy alias.

Readers accept only values recognized by the current consumer. When no current key exists, a
recognized legacy value is copied to the `v1` key and the legacy key is removed. Invalid current or
legacy values and keys from unknown versions are ignored so the consumer's normal default applies.
Storage access and migration failures are non-fatal; a failed copy leaves the legacy value intact.

The sidebar cookie remains `asset-tracker:sidebar-collapsed` because it seeds server rendering and is
not Web Storage. The `theme` key is owned by `next-themes` and is outside the app-owned convention.

Authentication uses NextAuth.js with JWT sessions. Non-Vercel deployments may use a built-in single-owner password, Google OAuth, or both; Vercel production remains Google-only. `src/auth.config.ts` stays runtime-safe while `src/auth.ts` contains server-only adapter and credentials-provider configuration.

## Public Demo boundary

An anonymous public Demo workspace is a normal data-owning `User` with exactly one `DemoWorkspace` relation. The relation stores purpose-separated visitor/source hashes, the authoritative expiry, and quota counters. Cascading deletion of the temporary user removes every owned row; formal users have no `DemoWorkspace` relation, and formal sign-in replaces the Demo session without moving any data.

The signed JWT carries enough Demo state for the proxy to reject disabled or visibly expired sessions quickly. That claim is only a fast-path hint: every server render, action, and API authorization resolves the user against PostgreSQL and checks the authoritative `DemoWorkspace.expiresAt`. Missing, expired, foreign, or formal rows cannot be recovered by a client-supplied ID.

Creation and reset instantiate the checked-in offline sample into fresh IDs, then persist each model with bulk inserts in one transaction. Fallback prices and exchange rates are part of that fixture path, so creation/reset do not call external market providers. Demo cache invalidation is always scoped by user tag; global tags remain reserved for formal shared data.

Every formal cron phase anti-joins `User.demoWorkspace` (including price, exchange-rate, recurring, snapshot, goal, calendar, and watchlist work). The cron may delete expired Demo users in bounded batches, but it must never materialize rules or refresh market data for an active Demo.

## Database adapters

`src/lib/prisma.ts` selects the adapter from `DATABASE_URL`:

- Neon hosts use `@prisma/adapter-neon` with WebSocket support.
- Other PostgreSQL hosts use `@prisma/adapter-pg`.

## Lossless net-worth history

Net worth history must remain comparable when an account or preferred base currency changes.

### Snapshot creation

Each snapshot stores:

- The calculated total in the user's current base currency.
- A breakdown containing each account's original balance and original currency.

### History normalization

When history is displayed, the service:

1. Loads the user's current base currency.
2. Converts each original account balance using the latest available exchange-rate map.
3. Falls back to converting legacy snapshot totals when no lossless breakdown exists.

This preserves a continuous chart without discarding the source amounts that produced earlier snapshots.
Reconstructing signed totals also requires current account-type metadata. If any breakdown entry is
malformed or its account has been deleted, the service converts that snapshot's stored aggregates
instead of guessing whether the unclassified value was an asset or liability.

## Market-data pipeline

Yahoo Finance is the primary price source for securities and crypto. CoinGecko is a crypto fallback. Prices and exchange rates are cached in PostgreSQL; read paths use cached data, while explicit refreshes and the daily snapshot job update it.

### Expired options

Before it refreshes prices, the daily job sweeps option contracts whose expiration precedes the current business day. Settlement value is the contract's intrinsic value on its expiration day — `max(spot - strike, 0)` for a call, `max(strike - spot, 0)` for a put — computed from a live quote for the **underlying**, never from the option's own cached premium. The option's cached premium is not a safe source: the sweep runs before the price refresh, so it would read a quote left by the previous cron cycle and could credit cash for a contract that had already expired worthless. A contract that settles in the money is zeroed and recorded as a `SELL` carrying the per-share intrinsic value, plus a matching cash credit converted into the account's currency; one that settles at the money or out of the money is zeroed and recorded as a `SELL` with no unit price and no cash. Auto-exercise into the underlying shares is not modelled, because it would create share lots the user never confirmed.

Automatic settlement is gated on the expiration-day close being establishable: it applies only when the business day is exactly one day after the expiration, which is the first sweep after expiry and runs after that day's US close. When that gate fails (a missed cron cycle), or the underlying quote is unavailable, is denominated in a different currency than the option, or cannot be converted into the account's currency, the holding is left untouched — no zeroing, no transaction, no cash — and the skip is logged with its reason. The position stays visible so the user can close it manually.

## Caching and self-hosting

The application uses Next.js Cache Components and tag invalidation. A single Node.js or Docker instance works without extra configuration. Multiple replicas require a shared cache handler so invalidation and regenerated output remain consistent across instances.
