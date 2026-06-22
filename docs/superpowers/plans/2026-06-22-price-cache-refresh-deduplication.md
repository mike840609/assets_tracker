# Price Cache Refresh Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent N concurrent serverless instances from making N identical Yahoo Finance / CoinGecko calls for the same symbols by adding an atomic `refreshingAt` claim to `PriceCache`.

**Architecture:** Add a nullable `refreshingAt DateTime?` column to `PriceCache`. Before fetching external prices, each instance claims its stale symbols via an atomic `UPDATE ... RETURNING symbol`. Only the returned symbols are fetched. A 30-second dead-instance TTL in the claim predicate handles killed functions. Cleanup clears the claim on failure without touching the price or `updatedAt`.

**Tech Stack:** Prisma 7, PostgreSQL (Neon serverless), Next.js 16 App Router, Vitest.

## Global Constraints

- Use `pnpm` for all package/script commands, never `npm` or `yarn`.
- TypeScript strict mode — no `any`, no `ts-ignore`.
- Prisma client is at `@/generated/prisma` (not `@prisma/client`).
- Run `pnpm exec prisma generate` after every schema change.
- All raw SQL must use positional parameters (`$1`, `$2`, …); no string interpolation of user-controlled values.
- Do not add new npm dependencies.
- After every code change: `pnpm format:check && pnpm lint && pnpm typecheck` must pass.
- Tests live in `tests/unit/`; run with `pnpm test:unit`.

---

## File Map

| File                                                             | Action         | Responsibility                                                    |
| ---------------------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `prisma/schema.prisma`                                           | Modify         | Add `refreshingAt DateTime?` to `PriceCache`                      |
| `prisma/migrations/<ts>_price_cache_refreshing_at/migration.sql` | Auto-generated | `ALTER TABLE "PriceCache" ADD COLUMN "refreshingAt" TIMESTAMP(3)` |
| `src/lib/services/price-service.ts`                              | Modify         | Claim-before-fetch, cleanup on failure, clear claim on upsert     |
| `tests/unit/price-service.test.ts`                               | Create         | Two unit tests: deduplication + claim release on failed fetch     |

---

### Task 1: Schema migration

**Files:**

- Modify: `prisma/schema.prisma` (the `PriceCache` model)
- Auto-created: `prisma/migrations/<timestamp>_price_cache_refreshing_at/migration.sql`

**Interfaces:**

- Produces: `PriceCache.refreshingAt: DateTime?` available in Prisma client and raw SQL

- [ ] **Step 1: Add `refreshingAt` to `PriceCache` in `prisma/schema.prisma`**

Find the `PriceCache` model and add the nullable field:

```prisma
model PriceCache {
  symbol       String    @id
  price        Decimal   @db.Decimal(18, 8)
  currency     String    @default("USD")
  updatedAt    DateTime  @updatedAt
  refreshingAt DateTime?

  @@index([updatedAt])
}
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm exec prisma migrate dev --name price_cache_refreshing_at
```

Expected output includes a line like:

```
✔  Your database is now in sync with your schema.
```

And a new file is created at `prisma/migrations/<timestamp>_price_cache_refreshing_at/migration.sql` containing:

```sql
-- AlterTable
ALTER TABLE "PriceCache" ADD COLUMN "refreshingAt" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm exec prisma generate
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add refreshingAt claim column to PriceCache"
```

---

### Task 2: Failing unit tests

**Files:**

- Create: `tests/unit/price-service.test.ts`

**Interfaces:**

- Consumes: `refreshPricesForStockSymbols(symbols: string[], opts?: RefreshPricesOptions): Promise<RefreshPricesResult>` from `@/lib/services/price-service`
- Consumes: `PRICE_REFRESH_TTL_MS: number` from `@/lib/refresh-policy`

- [ ] **Step 1: Create the test file**

```typescript
// tests/unit/price-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// price-service imports server-only modules and external clients.
// Stub them all so the unit suite needs no DB or network.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceCache: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  withTiming: <T>(_: string, fn: () => T) => fn(),
}));
vi.mock("@/lib/services/yahoo-client");
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const { prisma } = await import("@/lib/prisma");
const { getYahooClient } = await import("@/lib/services/yahoo-client");
const { refreshPricesForStockSymbols } = await import("@/lib/services/price-service");
const { PRICE_REFRESH_TTL_MS } = await import("@/lib/refresh-policy");

describe("refreshPricesForStockSymbols — claim deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns retryAfterSeconds 30 when all existing stale symbols are claimed by another instance", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    // Existence+freshness check: AAPL exists in PriceCache but is stale
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ]);
    // Claim UPDATE: returns [] — another instance already holds the claim
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([]);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    expect(result.retryAfterSeconds).toBe(30);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(getYahooClient).not.toHaveBeenCalled();
  });

  it("releases the claim when Yahoo returns no prices (fetch failure)", async () => {
    const staleDate = new Date(Date.now() - PRICE_REFRESH_TTL_MS - 5_000);

    // Existence+freshness check: AAPL exists and is stale
    vi.mocked(prisma.priceCache.findMany).mockResolvedValueOnce([
      { symbol: "AAPL", updatedAt: staleDate },
    ]);
    // Claim UPDATE: AAPL claimed by this instance
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ symbol: "AAPL" }]);
    // Yahoo always throws — fetchYahooQuotes will catch and return an empty Map
    vi.mocked(getYahooClient).mockResolvedValue({
      quote: vi.fn().mockRejectedValue(new Error("network error")),
    } as never);
    // Cleanup UPDATE
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValueOnce(1);

    const result = await refreshPricesForStockSymbols(["AAPL"]);

    // Cleanup must be called: SET "refreshingAt" = NULL for claimed symbols
    const cleanupCall = vi
      .mocked(prisma.$executeRawUnsafe)
      .mock.calls.find(
        ([sql]) => typeof sql === "string" && /refreshingAt/i.test(sql) && /NULL/i.test(sql),
      );
    expect(cleanupCall).toBeDefined();
    expect(result.updated).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
pnpm test:unit -- price-service
```

