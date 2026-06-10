# Refresh Throttling — Freshness Gate + Per-User Rate Limits + Client Cooldown

## Context

> **Status note (2026-06-10):** the service-level freshness gate itself landed separately on master via #396 (1-min price TTL via `PriceCache.updatedAt`; 60-min FX TTL via an in-process per-base map), and #397 added USD cross-rate derivation before the rate=1 fallback. This change keeps the layers master still lacks — per-user rate limits, the cron `force` bypass, `skippedFresh`/`retryAfterSeconds` response hints, the shared client cooldown UX, and the `warmStockPrice` gate — and adopts #396's reviewed TTL values into `refresh-policy.ts`.

Users can spam the manual refresh surfaces (dashboard pull-to-refresh, dashboard refresh button, settings "refresh market data", stocks watchlist refresh) and every trigger hits external APIs (Yahoo Finance, CoinGecko, frankfurter.app / open.er-api.com) unconditionally:

- `POST /api/prices/refresh` and `POST /api/exchange-rates/refresh` have **no rate limit and no freshness check** — every call re-fetches all user symbols/currencies even if the cache is seconds old.
- Only `/api/stocks/refresh` (10/min) and `/api/stocks/quote` (60/min) are rate-limited, and only **per-IP**, never per-user.
- `PriceCache.updatedAt` / `ExchangeRate.updatedAt` exist but are never compared for staleness.
- Client buttons only have a transient `refreshing` disabled state.

Defense in depth, in order of authority:

1. **DB-backed freshness gate in the service layer** (primary — survives cold starts/multi-instance since it reads `updatedAt` from Postgres).
2. **Per-user in-memory rate limit** on refresh routes (secondary — protects the route itself).
3. **Client cooldown + honest toasts** (UX only, never trusted).

User chose: **server + client UX** (full stack).

## Tuning values

