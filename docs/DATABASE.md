# Assets Tracker — Database

Findings sourced from the Neon MCP connector against project `solitary-wind-27723484` (`asset_tracker`, region `aws-ap-southeast-1`, PostgreSQL 16). Audit date: 2026-05-15.

This file is the database-specific system of record.

---

## Schema Overview

| Table                | Live Rows | Dead Rows | Size   | Notes                          |
| -------------------- | --------- | --------- | ------ | ------------------------------ |
| `NetWorthSnapshot`   | 391       | 27        | 400 kB | Daily cron; grows ~5/day       |
| `ExchangeRate`       | 223       | 0         | 176 kB | All tracked currency pairs     |
| `HoldingTransaction` | 75        | 11        | 88 kB  | Buy/sell/edit ledger           |
| `PriceCache`         | 49        | 0         | 88 kB  | Keyed by symbol                |
| `Holding`            | 46        | 48        | 120 kB | **48 dead ≈ live count**       |
| `CashTransaction`    | 12        | 1         | 48 kB  |                                |
| `Setting`            | 5         | 6         | 80 kB  | One row per user               |
| `Account`            | 2         | 32        | 64 kB  | **32 dead vs 2 live — severe** |

### Enums

| Enum                  | Values                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `AccountType`         | `ASSET`, `LIABILITY`                                                                                    |
| `AccountCategory`     | `BANK`, `BROKERAGE`, `CRYPTO_WALLET`, `PROPERTY`, `VEHICLE`, `CREDIT_CARD`, `LOAN`, `MORTGAGE`, `OTHER` |
| `HoldingAssetType`    | `STOCK`, `ETF`, `CRYPTO`, `MUTUAL_FUND`, `BOND`, `OPTION`, `OTHER`                                      |
| `TransactionType`     | `BUY`, `SELL`, `EDIT`                                                                                   |
| `CashTransactionType` | `DEPOSIT`, `WITHDRAWAL`, `EDIT`                                                                         |
| `OptionType`          | `CALL`, `PUT`                                                                                           |

---

## Findings & Enhancement Backlog

| #    | Title                                                                               | Category      | Impact    | Effort | Status             |
| ---- | ----------------------------------------------------------------------------------- | ------------- | --------- | ------ | ------------------ |
| DB1  | VACUUM ANALYZE on bloated tables                                                    | Maintenance   | 🔴 High   | XS     | ✅ Done 2026-05-15 |
| DB2  | Enable `pg_stat_statements`                                                         | Observability | 🔴 High   | XS     | ✅ Done 2026-05-15 |
| DB3  | Add `price` to `HoldingTransaction`                                                 | Schema        | 🔴 High   | M      | ❌ Not done        |
| DB4  | Add explicit `date` to transaction tables                                           | Schema        | 🟡 Medium | S      | ❌ Not done        |
| DB5  | Drop redundant `NetWorthSnapshot_userId_idx`                                        | Index         | 🟢 Low    | XS     | ✅ Done 2026-05-15 |
| DB6  | Move `colorSchema` from `localStorage` → `Setting`                                  | Schema        | 🟡 Medium | S      | ❌ Not done        |
| DB7  | Add `source` field to `PriceCache`                                                  | Schema        | 🟢 Low    | XS     | ❌ Not done        |
| DB8  | Migrate timestamps to `timestamptz`                                                 | Correctness   | 🟢 Low    | M      | ❌ Not done        |
| DB9  | Replace synthetic `ExchangeRate.id` with currency-pair PK                           | Schema        | 🟢 Low    | M      | ❌ Not done        |
| DB10 | GIN index on `NetWorthSnapshot.breakdown`                                           | Index         | 🟢 Low    | XS     | ❌ Not done        |
| DB11 | `cacheLife("minutes")` too short — exchange rates + accounts hit DB ~1k×/hr         | Performance   | 🔴 High   | XS     | ✅ Done 2026-05-15 |
| DB12 | Drop 4 zero-use indexes (write overhead, never read)                                | Index         | 🟡 Medium | XS     | ✅ Done 2026-05-15 |
| DB13 | `ExchangeRate_fromCurrency_toCurrency_key` never used — `resolveRate()` is Map-only | Index         | 🟢 Low    | XS     | ❌ Not done        |
| DB14 | `Account` + `Holding` seq-scan only — indexes ignored at current row count          | Index         | 🟢 Low    | —      | Monitor            |

---

## Detail

### DB1 — VACUUM ANALYZE on Bloated Tables · 🔴 · Effort: XS

`Account` and `Holding` have dead-row counts that match or exceed their live counts. Autovacuum hasn't kept up with the volume of UPDATE operations (likely every `cashBalance` mutation and every `quantity` edit triggers an UPDATE). This inflates heap pages, slows sequential scans, and wastes I/O on index traversal.

