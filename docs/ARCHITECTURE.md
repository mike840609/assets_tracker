# Architecture

Assets Tracker is a Next.js App Router application backed by PostgreSQL through Prisma. Server Components read through service modules, Route Handlers and Server Actions perform mutations, and cache tags invalidate affected views.

## Major boundaries

- `src/app/` — routes, layouts, Server Components, and API handlers
- `src/components/` — interactive UI and shared presentation
- `src/lib/services/` — database-backed domain operations
- `src/lib/types.ts` — serialization between Prisma models and Client Components
- `prisma/schema.prisma` — persistent data model
- `prisma/migrations/` — ordered production schema history

Authentication uses NextAuth.js with Google OAuth and JWT sessions. `src/auth.config.ts` stays runtime-safe while `src/auth.ts` contains server-only adapter configuration.

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

## Market-data pipeline

Yahoo Finance is the primary price source for securities and crypto. CoinGecko is a crypto fallback. Prices and exchange rates are cached in PostgreSQL; read paths use cached data, while explicit refreshes and the daily snapshot job update it.

## Caching and self-hosting

The application uses Next.js Cache Components and tag invalidation. A single Node.js or Docker instance works without extra configuration. Multiple replicas require a shared cache handler so invalidation and regenerated output remain consistent across instances.