| Knob                                              | Value                                 | Rationale                                                                                                          |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PRICE_REFRESH_TTL_MS`                            | 2 min                                 | Near-real-time feel kept; caps a spam-puller at ~30 Yahoo batches/hr. Matches existing 300s read-cache revalidate. |
| `FX_REFRESH_TTL_MS`                               | 30 min                                | frankfurter = ECB daily data; open.er-api daily. 30 min is already overkill.                                       |
| `prices-refresh` / `rates-refresh` per-user limit | 5 / 60s                               | Allows honest retries, blocks loops.                                                                               |
| `stocks-refresh` limit                            | keep 10 / 60s, switch key IP → userId |                                                                                                                    |
| Client cooldown floor                             | 15 s                                  | Extended to server `retryAfterSeconds` when everything is fresh.                                                   |

## Implementation steps

### Infra

1. **New `src/lib/refresh-policy.ts`** — isomorphic constants (no `server-only`): `PRICE_REFRESH_TTL_MS`, `FX_REFRESH_TTL_MS`, `CLIENT_REFRESH_COOLDOWN_MS = 15_000`. Single source so server gate and client cooldown don't drift.
2. **`src/lib/rate-limit.ts`** — add optional `key?: string` to `RateLimitOptions`; `const id = options.key ?? getClientIp(request)`. Existing callers unchanged; existing 429 already sends `Retry-After`.

### Services

3. **`src/lib/services/price-service.ts`** — `refreshPricesForHoldings(holdings, opts?: { force?: boolean })`:
   - Unless `force`: query `priceCache.findMany({ where: { symbol: { in: symbols }, updatedAt: { gt: now - PRICE_REFRESH_TTL_MS } } })`, drop fresh symbols before the Yahoo/CoinGecko fetch.
   - Return shape (additive): `{ updated, skippedFresh, errors, nextRefreshAt: string | null, retryAfterSeconds: number | null }` — `nextRefreshAt` = earliest fresh `updatedAt` + TTL when everything was skipped.
   - `refreshAllPrices()` (cron) passes `{ force: true }`; `refreshPricesForUser` / `refreshPricesForStockSymbols` forward `opts` (default gated).
   - `log.info("prices.refresh.skipped_fresh", { skipped, requested })`.
4. **`src/lib/services/exchange-rate-service.ts`** — `refreshExchangeRates(base, opts?: { force?: boolean })` → `{ updated, skippedFresh, nextRefreshAt }` (was bare `number`). Unless `force`: `exchangeRate.aggregate({ where: { fromCurrency: base }, _max: { updatedAt }, _count })`; if rows exist and `_max` within TTL, early-return without external fetch. Comment the known caveat: a lazy single-pair persist can mark the base fresh for up to 30 min (acceptable — same day-grain upstream). Lazy `getExchangeRate` path untouched.

### Routes

5. **`src/app/api/prices/refresh/route.ts`** — per-user limiter (`{ limit: 5, prefix: "prices-refresh", key: userId }`); only `revalidateTag` when `updated > 0`; payload `ok({ updated, skippedFresh, errors, nextRefreshAt, retryAfterSeconds })` (keeps `updated` for back-compat).
6. **`src/app/api/exchange-rates/refresh/route.ts`** — same limiter pattern (`rates-refresh`); aggregate per-currency results; `nextRefreshAt` = earliest non-null; revalidate only when `totalUpdated > 0`.
7. **`src/app/api/stocks/refresh/route.ts`** — one line: add `key: userId`. Service gate applies automatically.
8. **`src/app/api/cron/snapshot/route.ts`** — `refreshExchangeRates(c, { force: true })`; `refreshAllPrices()` already forces internally. Cron is CRON_SECRET-gated, not `withAuth`, so per-user limits can't touch it.
9. **`src/lib/services/stock-watch-service.ts`** — `warmStockPrice`: return cached row without Yahoo upsert when `PriceCache.updatedAt` within `PRICE_REFRESH_TTL_MS`.

### Client

10. **New `src/lib/refresh-client.ts`** — shared client module with module-level `cooldownUntil`:
    - `refreshMarketData(): Promise<RefreshOutcome>` where outcome ∈ `updated | fresh | cooldown | error`; fires both POSTs in parallel; on 429 reads `Retry-After`; when both return `updated === 0` + `skippedFresh > 0` → `fresh` with payload `retryAfterSeconds`; success sets `cooldownUntil = now + CLIENT_REFRESH_COOLDOWN_MS`.
    - Dispatches `refresh:cooldown` CustomEvent on change (same pattern as existing `prices:refresh*` events in `dashboard-actions.tsx`); `getCooldownRemainingMs()` helper.
11. **New `src/hooks/use-refresh-cooldown.ts`** — subscribes to the event, 1s tick while active, returns `{ coolingDown, secondsLeft }` (follows `use-count-up` pattern).
12. **Component swaps** (replace inline fetch pairs with `refreshMarketData()` + outcome switch; `disabled={refreshing || coolingDown}`):
    - `src/components/dashboard/dashboard-actions.tsx`
    - `src/components/dashboard/dashboard-pull-refresh.tsx` (`router.refresh()` only on `updated`; `toast.info` for fresh/cooldown)
    - `src/components/settings/settings-form.tsx`
    - `src/components/stocks/stock-tracker-view.tsx` — keeps its own `/api/stocks/refresh` fetch; add 429 + fresh handling and a local 15s cooldown.
13. **i18n** (`messages/en-US.json` + `messages/zh-TW.json`), info-style not error:
    - `dashboardActions.alreadyFresh` — "Prices are already up to date — try again in {seconds}s"
    - `dashboardActions.cooldownWait` — "Please wait {seconds}s before refreshing"
    - `settings.toast.marketDataFresh`, `stocks.alreadyFresh`

## Edge cases

- **In-memory limiter resets** on cold start / per instance — accepted; the DB freshness gate is the shared source of truth. Worst-case race: two concurrent requests both pass the gate → bounded 2× fetch, safe via `ON CONFLICT` upserts.
- **Clock skew**: client only uses server-computed `retryAfterSeconds` / `Retry-After`, never wall-clock math on `nextRefreshAt`.
- **Back-compat**: `updated` retained in payloads; `refreshExchangeRates` return-type change has exactly two call sites (its route + cron), both updated here. Also `maybeWarmExchangeRate` callers ignore the return value — verify they still typecheck.
- **New currency, zero rows**: `_count === 0` → gate skipped, fetch proceeds.
- **E2E**: grep `tests/e2e/` for assertions on refresh `updated > 0` before merging (double-refresh may now hit the fresh path).

## Verification

1. `npm run format:check && npm run lint && npm run typecheck`.
2. Manual dev: dashboard refresh → success toast; immediate second refresh → "already up to date — try again in Xs", button disabled; confirm `PriceCache.updatedAt` did **not** advance (SQL/Prisma Studio).
3. 7× `curl -X POST /api/prices/refresh` with session cookie → 6th returns 429 with `Retry-After`.
4. `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/snapshot` right after a manual refresh → `updatedAt` columns **do** advance (force bypass works).
5. Watchlist double-refresh on `/stocks` → second shows info toast; `prices.refresh.skipped_fresh` appears in dev logs.
6. `npm run test:e2e`.

Order: infra (1–2) → services (3–4, 9) → routes (5–8) → client (10–12) → i18n (13) → verification.
