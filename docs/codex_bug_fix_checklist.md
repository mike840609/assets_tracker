# Codex Bug Fix Checklist

Source-only audit date: 2026-05-27

Scope:

- Reviewed application source, Prisma schema, route handlers, services, UI mutation flows, tests, and Next.js 16 local package docs relevant to App Router route handlers and Server/Client Components.
- Did not use existing project documents under `docs/` as source material.

Verification already run:

- [x] `npm run typecheck` passed.
- [x] `npm run lint` passed.
- [x] `npm run build` passed.

## P0 - Import/Export Can Break Account-Scoped Goals

Evidence:

- Export includes full `appAccounts` and `goals` from the database in `src/app/api/settings/data/route.ts:10-33`.
- Import deletes existing accounts and goals in `src/app/api/settings/data/route.ts:63-66`.
- Import recreates accounts without preserving or mapping old account IDs in `src/app/api/settings/data/route.ts:84-100`.
- Import recreates goals with the original `scopeRefId` in `src/app/api/settings/data/route.ts:170-183`.
- `dataImportSchema` does not preserve account `id` fields in `src/lib/validators.ts:146-197`.

Why this is a bug:

- A backup containing a goal with `scope: "ACCOUNT"` stores `scopeRefId` as an account ID.
- During import, accounts get new IDs, but the goal keeps the old ID.
- Goal progress then points at a non-existent account and reports incorrect progress.

Fix checklist:

- [ ] Extend `dataImportSchema` to accept account IDs from exported backups.
- [ ] During import, build an `oldAccountId -> newAccountId` map.
- [ ] Remap `goal.scopeRefId` when `goal.scope === "ACCOUNT"`.
- [ ] Reject or clearly report account-scoped goals whose referenced account is missing.
- [ ] Add an import regression test: export/import a backup with an account-scoped goal and verify progress is attached to the recreated account.

## P0 - Data Import Leaves Cache Components Stale

Evidence:

- Import performs destructive replacement of accounts, snapshots, goals, and settings in `src/app/api/settings/data/route.ts:61-188`.
- The route returns success without invalidating any cache tags in `src/app/api/settings/data/route.ts:190`.
- Cached reads are tagged elsewhere, including `accounts:${userId}`, `history:${userId}`, `goals:${userId}`, `settings:${userId}`, `net-worth:${userId}`, `snapshots`, and `net-worth`.

Why this is a bug:

- The import UI reloads the page after success, but a reload can still receive stale Cache Components data.
- Users may see pre-import accounts, goals, settings, or history until the cache expires or another mutation invalidates it.

Fix checklist:

- [ ] After successful import, invalidate user-scoped account, history, goal, settings, and net-worth tags.
- [ ] Invalidate broad snapshot/net-worth tags when snapshots are imported.
- [ ] Set the `NEXT_LOCALE` cookie if imported settings include a locale.
- [ ] Add a regression test that imports a backup, reloads, and verifies the newly imported account/settings appear immediately.

## P1 - Holding Transaction Edits Ignore BUY/SELL Sign Semantics

Evidence:

- The UI allows non-cash transaction type changes to `BUY`, `SELL`, and `EDIT` in `src/components/accounts/transaction-history.tsx:445-448`.
- Expired options create a positive-quantity `SELL` transaction in `src/app/api/cron/snapshot/route.ts:32-38`.
- Transaction PATCH adjusts holdings by raw quantity difference only in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:43-50`.
- Transaction DELETE always subtracts raw transaction quantity in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:140-146`.
- Transaction rows display a positive quantity with a plus sign regardless of transaction type in `src/components/accounts/transaction-history.tsx:380-382`.

Why this is a bug:

- A positive `SELL` should reduce holdings.
- Deleting a `SELL` should increase holdings.
- Changing `BUY` to `SELL` should remove the old buy effect and apply the sell effect.
- Current logic can make holdings incorrect, especially for expired options or manually edited transaction types.

Fix checklist:

- [x] Introduce a shared signed-effect helper for holding transactions in `src/lib/services/balance.ts:25-41`:
  - `BUY`: `+quantity`
  - `SELL`: `-quantity`
  - `EDIT`: `quantity` as the explicit adjustment delta