Expected: both tests **FAIL** — `refreshPricesForStockSymbols` does not yet perform the claim step and the cleanup doesn't exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/unit/price-service.test.ts
git commit -m "test(price-service): add failing tests for claim deduplication"
```

---

### Task 3: Implement claim logic in price-service

**Files:**

- Modify: `src/lib/services/price-service.ts`

**Interfaces:**

- Consumes: `PriceCache.refreshingAt` (from Task 1 schema)
- Produces: `refreshPricesForHoldings` with claim-before-fetch behaviour; `retryAfterSeconds: 30` when all symbols are mid-refresh

The changes are all inside `refreshPricesForHoldings` (the private function) and the `CLAIM_LOCK_TTL_MS` constant at the top.

- [ ] **Step 1: Add the `CLAIM_LOCK_TTL_MS` constant**

At the top of `src/lib/services/price-service.ts`, alongside the other constants:

```typescript
const FETCH_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_500]; // 2 retries: 500 ms then 1.5 s
const CLAIM_LOCK_TTL_MS = 30_000; // dead-instance TTL for refreshingAt claim
```

- [ ] **Step 2: Replace the freshness gate and add claim logic**

Replace the existing `refreshPricesForHoldings` function entirely with the version below. The key changes are:

1. The two-pass freshness gate (`findMany` fresh-only → filter stale) is replaced by a **single `findMany`** that loads all existing rows, then derives fresh/stale/new in JS.
2. After the freshness gate, stale-existing symbols go through an **atomic claim UPDATE**.
3. When zero symbols are claimable and there are no new symbols, return `retryAfterSeconds: 30`.
4. A **`releaseClaims` helper** clears `refreshingAt` on the cleanup paths.
5. The **upsert SQL** gains `"refreshingAt" = NULL` in the `ON CONFLICT DO UPDATE` clause.

```typescript
async function releaseClaims(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  const placeholders = symbols.map((_, i) => `$${i + 1}`).join(", ");
  await prisma
    .$executeRawUnsafe(
      `UPDATE "PriceCache" SET "refreshingAt" = NULL WHERE symbol IN (${placeholders})`,
      ...symbols,
    )
    .catch((err) => {
      log.error("price.refresh.claim_cleanup_failed", { error: String(err) });
    });
}