| Table                | Live | Dead | Bloat ratio |
| -------------------- | ---- | ---- | ----------- |
| `Account`            | 2    | 32   | **1600%**   |
| `Holding`            | 46   | 48   | **104%**    |
| `Setting`            | 5    | 6    | 120%        |
| `HoldingTransaction` | 75   | 11   | 15%         |

**Fix:** run immediately (no schema change, no downtime):

```sql
VACUUM ANALYZE "Account";
VACUUM ANALYZE "Holding";
VACUUM ANALYZE "Setting";
VACUUM ANALYZE "HoldingTransaction";
```

Consider tuning `autovacuum_vacuum_scale_factor` per-table for `Account` and `Holding` since they receive frequent small updates:

```sql
ALTER TABLE "Account"  SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE "Holding"  SET (autovacuum_vacuum_scale_factor = 0.02);
```

---

### DB2 — Enable `pg_stat_statements` · 🔴 · Effort: XS

The extension is not installed. Without it, the Neon MCP "list slow queries" tool returns an error, and there is no visibility into which queries are slow or how often they run.

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

After enabling, baseline the top-10 slowest queries within a week of normal traffic before starting any index tuning work.

---

### DB3 — Add `price` to `HoldingTransaction` · 🔴 · Effort: M

`HoldingTransaction` records only `quantity` — there is no price-per-unit at the time of the trade. This makes **cost basis and unrealised P&L calculations impossible** from the ledger. The current `PriceCache` only stores the _current_ price; historical prices are not retained, so reconstructing cost basis after the fact is also not possible.

**Prisma schema change:**

```prisma
model HoldingTransaction {
  // existing fields ...
  price    Decimal?  @db.Decimal(18, 8)   // price per unit at execution
  fee      Decimal?  @db.Decimal(18, 8)   // brokerage fee (optional)
}
```

`price` should be nullable so that existing rows (and EDIT-type transactions) remain valid. The UI form for BUY/SELL should require it going forward.

**Migration:**

```sql
ALTER TABLE "HoldingTransaction"
  ADD COLUMN price NUMERIC(18, 8),
  ADD COLUMN fee   NUMERIC(18, 8);
```

This is the single highest-value schema addition. It unblocks: cost basis per holding, unrealised gain/loss on the analysis tab, and tax-lot accounting.

---

### DB4 — Add Explicit `date` to Transaction Tables · 🟡 · Effort: S

`HoldingTransaction` and `CashTransaction` only have `createdAt` (the DB insert timestamp). Users cannot backdate transactions — entering a trade executed last week shows today's date in history views.

**Prisma schema change (both models):**

```prisma
date DateTime @default(now()) @db.Timestamptz(3)
```

**Migration:**

```sql
ALTER TABLE "HoldingTransaction" ADD COLUMN date TIMESTAMPTZ(3) DEFAULT NOW();
ALTER TABLE "CashTransaction"    ADD COLUMN date TIMESTAMPTZ(3) DEFAULT NOW();
-- Backfill from createdAt for existing rows:
UPDATE "HoldingTransaction" SET date = "createdAt" WHERE date IS NULL;
UPDATE "CashTransaction"    SET date = "createdAt" WHERE date IS NULL;
-- Then make NOT NULL:
ALTER TABLE "HoldingTransaction" ALTER COLUMN date SET NOT NULL;
ALTER TABLE "CashTransaction"    ALTER COLUMN date SET NOT NULL;
```

Also add indexes for timeline queries:

```sql
CREATE INDEX "HoldingTransaction_date_idx" ON "HoldingTransaction" ("holdingId", date DESC);
CREATE INDEX "CashTransaction_date_idx"    ON "CashTransaction"    ("accountId", date DESC);
```

---

### DB5 — Drop Redundant `NetWorthSnapshot_userId_idx` · 🟢 · Effort: XS

The table has two indexes on `userId`:

- `NetWorthSnapshot_userId_idx` — single-column `(userId)`
- `NetWorthSnapshot_userId_date_idx` — composite `(userId, date DESC)`

PostgreSQL can use the composite index to satisfy any query that filters only on `userId`, so the single-column index is redundant. It wastes ~16 kB and adds write overhead on every cron insert.

**Fix:**

```sql
DROP INDEX "NetWorthSnapshot_userId_idx";
```

Remove `@@index([userId])` from the `NetWorthSnapshot` Prisma model.

---

### DB6 — Move `colorSchema` from `localStorage` → `Setting` · 🟡 · Effort: S

Color schema preference (`"emerald"`, etc.) is currently stored in browser `localStorage` (key `asset-tracker-color-schema`, see `src/components/layout/color-schema-context.tsx`). It does not roam across devices or browsers. A user who logs in from a second device always gets the default theme.

**Prisma schema change:**

