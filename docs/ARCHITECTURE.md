# Architecture

Assets Tracker is a Next.js App Router application backed by PostgreSQL through Prisma. Server Components read through service modules, Route Handlers and Server Actions perform mutations, and cache tags invalidate affected views.

## Major boundaries

- `src/app/` — routes, layouts, Server Components, and API handlers
- `src/components/` — interactive UI and shared presentation
- `src/lib/services/` — database-backed domain operations
- `src/lib/types.ts` — serialization between Prisma models and Client Components
- `prisma/schema.prisma` — persistent data model
- `prisma/migrations/` — ordered production schema history

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

## Caching and self-hosting

The application uses Next.js Cache Components and tag invalidation. A single Node.js or Docker instance works without extra configuration. Multiple replicas require a shared cache handler so invalidation and regenerated output remain consistent across instances.
