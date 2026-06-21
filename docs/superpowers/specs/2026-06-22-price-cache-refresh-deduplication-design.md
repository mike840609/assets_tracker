# Price Cache Refresh Deduplication — Design Spec

**Date:** 2026-06-22
**Approach:** `refreshingAt` column claim (Approach B)

## Problem

`PriceCache` refresh is a read-then-write operation: the freshness gate reads stale symbols, then a separate upsert writes the fetched prices. In a serverless environment, N concurrent requests can all pass the freshness gate before any of them completes the write, resulting in N identical Yahoo Finance / CoinGecko calls for the same symbols. At moderate user scale (simultaneous morning check-ins), this wastes external API quota unnecessarily.

## Goal

Ensure at most one serverless instance fetches prices for a given symbol at a time, with correct behaviour under fetch failures and dead instances.

## Non-Goals

- Exchange rate (`ExchangeRate`) deduplication — the 1h TTL and existing in-process memo (`lastRateRefreshAt`) make the race window narrow enough; extend later if needed.
- Request queuing, priority, or fairness beyond first-claimant-wins.
- Changing the client-side cooldown or the `PRICE_REFRESH_TTL_MS` constant.
- Adding new external price sources.

## Schema

One nullable column added to `PriceCache`:

```prisma
model PriceCache {
  symbol       String    @id
  price        Decimal   @db.Decimal(18, 8)
  currency     String    @default("USD")
  updatedAt    DateTime  @updatedAt
  refreshingAt DateTime?            // null = idle; set = refresh in-flight (30s dead-instance TTL)

  @@index([updatedAt])
}
```

A standard Prisma migration adds the column as `NULL DEFAULT NULL` — no backfill required.

## Algorithm

Current flow in `refreshPricesForHoldings`:

```
1. Read stale symbols (freshness gate SELECT)
2. Fetch from Yahoo / CoinGecko
3. Bulk upsert to PriceCache
```

New flow:

```
1. Read stale symbols (freshness gate SELECT — unchanged)
2. CLAIM: atomic UPDATE for symbols with existing PriceCache rows
          SET refreshingAt = NOW()
          WHERE (refreshingAt IS NULL OR refreshingAt < NOW() - 30s)
            AND updatedAt < NOW() - TTL
          RETURNING symbol
   → only returned symbols are owned by this instance
3. New symbols (no PriceCache row yet) bypass the claim — always fetched;
   upsert at step 5 is idempotent
4. If zero claimed AND zero new → all symbols mid-refresh by another instance
   → return { retryAfterSeconds: 30 } so the client knows when to retry
5. Fetch from Yahoo / CoinGecko for (claimed ∪ new) only
6. SUCCESS: bulk upsert sets price, currency, updatedAt = NOW(), refreshingAt = NULL
7. FAILURE: cleanup UPDATE sets refreshingAt = NULL for claimed symbols,
            leaving price and updatedAt untouched
```

### Dead-instance release

The `refreshingAt < NOW() - 30s` predicate in step 2 acts as a self-expiring lock. If a Vercel function is killed mid-refresh, the claim expires after 30 seconds and any subsequent request can re-claim. The 30s window comfortably exceeds the maximum fetch duration:

- Per-symbol timeout: 5s
- Retry delays: 500ms + 1500ms
- Two retry attempts max ≈ 13s total

### New symbols

Symbols with no `PriceCache` row cannot be claimed via UPDATE (no row to match). They are kept in a separate set and fetched unconditionally. The existing bulk upsert (`INSERT ... ON CONFLICT DO UPDATE`) handles them correctly regardless of concurrent writes — the last writer wins on price, which is acceptable since all concurrent writers fetched the same external data.

## Data Flow

```
refreshPricesForHoldings(holdings, opts)
  │
  ├─ freshness gate (SELECT) → split into [fresh] [stale]
  │
  ├─ split stale into [existing in cache] [new symbols]
  │
  ├─ CLAIM UPDATE on existing stale → [claimed] [skipped — mid-refresh]
  │
  ├─ if (claimed ∪ new).length === 0 → return { retryAfterSeconds: 30 }
  │
  ├─ Promise.all([fetchStockPrices(claimed+new stocks),
  │               fetchCryptoPrices(claimed+new crypto)])
  │      │
  │      ├─ success → bulk upsert (price, updatedAt, refreshingAt = NULL)
  │      │            revalidateTag("prices") if changed
  │      │
  │      └─ failure → cleanup UPDATE (refreshingAt = NULL for claimed)
  │                   errors[] populated
  │
  └─ return RefreshPricesResult
```

## Error Handling

| Failure | Behaviour |
|---|---|
| External fetch fully fails | Cleanup UPDATE clears `refreshingAt` for claimed symbols; `updatedAt` unchanged → next request can retry after TTL |
| Partial fetch failure (some symbols) | Successful symbols get price written + `refreshingAt` cleared via upsert; failed symbols get claim released via cleanup UPDATE |
| Serverless instance killed | `refreshingAt` expires after 30s; next request re-claims |
| Claim UPDATE itself fails | Surfaces as an error in `RefreshPricesResult.errors`; no lock held |

## SQL Patterns

**Claim:**
```sql
UPDATE "PriceCache"
SET "refreshingAt" = NOW()
WHERE symbol = ANY($1)
  AND ("refreshingAt" IS NULL OR "refreshingAt" < NOW() - INTERVAL '30 seconds')
  AND "updatedAt" < NOW() - $2::interval
RETURNING symbol
```

**Success upsert (existing ON CONFLICT extended):**
```sql
ON CONFLICT (symbol) DO UPDATE SET
  price          = EXCLUDED.price,
  currency       = EXCLUDED.currency,
  "updatedAt"    = NOW(),
  "refreshingAt" = NULL
```

**Failure cleanup:**
```sql
UPDATE "PriceCache"
SET "refreshingAt" = NULL
WHERE symbol = ANY($1)
```

## Testing

Two new unit test cases in `tests/unit/price-service.test.ts`, following the existing `vi.mock` pattern for `@/lib/prisma`:

1. **Deduplication:** Mock `prisma.$executeRawUnsafe` to return 0 claimed rows. Assert the function returns `{ updated: 0, skippedFresh: 0, retryAfterSeconds: 30 }` without calling the Yahoo client.

2. **Claim release on failure:** Mock the Yahoo client to throw. Assert the cleanup `$executeRawUnsafe` is called with `refreshingAt = NULL` for the claimed symbols, and `updatedAt` is not modified.

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `refreshingAt DateTime?` to `PriceCache` |
| `prisma/migrations/<timestamp>_price_cache_refreshing_at/migration.sql` | `ALTER TABLE "PriceCache" ADD COLUMN "refreshingAt" TIMESTAMP(3)` |
| `src/lib/services/price-service.ts` | Claim-before-fetch in `refreshPricesForHoldings`; cleanup on failure |
| `tests/unit/price-service.test.ts` | Two new test cases |