```prisma
model Setting {
  // existing fields ...
  colorSchema String @default("emerald")
}
```

**Migration:**

```sql
ALTER TABLE "Setting" ADD COLUMN "colorSchema" TEXT NOT NULL DEFAULT 'emerald';
```

The settings API (`/api/settings`) and `settings-service.ts` need updating to read/write this field. On login, seed `localStorage` from the DB value so the context initialises correctly.

---

### DB7 — Add `source` Field to `PriceCache` · 🟢 · Effort: XS

`PriceCache` does not record where a price came from (Yahoo Finance vs. CoinGecko fallback). When a price looks wrong, there is no way to tell which provider returned it.

```prisma
model PriceCache {
  // existing fields ...
  source String @default("yahoo")
}
```

Values: `"yahoo"` | `"coingecko"`. Set in `price-service.ts` at write time.

---

### DB8 — Migrate Timestamps to `timestamptz` · 🟢 · Effort: M

All `createdAt` / `updatedAt` columns use `TIMESTAMP WITHOUT TIME ZONE`. Node.js sends UTC in practice, but the DB type does not enforce this. Direct connections from psql, Prisma Studio, or future non-UTC environments may misinterpret values. The correct type is `TIMESTAMPTZ`.

This is a multi-table migration. Tackle it alongside DB4 (which already uses `TIMESTAMPTZ` for the new `date` columns) to minimise migration count.

---

### DB9 — Replace Synthetic `ExchangeRate.id` with Currency-Pair PK · 🟢 · Effort: M

`ExchangeRate` has a synthetic text `id` that is never used as a foreign key or lookup target — every query goes through the `(fromCurrency, toCurrency)` unique pair. The `id` column and its index exist purely to satisfy the Prisma `@id` requirement.

**Ideal state:**

```prisma
model ExchangeRate {
  fromCurrency String
  toCurrency   String
  rate         Decimal  @db.Decimal(18, 8)
  updatedAt    DateTime @updatedAt

  @@id([fromCurrency, toCurrency])
}
```

This removes one index (~24 kB), simplifies upserts, and eliminates the need to generate an `id` value. Requires updating `exchange-rate-service.ts` to use the composite key. Low urgency at 223 rows but worth doing before the table grows.

---

### DB10 — GIN Index on `NetWorthSnapshot.breakdown` · 🟢 · Effort: XS

`NetWorthSnapshot.breakdown` is a nullable JSONB column averaging ~208 bytes per row (391 rows today, growing daily). Currently no queries filter inside the JSON. If future analysis features query breakdown fields (e.g., "show all snapshots where account X value exceeds Y"), a GIN index will be needed.

```sql
CREATE INDEX "NetWorthSnapshot_breakdown_gin_idx"
  ON "NetWorthSnapshot" USING gin (breakdown);
```

Add this before shipping any feature that `WHERE breakdown @> '...'` or uses `jsonb_path_query`.

---

---

### DB11 — `cacheLife("minutes")` Too Short for Stable Data · 🔴 · Effort: XS

**Source: live `pg_stat_user_tables` — 2026-05-15 audit.**

`getCachedExchangeRates`, `fetchUserAccountsWithHoldingsInner`, and `findSettings` all use `cacheLife("minutes")` (~60s TTL). This is the root cause of the extreme seq scan counts:

- `ExchangeRate`: 64,923 seq scans × 223 rows = **14.4M tuples read** — entirely from the bulk-load expiring every minute
- `Account`: 65,801 seq scans — `fetchUserAccountsWithHoldings` cache expiring
- `Setting`: 33,508 seq scans — settings cache expiring

Exchange rates change once per day (cron). Account structure changes only on user mutations. The `revalidateTag()` calls on mutations already handle correct invalidation — the TTL is a staleness fallback that should be far longer.

**Fix (no schema change — app code only):**

```ts
// exchange-rate-service.ts  getCachedExchangeRates
cacheLife("hours"); // was "minutes"

// net-worth-service.ts  fetchUserAccountsWithHoldingsInner
cacheLife("hours"); // was "minutes"

// settings-service.ts  findSettings
cacheLife("hours"); // was "minutes"
```

Expected outcome: 95%+ reduction in seq scans on `ExchangeRate`, `Account`, and `Setting`. Tag-based invalidation (`revalidateTag`) already fires on every mutation so data freshness is unaffected.

---

### DB12 — Drop 4 Zero-Use Indexes · 🟡 · Effort: XS

**Source: `pg_stat_user_indexes` — 0 idx_scan across entire history.**

These indexes have never been read. They add write overhead on every INSERT/UPDATE with no query benefit:

| Index                              | Reason unused                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `Account_userId_idx`               | Fully covered by `Account_userId_isActive_idx` (leftmost prefix)                  |
| `Holding_symbol_idx`               | Price refresh batches symbols from app memory, queries `PriceCache` not `Holding` |
| `Holding_assetType_expiration_idx` | No options positions in use yet; re-add when OPTION holdings are common           |
| `NetWorthSnapshot_userId_idx`      | Covered by `(userId, date DESC)` composite — already tracked as DB5               |

**Migration:**

```sql
DROP INDEX "Account_userId_idx";
DROP INDEX "Holding_symbol_idx";
DROP INDEX "Holding_assetType_expiration_idx";
DROP INDEX "NetWorthSnapshot_userId_idx";
```

Remove corresponding `@@index` lines from `prisma/schema.prisma`.

> Note: `Holding_assetType_expiration_idx` and `Holding_symbol_idx` should be re-evaluated once the OPTION asset type is actively used or when holdings grow past ~500 rows.

---

### DB13 — `ExchangeRate_fromCurrency_toCurrency_key` Never Used · 🟢 · Monitor

**Source: `pg_stat_user_indexes` — 0 idx_scan.**

`resolveRate()` works entirely from the in-memory Map loaded by `getCachedExchangeRates()` — it never issues a DB query per currency pair. The `findFirst({ where: { fromCurrency, toCurrency } })` fallback at line 179 fires only when a rate is missing from the cache and needs lazy-fetching. This is rare and correct behaviour.

No action needed. If `resolveMissingRates()` is ever called more frequently (e.g., many new currency pairs), this unique index will start being used.

---

### DB14 — `Account` + `Holding` Seq-Scan Only at Current Row Count · 🟢 · Monitor

`Account` (28 rows) and `Holding` (46 rows) are too small for PostgreSQL's planner to prefer index scans over heap scans — the full table fits in a single page. Both `Account_userId_isActive_idx` and `Holding_accountId_symbol_key` are correctly defined; they will activate automatically as rows grow past ~200–500.

No action needed now. Revisit after DB11 is fixed (which will dramatically reduce the raw scan count regardless of plan choice).

---

## Index Inventory

| Table                | Index                                           | Type                             | Notes                                             |
| -------------------- | ----------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `Account`            | `Account_pkey`                                  | UNIQUE btree(id)                 |                                                   |
| `Account`            | `Account_userId_idx`                            | btree(userId)                    | redundant if `userId_isActive` covers all queries |
| `Account`            | `Account_userId_isActive_idx`                   | btree(userId, isActive)          | composite; primary lookup path                    |
| `CashTransaction`    | `CashTransaction_pkey`                          | UNIQUE btree(id)                 |                                                   |
| `CashTransaction`    | `CashTransaction_accountId_createdAt_idx`       | btree(accountId, createdAt DESC) |                                                   |
| `ExchangeRate`       | `ExchangeRate_pkey`                             | UNIQUE btree(id)                 | synthetic; see DB9                                |
| `ExchangeRate`       | `ExchangeRate_fromCurrency_toCurrency_key`      | UNIQUE btree                     | actual lookup key                                 |
| `Holding`            | `Holding_pkey`                                  | UNIQUE btree(id)                 |                                                   |
| `Holding`            | `Holding_accountId_symbol_key`                  | UNIQUE btree                     | enforces 1 position per symbol per account        |
| `Holding`            | `Holding_symbol_idx`                            | btree(symbol)                    | price refresh batching                            |
| `Holding`            | `Holding_assetType_expiration_idx`              | btree(assetType, expiration)     | options expiry scan                               |
| `HoldingTransaction` | `HoldingTransaction_pkey`                       | UNIQUE btree(id)                 |                                                   |
| `HoldingTransaction` | `HoldingTransaction_holdingId_createdAt_idx`    | btree(holdingId, createdAt DESC) |                                                   |
| `NetWorthSnapshot`   | `NetWorthSnapshot_pkey`                         | UNIQUE btree(id)                 |                                                   |
| `NetWorthSnapshot`   | `NetWorthSnapshot_userId_date_baseCurrency_key` | UNIQUE btree                     | dedup guard for cron                              |
| `NetWorthSnapshot`   | `NetWorthSnapshot_userId_date_idx`              | btree(userId, date DESC)         | history reads                                     |
| `NetWorthSnapshot`   | `NetWorthSnapshot_userId_idx`                   | btree(userId)                    | **redundant — see DB5**                           |
| `PriceCache`         | `PriceCache_pkey`                               | UNIQUE btree(symbol)             |                                                   |
| `PriceCache`         | `PriceCache_updatedAt_idx`                      | btree(updatedAt)                 | stale-price detection                             |
| `Setting`            | `Setting_pkey`                                  | UNIQUE btree(id)                 |                                                   |
| `Setting`            | `Setting_userId_key`                            | UNIQUE btree(userId)             | 1:1 user→settings                                 |