- [x] On PATCH, compute `newSignedEffect - oldSignedEffect` and apply that to the holding in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:47-78`.
- [x] On DELETE, apply `-oldSignedEffect` in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:156-171`.
- [x] Reject mutations that would drive holding quantity below zero unless the product explicitly supports short positions in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:56-59` and `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:160-163`.
- [x] Display transaction signs based on transaction type, not only numeric sign, in `src/components/accounts/transaction-history.tsx:46-56` and `src/components/accounts/transaction-history.tsx:392-395`.
- [ ] Add API tests for deleting a `SELL`, changing `BUY -> SELL`, changing `SELL` quantity, and deleting an expired-option `SELL`.

Implementation status:

- Fixed on 2026-05-28.
- Verified with `npm run typecheck`, `npm run lint`, and `npm run build`.

## P1 - Cash Transaction Amount Validation Allows Sign Inversion

Evidence:

- Cash transaction schemas accept any number for `amount` in `src/lib/validators.ts:106-118`.
- Balance math treats `DEPOSIT` as positive and `WITHDRAWAL` as negative in `src/lib/services/balance.ts`.

Why this is a bug:

- A direct API call can create `DEPOSIT` with a negative amount, decreasing cash balance.
- A direct API call can create `WITHDRAWAL` with a negative amount, increasing cash balance.
- That bypasses the intended transaction semantics even if the UI input blocks negative numbers.

Fix checklist:

- [x] Replace the generic cash create schema with a discriminated union in `src/lib/validators.ts:112-128`.
- [x] Require positive `amount` for `DEPOSIT` and `WITHDRAWAL` in `src/lib/validators.ts:106-121` and `src/lib/services/balance.ts:6-11`.
- [x] Decide whether `EDIT` may be signed. Signed `EDIT` remains allowed as an explicit balance adjustment, but zero-value adjustments are rejected in `src/lib/validators.ts:123-127` and `src/lib/services/balance.ts:10`.
- [x] Apply the same validation to PATCH, including the UI's `quantity -> amount` compatibility path, in `src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:95-109`.
- [ ] Add route tests for negative deposit, negative withdrawal, signed edit, and zero amount.

Implementation status:

- Fixed on 2026-05-28.
- Verified with `npm run typecheck`, `npm run lint`, and `npm run build`.

## P1 - Manual Price Refresh Does Not Invalidate The `prices` Cache

Evidence:

- `fetchAllCachedPrices` is cached under the `prices` tag in `src/lib/services/price-service.ts:184-197`.
- Account list pages read prices through `getCachedPricesForSymbols` in `src/lib/services/price-service.ts:199-205`.
- Price refresh writes new `PriceCache` rows in `src/lib/services/price-service.ts:263-272`.
- `/api/prices/refresh` invalidates `net-worth` and `prices:crypto`, but not `prices`, in `src/app/api/prices/refresh/route.ts:6-11`.

Why this is a bug:

- Account list price displays can remain stale for up to the cache TTL after the user manually refreshes prices.
- The same stale cache can remain after cron refreshes all prices.

Fix checklist:

- [x] Invalidate `prices` after successful bulk `PriceCache` writes in `src/lib/services/price-service.ts:263-273`, cron refresh in `src/app/api/cron/snapshot/route.ts:68-72`, and single-holding price upserts in `src/app/api/accounts/[id]/holdings/route.ts:137-142`.
- [x] Prefer user-scoped invalidation for per-user refreshes if the price cache is later split by user, but invalidate the broad `prices` tag with the current shared cache in `src/app/api/prices/refresh/route.ts:7-12`.
- [x] Invalidate account/net-worth user tags when price refresh changes values shown on account pages. The refresh route now invalidates user net-worth plus broad `prices` cache in `src/app/api/prices/refresh/route.ts:7-12`; account pages read the refreshed price map after `router.refresh()`.
- [x] Check the settings refresh UI for non-OK responses before showing success in `src/components/settings/settings-form.tsx:129-137`; dashboard refresh and pull-to-refresh now also check non-OK responses in `src/components/dashboard/dashboard-actions.tsx:28-38` and `src/components/dashboard/dashboard-pull-refresh.tsx:15-24`.
- [ ] Add a test where a changed `PriceCache` value is visible on `/accounts` immediately after refresh.

Implementation status:

- Fixed on 2026-05-28.
- Verified with `npm run typecheck`, `npm run lint`, and `npm run build`.

## P1 - Exchange-Rate Refresh Does Not Invalidate Derived Value Caches

Evidence:

- `/api/exchange-rates/refresh` refreshes rates and invalidates only `exchange-rates` in `src/app/api/exchange-rates/refresh/route.ts:18-26`.
- Net worth, account values, history, and projections all derive display values from exchange rates through cached services.
- The settings UI shows success for exchange-rate refresh without checking response status or refreshing the route in `src/components/settings/settings-form.tsx:345-350`.

Why this is a bug:

- Updated rates may be stored, but derived UI can continue showing old converted values until net-worth/history caches expire or another mutation invalidates them.
- Settings can show a success toast even if the refresh request returns an error status.

Fix checklist:

- [x] After exchange-rate refresh, invalidate derived tags that depend on rates, including `net-worth`, `net-worth:${userId}`, and `history:${userId}` in `src/app/api/exchange-rates/refresh/route.ts:24-29`.
- [x] Consider broad invalidation for cron/global rate refresh paths. Cron now invalidates broad `net-worth` immediately after global rate refresh so snapshots use fresh converted values in `src/app/api/cron/snapshot/route.ts:62-65`.
- [x] Update the settings UI to check `res.ok`, parse errors, and call `router.refresh()` on success in `src/components/settings/settings-form.tsx:144-153` and `src/components/settings/settings-form.tsx:357-363`.
- [ ] Add a regression test where a rate change updates converted net worth/account values immediately after refresh.

Implementation status:

- Fixed on 2026-05-28.
- Verified with `npm run typecheck`, `npm run lint`, and `npm run build`.

## P2 - Transaction Pagination Accepts `NaN` Query Values

Evidence:

- `limit` is parsed with `Number(...)` and clamped with `Math.min/Math.max` in `src/app/api/accounts/[id]/transactions/route.ts:49`.
- `page` uses the same pattern in `src/app/api/accounts/[id]/transactions/route.ts:78-79`.

Why this is a bug:

- `Number("bad")` returns `NaN`.
- `Math.max(1, Math.min(100, NaN))` is still `NaN`.
- That `NaN` reaches raw SQL `LIMIT` or `OFFSET`, likely returning a 500 instead of a clean 400.

Fix checklist:

- [ ] Validate query params with `z.coerce.number().int().min(1).max(100)` or an equivalent helper.
- [ ] Return 400 for invalid `limit` or `page`.
- [ ] Keep cursor validation as-is, but add tests for invalid base64, invalid date, invalid limit, and invalid page.

## P2 - Snapshot Query Dates Are Not Validated

Evidence:

- `/api/snapshots` converts `from` and `to` directly with `new Date(...)` in `src/app/api/snapshots/route.ts:11-13`.

Why this is a bug:

- Invalid dates can reach Prisma queries and produce 500s.
- `from > to` is not rejected, which can lead to confusing empty results.

Fix checklist:

- [ ] Validate `from` and `to` as ISO dates.
- [ ] Reject invalid dates with 400.
- [ ] Reject or normalize `from > to`.
- [ ] Validate `currency` against the supported currency list or a strict three-letter uppercase code.
- [ ] Add route tests for invalid dates and reversed ranges.

## P2 - First-Time Settings Creation Has A Race

Evidence:

- `getOrCreateSettings` reads cached settings, then calls `prisma.setting.create` if none exist in `src/lib/services/settings-service.ts:26-39`.
- `Setting.userId` is unique in the Prisma schema.

Why this is a bug:

- Two concurrent first requests for the same user can both observe no settings.
- One create succeeds, the other can fail with a unique constraint error.

Fix checklist:

- [ ] Replace find-then-create with `upsert`, or catch the unique constraint and refetch.
- [ ] Keep locale detection outside the cached function, as it reads request data.
- [ ] Add a concurrency test that calls `getOrCreateSettings` twice for a user with no settings.

## P2 - Environment And Prisma Initialization Are Eager

Evidence:

- Env validation runs at module import in `src/lib/env.ts:36-57`.
- Prisma client is created at module import in `src/lib/prisma.ts:40`.
- Auth config imports required auth env at module import in `src/auth.config.ts:1-13`.

Why this is a potential bug:

- Next.js build/prerender and middleware/module evaluation can import server modules before a request actually needs every service.
- An unrelated path can fail because a feature-specific env var is missing.
- Eager Prisma creation also makes import-time side effects harder to reason about.

Fix checklist:

- [ ] Convert Prisma to a lazy `getPrisma()` or equivalent singleton getter.
- [ ] Split env validation by feature, for example auth, database, cron, preview auth.
- [ ] Ensure the proxy/middleware path imports only the env it truly needs.
- [ ] Keep a build test that runs without optional feature env where possible.

## P3 - Single Account DELETE Can Return 500 For Missing Rows

Evidence:

- `DELETE /api/accounts/[id]` calls `prisma.account.delete({ where: { id, userId } })` without a prior existence check in `src/app/api/accounts/[id]/route.ts:58-62`.

Why this is a bug:

- Prisma throws when the row does not exist.
- A missing account should return 404 consistently, like the GET/PATCH handlers.

Fix checklist:

- [ ] Use `deleteMany` and check `count`, or fetch first and return 404 before deleting.
- [ ] Add a route test for deleting a missing account.
- [ ] Consider the same pattern anywhere a composite owner-scoped delete can throw.
