# Module Enhancement Audit - 2026-06-17

This audit re-checks the current codebase module by module against the local
Next.js 16.2.2 docs in `node_modules/next/dist/docs/` and the existing
trackers in `docs/`. It is intentionally source-grounded: every live issue
below points at the current file and line where the risk still exists.

Automated baseline:

- `pnpm format:check` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test:unit` passed: 12 files, 107 tests.
- `pnpm build` passed. Build output still reports the Sentry `disableLogger`
  deprecation warning from `next.config.ts`.

Implementation update in this PR:

- P0 items A1, A2, A3, and C1 are now implemented with focused route/cron
  regression coverage. Remaining open findings start at A4, H1, P1, G1, U1,
  and the P2 hardening/schema cleanup queue below.

Severity guide:

- P0: correctness, data integrity, or stale financial output.
- P1: broken/500-prone edge cases or misleading UX.
- P2: hardening, maintainability, stale docs, or coverage gaps.

## Executive Plan

1. Fix ledger atomicity first: cash transaction create, account balance edit,
   and holding transaction edit/delete must commit ledger rows and account or
   holding totals as one write contract.
2. Normalize route input validation: reject invalid `limit`, `page`, `from`,
   `to`, and scoped goal references with 400 responses instead of letting
   invalid values flow into Prisma/raw SQL.
3. Remove duplicated snapshot-dedupe logic from projections by reusing the
   history tie-break convention: target currency wins, then latest `createdAt`.
4. Harden cron cache invalidation so option expiry invalidates net-worth before
   same-run snapshots are created.
5. Close the smaller UI/tooling gaps: undo-delete double commit, option-chain
   fetch cleanup, Sentry deprecation, auth-adapter typing, metrics body cap.
6. Add focused regression tests for every P0/P1 fix, then clean stale tracker
   statuses in `BUGS.md`, `CODE_QUALITY.md`, and `ROADMAP.md`.

## Module Findings

### Accounts and Ledger

Status: P0 ledger issues resolved in this PR; live P1 issues remain.

- P0 A1 - Resolved in this PR. Manual cash transaction creation now wraps the
  `CashTransaction` insert and `Account.cashBalance` increment in one
  `prisma.$transaction`, with route coverage confirming both writes go through
  the transaction path.
- P0 A2 - Resolved in this PR. Manual account balance edits now create the
  cash EDIT row and update the account inside one transaction. The optional
  balance-edit note is validated by `updateAccountSchema` and stripped from
  the account update payload before Prisma sees it.
- P0 A3 - Resolved in this PR. Holding transaction edit/delete now uses guarded
  `updateMany`/`deleteMany` row-state checks plus atomic holding
  `increment`/`decrement` writes. Negative decrements return 400, stale
  concurrent edits return 409, and successful mutations invalidate account,
  net-worth, and history caches as before.
- P1 A4 - Transaction pagination can pass `NaN` to raw SQL. `limit` and `page`
  are parsed with `Number(...)` in
  `src/app/api/accounts/[id]/transactions/route.ts:49` and `:78`. Values such
  as `?limit=abc` or `?page=abc` become `NaN`, then flow into `LIMIT`/`OFFSET`.
  Plan: add a Zod query schema using `z.coerce.number().int().min().max()` and
  return `validationError` for invalid params.
- P1 A5 - Account DELETE may surface a Prisma 500 instead of a 404.
  `src/app/api/accounts/[id]/route.ts:60` deletes by `{ id, userId }` without a
  missing-row guard. Plan: use `deleteMany({ where: { id, userId } })` and
  return 404 when `count === 0`, matching the stock/recurring delete pattern.

### History and Snapshots API

Status: live P1 issue found.

- P1 H1 - Snapshot range params are not validated. `src/app/api/snapshots/route.ts:12`
  and `:13` convert arbitrary `from`/`to` strings with `new Date(...)`; invalid
  dates can reach Prisma. `currency` at `:9` is also unconstrained. Plan: add a
  Zod query schema for ISO dates and three-letter currency codes; reject
  invalid ranges with 400 and add a small route-handler test.

### Cron and Snapshot Creation

Status: P0 cache-consistency issue resolved in this PR.

- P0 C1 - Resolved in this PR. The expired-option sweep now feeds a
  `structuralChanged` cache-invalidation gate, so both `accounts` and
  `net-worth` are revalidated before same-run snapshots are created even when
  prices, rates, and recurring materializers did not change.

### Projections

Status: live P1 issue found.

- P1 P1 - Projection dedupe can keep an older same-day snapshot. History uses a
  deterministic duplicate rule, but `src/lib/services/projection-service.ts:43`
  only replaces when no row exists or the candidate matches the target base
  currency. Two same-currency snapshots on the same day can leave the earlier
  one in projections. Plan: extract/share the history dedupe helper or mirror
  its target-currency-then-latest-`createdAt` rule; add a projection-service
  regression test.

### Goals

Status: live P1 issue found.

- P1 G1 - Goal scope references are accepted without semantic validation.
  `src/lib/validators.ts:268`-`:275` allows any `scopeRefId`; create/update in
  `src/app/api/goals/route.ts:31`-`:38` and
  `src/app/api/goals/[id]/route.ts:22`-`:28` persist it without checking that
  `ACCOUNT` references belong to the user or that `CATEGORY` references are
  valid categories. Plan: validate scope/ref pairs server-side before writes:
  `ACCOUNT` must exist for `userId`, `CATEGORY` must be an `AccountCategory`,
  and `NET_WORTH`/`ASSETS_ONLY` should clear `scopeRefId`.

### Settings and Data Management

Status: no new import/export correctness issue found; existing account deletion
gap remains.

- P2 S1 - True account deletion is still the missing privacy/GDPR piece already
  tracked as E16. Export and replace-import are present, bounded, validated, and
  transactional; deleting the `User` row plus a confirm UI remains pending.
- P2 S2 - Locale-change reload still uses an unmanaged timeout in
  `src/components/settings/settings-form.tsx`. Plan: track the timeout id and
  clear it on unmount, or replace the full reload with a routed locale refresh
  once the i18n flow supports it.

### UI and Shared Client Utilities

Status: live P1/P2 issues found.

- P1 U1 - Undo delete can commit twice. `src/lib/undo-delete.ts:28` and `:31`
  both call `onCommit()` when the toast closes and only guard the undo path.
  If Sonner fires both callbacks for one close, the DELETE can be issued twice.
  Plan: add a `committed` flag and route both callbacks through one `commitOnce`.
- P2 U2 - Option-chain fetches can set state after unmount.
  `src/components/accounts/option-builder.tsx:113`-`:135` and `:147`-`:160`
  fetch without an `AbortController` or mounted guard. Plan: add cancellation
  for initial and expiration-specific chain loads; keep failed-expiration state
  updates behind the same guard.
- P2 U3 - A few visible/accessibility strings remain hardcoded in client
  chrome and quick-add flows. Plan: move sidebar/mobile privacy labels and the
  remaining quick-add manual-search strings into `messages/en-US.json` and
  `messages/zh-TW.json`.

### Auth, Observability, and Platform

Status: live P2 issues found.

- P2 O1 - Sentry build config uses a deprecated option. `pnpm build` warns that
  `disableLogger` is deprecated; the option is set at `next.config.ts:151`.
  Plan: migrate to the current Sentry/Next config option
  (`webpack.treeshake.removeDebugLogging` where supported) or remove it if
  Turbopack does not support the replacement.
- P2 O2 - The custom auth adapter still relies on explicit `any` casts.
  `src/lib/auth-adapter.ts:7`-`:26` suppresses the adapter boundary. Plan:
  type the override against Auth.js `Adapter` and Prisma generated inputs so
  provider-account changes fail at compile time.
- P2 O3 - The vitals endpoint reads an unbounded body. `_metrics/vitals`
  calls `request.text()` at `src/app/api/_metrics/vitals/route.ts:6` without a
  size cap or rate limit, unlike the CSP report route. Plan: mirror the CSP
  report body cap and add a small anonymous rate limit.

### Database and Schema

Status: live P2 schema cleanup items remain.

- P2 D1 - `ExchangeRate` keeps both a synthetic `id` primary key and a unique
  `(fromCurrency, toCurrency)` pair at `prisma/schema.prisma:245`-`:252`.
  Plan: migrate to the currency pair as the primary key or document why the
  synthetic key is required.
- P2 D2 - `Goal.scopeRefId` is a free string at
  `prisma/schema.prisma:286`-`:287`; this matches mixed scopes but needs the
  server-side validation in G1 and preferably a comment documenting the
  invariant.
- P2 D3 - Cost-basis schema work is still blocked on `price`/`fee` for
  `HoldingTransaction`; keep E25 as the keystone migration before P&L/tax-lot
  features.

### Tests and CI

Status: baseline is good; targeted gaps remain.

- P1 T1 - Add tests for A4/H1/P1/G1. A1/A2/A3/C1 now have focused unit
  coverage in this PR; the remaining live P1 items still need regression tests
  when implemented.
- P2 T2 - Playwright coverage still does not exercise projections, history
  ranges, settings import/export round trip, or undo-delete double-close
  behavior. Add focused E2E specs after the P0 fixes.
- P2 T3 - Docs-only changes are intentionally ignored by CI. For audit docs,
  run `pnpm format:check` locally before merging because GitHub will not check
  Markdown-only edits under the current workflow path filters.

## Modules With No New Blocking Issue Found

The audit did not find a new blocking issue in these modules beyond items
already listed above or in the existing long-term roadmap:

- Dashboard rendering and pull-to-refresh composition.
- Analysis service pure aggregation helpers.
- Stock watch CRUD, reorder, quote, and refresh routes.
- Search route and option-chain route-handler validation/rate limiting.
- Recurring cash and recurring investment materializers.
- Health endpoint and CSP report endpoint.
- i18n request setup and root App Router file conventions.

## Exit Criteria

Consider this audit closed when:

- P0 items A1, A2, A3, and C1 are fixed and covered by tests.
- P1 items A4, A5, H1, P1, G1, and U1 are fixed and covered by tests.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, and
  `pnpm build` all pass without a new warning.
- Existing docs are reconciled so stale open items do not contradict the live
  code state.