async function refreshPricesForHoldings(
  holdings: { symbol: string; assetType: string }[],
  opts: RefreshPricesOptions = {},
): Promise<RefreshPricesResult> {
  if (holdings.length === 0) {
    return {
      updated: 0,
      changed: 0,
      skippedFresh: 0,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  let skippedFresh = 0;
  let earliestFreshUpdatedAt: Date | null = null;
  let claimedSymbols: string[] = [];

  if (!opts.force) {
    // Single query: load all existing PriceCache rows for these symbols so we
    // can derive fresh / stale-existing / stale-new in one round-trip.
    const existingRows = await prisma.priceCache.findMany({
      where: { symbol: { in: holdings.map((h) => h.symbol) } },
      select: { symbol: true, updatedAt: true },
    });

    const freshThreshold = new Date(Date.now() - PRICE_REFRESH_TTL_MS);
    const freshSymbols = new Set<string>();
    const existingSymbols = new Set<string>();

    for (const row of existingRows) {
      existingSymbols.add(row.symbol);
      if (row.updatedAt >= freshThreshold) {
        freshSymbols.add(row.symbol);
        if (!earliestFreshUpdatedAt || row.updatedAt < earliestFreshUpdatedAt) {
          earliestFreshUpdatedAt = row.updatedAt;
        }
      }
    }

    skippedFresh = freshSymbols.size;
    if (skippedFresh > 0) {
      log.info("price.refresh.skipped_fresh", { count: skippedFresh });
    }

    holdings = holdings.filter((h) => !freshSymbols.has(h.symbol));

    if (holdings.length === 0) {
      const nextRefreshAt = earliestFreshUpdatedAt
        ? new Date(earliestFreshUpdatedAt.getTime() + PRICE_REFRESH_TTL_MS)
        : null;
      return {
        updated: 0,
        changed: 0,
        skippedFresh,
        errors: [],
        nextRefreshAt: nextRefreshAt?.toISOString() ?? null,
        retryAfterSeconds: nextRefreshAt
          ? Math.max(1, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 1000))
          : null,
      };
    }

    // Split stale symbols: existing rows can be claimed; new symbols bypass the claim.
    const staleExisting = holdings
      .filter((h) => existingSymbols.has(h.symbol))
      .map((h) => h.symbol);
    const staleNew = holdings.filter((h) => !existingSymbols.has(h.symbol));

    if (staleExisting.length > 0) {
      // Atomic claim: set refreshingAt = NOW() only for symbols that are stale
      // and not currently being refreshed (or whose claim has expired after 30s).
      // $1 = lockCutoff (refreshingAt expiry), $2 = freshThreshold (updatedAt gate),
      // $3...$N = symbol values — all positional, no string interpolation of values.
      const lockCutoff = new Date(Date.now() - CLAIM_LOCK_TTL_MS);
      const symbolPlaceholders = staleExisting.map((_, i) => `$${i + 3}`).join(", ");
      const claimed = await prisma.$queryRawUnsafe<{ symbol: string }[]>(
        `UPDATE "PriceCache"
         SET "refreshingAt" = NOW()
         WHERE symbol IN (${symbolPlaceholders})
           AND ("refreshingAt" IS NULL OR "refreshingAt" < $1)
           AND "updatedAt" < $2
         RETURNING symbol`,
        lockCutoff,
        freshThreshold,
        ...staleExisting,
      );
      claimedSymbols = claimed.map((r) => r.symbol);
    }

    if (claimedSymbols.length === 0 && staleNew.length === 0) {
      // All existing stale symbols are being refreshed by another instance.
      // Tell the client when the claim lock expires so it knows when to retry.
      return {
        updated: 0,
        changed: 0,
        skippedFresh,
        errors: [],
        nextRefreshAt: null,
        retryAfterSeconds: Math.ceil(CLAIM_LOCK_TTL_MS / 1000),
      };
    }

    // Narrow holdings to only the symbols this instance will fetch.
    const fetchable = new Set([...claimedSymbols, ...staleNew.map((h) => h.symbol)]);
    holdings = holdings.filter((h) => fetchable.has(h.symbol));
  }

  const stockSymbols = holdings
    .filter((h) => ["STOCK", "ETF", "MUTUAL_FUND", "BOND", "OPTION"].includes(h.assetType))
    .map((h) => h.symbol);

  const cryptoSymbols = holdings.filter((h) => h.assetType === "CRYPTO").map((h) => h.symbol);

  const errors: string[] = [];
  let updated = 0;
  let changed = 0;

  const [stockPrices, cryptoPrices] = await Promise.all([
    fetchStockPrices(stockSymbols),
    fetchCryptoPrices(cryptoSymbols),
  ]);

  const allPrices = new Map([...stockPrices, ...cryptoPrices]);

  const entries = [...allPrices];
  if (entries.length === 0) {
    // No prices came back (all fetches failed). Release claims so the next
    // request can retry rather than waiting for the 30s dead-instance TTL.
    await releaseClaims(claimedSymbols);
    return {
      updated: 0,
      changed: 0,
      skippedFresh,
      errors: [],
      nextRefreshAt: null,
      retryAfterSeconds: null,
    };
  }

  try {
    const currentRows = await prisma.priceCache.findMany({
      where: { symbol: { in: entries.map(([symbol]) => symbol) } },
      select: { symbol: true, price: true, currency: true },
    });
    const currentBySymbol = new Map(currentRows.map((row) => [row.symbol, row]));
    const pendingChanged = entries.reduce((count, [symbol, { price, currency }]) => {
      const current = currentBySymbol.get(symbol);
      return current === undefined ||
        current.currency !== currency ||
        decimalChangedAtDbScale(current.price, price)
        ? count + 1
        : count;
    }, 0);

    const params: unknown[] = [];
    const placeholders = entries.map(([symbol, { price, currency }]) => {
      const base = params.length;
      params.push(symbol, String(price), currency);
      return `($${base + 1}, $${base + 2}::numeric, $${base + 3}, NOW())`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PriceCache" (symbol, price, currency, "updatedAt")
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (symbol) DO UPDATE SET
         price          = EXCLUDED.price,
         currency       = EXCLUDED.currency,
         "updatedAt"    = NOW(),
         "refreshingAt" = NULL`,
      ...params,
    );
    updated = entries.length;
    changed = pendingChanged;
    if (changed > 0) revalidateTag("prices", "max");
  } catch (error) {
    errors.push(`Bulk upsert failed: ${String(error)}`);
    // Release claims so the next request can retry immediately.
    await releaseClaims(claimedSymbols);
  }

  return { updated, changed, skippedFresh, errors, nextRefreshAt: null, retryAfterSeconds: null };
}
```

- [ ] **Step 3: Run the unit tests**

```bash
pnpm test:unit -- price-service
```

Expected: both tests **PASS**.

- [ ] **Step 4: Run the full check suite**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit
```

Expected: all pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/price-service.ts
git commit -m "feat(price-cache): atomic claim deduplication via refreshingAt column"
```
