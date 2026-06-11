# Bug-Fix Checklist

A code-grounded, actionable punch list of bugs and small enhancements found by
direct source review (not by aggregating other docs). Items are grouped by
severity. Each entry cites the file and line range where the issue lives.

**How to use:**

- Pick an item, fix it on its own branch, tick the box in the same PR.
- File/line references reflect the code at the time this list was generated
  (2026-05-27) — if a path has moved, search by the symptom phrase.
- "Fix:" is a suggested direction, not a strict prescription. Use judgement.

Long-form rationale for some adjacent themes (perf, DB, UI, code quality)
lives in `PERFORMANCE.md`, `DATABASE.md`, `UI_UX.md`, `CODE_QUALITY.md`.
This file is intentionally short and execution-oriented.

---

## Critical

> Data corruption, auth/scope leaks, anything that can silently lose user data.

- [ ] **`src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:43–62`** — PATCH does a read-modify-write on `holdingTx.holding.quantity` across two separate Prisma statements; concurrent edits lose data. Fix: wrap both writes in `prisma.$transaction([...])` and switch to `{ quantity: { increment: diff } }`.
- [ ] **`src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:140–146`** — DELETE has the same read-modify-write race (`newHoldingQty = current - tx.qty`). Fix: use `{ quantity: { decrement: ... } }` and wrap delete + holding update in `prisma.$transaction`.
- [ ] **`src/app/api/accounts/[id]/transactions/[transactionId]/route.ts:96–112`** — Cash-transaction PATCH issues `account.update(... increment)` and `cashTransaction.update` as independent statements; a crash between them desyncs the account balance. Fix: wrap in `prisma.$transaction`.
- [ ] **`src/lib/services/snapshot-service.ts:7–8`** — `new Date()` + `setHours(0,0,0,0)` floors in the server's local timezone; Vercel functions run in regional UTC while users live in many timezones, so the upsert key `userId_date_baseCurrency` can drift one day depending on when the cron fires. Fix: derive `today` from UTC (`new Date(Date.UTC(y, m, d))`) so the snapshot date is timezone-stable.

## High

> Correctness bugs, stale-cache hazards, DoS surfaces.

- [ ] **`src/lib/services/snapshot-service.ts`** — `createSnapshot()` writes a snapshot but never calls `revalidateTag("history:${userId}")` / `net-worth:${userId}` / `accounts:${userId}`; cached history/dashboard reads serve stale data for up to an hour. Fix: revalidate the three per-user tags after the upsert.
- [ ] **`src/app/api/prices/refresh/route.ts`** — Only invalidates `net-worth` and `prices:crypto`; the per-user `accounts:${userId}` tag (which keys account-detail / holdings-table reads) is not invalidated, so manual refresh leaves the account pages on stale prices. Fix: add `revalidateTag(\`accounts:${userId}\`)`.
- [ ] **Mutation endpoints lack rate limiting** — `/api/accounts/reorder`, `/api/accounts/[id]/holdings` POST, `/api/prices/refresh`, `/api/exchange-rates/refresh` are auth-gated but unthrottled; a single authenticated client can saturate them. Fix: wrap each with `rateLimitCheckWithPrune` at a sensible per-IP cap (e.g. 60/min).
- [ ] **`src/auth.ts:46–51`** — Session callback assigns `session.user.id = token.sub` without guarding against `undefined`; if a provider ever omits `sub`, every downstream `withAuth` request returns 401 with no useful log. Fix: throw `new Error("Token missing sub")` in the JWT/session callback so the failure is loud.
- [ ] **`src/lib/services/exchange-rate-service.ts` (`getAllExchangeRates`, ~lines 72–119)** — On a fetch timeout the helper returns `{}` and `resolveRate` silently falls back to `1`; users keep viewing values without any "rates stale" signal. Fix: surface a stale flag in the returned shape and log distinctly on timeout (not once per missing pair).
- [ ] **`src/lib/services/exchange-rate-service.ts:53,184,197`** — Inverse rates computed on the fly via `1 / rate` accumulate float error across chained conversions. Fix: persist both directions on write, or cache the inverse alongside the forward rate.
- [ ] **`src/lib/services/history-service.ts:34–61`** — `normalizeSnapshots()` dedupes by `toDateString()` but tie-breaks by "first seen" rather than `max(createdAt)`; a manual + cron snapshot on the same day produces non-deterministic results. Fix: keep the snapshot with the greatest `createdAt`.
- [ ] **`src/lib/services/net-worth-service.ts:94`** — `h.contractMultiplier ?? 100` silently assumes 100× for any null option contract; micro/non-standard options are off by 10×. Fix: require non-null at the schema/validator layer, or warn loudly when defaulting.
- [ ] **`src/lib/validators.ts:88`** — `updateHoldingSchema.quantity = z.number().nonnegative()` accepts `0`, leaving zero-quantity holdings hanging around the table (currently hidden only by `quantity: { gt: 0 }` filters at read time). Fix: require `z.number().positive()` and route quantity-to-zero through the delete path.
- [ ] **`src/lib/validators.ts:79–90`** — `updateHoldingSchema.assetType` is mutable; a client can flip a stock holding to `OPTION` with no underlying/strike/expiration fields, producing an unrepresentable record. Fix: omit `assetType` from the update schema (or require an OCC-shape symbol when it switches).
- [ ] **`src/lib/validators.ts:98–117`** — `updateTransactionSchema` / `updateCashTransactionSchema` accept arbitrary signed amounts and don't validate `createdAt` is a parseable date; future-dated or NaN-amount edits silently corrupt balance math downstream. Fix: tighten with a discriminated union on `type` and use `z.string().datetime()` for `createdAt`.
- [ ] **`src/lib/rate-limit.ts:32–36`** — `getClientIp` only reads `x-forwarded-for`; behind Cloudflare or on non-Vercel hosts all unknown-IP requests share a single `"unknown"` bucket. Fix: fall back to `cf-connecting-ip` / `x-real-ip` before defaulting to `"unknown"`.

## Medium

> Defensive hardening, UX hazards, edge cases that haven't bitten yet.

- [ ] **`src/app/api/accounts/[id]/route.ts:37` (PATCH cashBalance)** — Diff is `Number(parsed.data.cashBalance) - Number(existingAccount.cashBalance)`; near float precision limits this drifts. Fix: compute the diff with `Prisma.Decimal` (or in cents) before issuing the increment.
- [ ] **`src/app/api/accounts/[id]/holdings/route.ts` DELETE** — Reads `id` from JSON body without Zod validation; missing/non-string `id` falls through to a 404 instead of a 400. Fix: validate explicitly.
- [ ] **`src/lib/services/account-service.ts` (`getAccountPriceMap` React `cache()` key)** — The key is built from a sorted symbol list, so two accounts with identical symbol sets collide. Fix: prepend `accountId` to the key.
- [ ] **`src/app/api/options/chain/route.ts:37–38`** — Symbol uppercased but not validated; garbage drives 5s upstream timeouts. Fix: reject anything that doesn't match `^[A-Z][A-Z0-9.\-]{0,5}$` before the Yahoo fetch.
- [x] **`revalidateTag` call style is mixed across mutation routes** — some use `{ expire: 0 }`, others `"max"`, others bare; grep `revalidateTag\(` and unify on the Next.js 16 form. Fix: pick one shape and migrate. _(Done 2026-06-11: user-initiated mutation routes use `{ expire: 0 }` (immediate expiry), background cron keeps `"max"` (SWR). Convention documented in `src/app/api/accounts/route.ts`.)_
- [ ] **`src/components/accounts/holding-form.tsx:144`, `src/components/accounts/quick-add-holding.tsx:170`** — `parseFloat("")` returns `NaN`; submit guards only check `> 0`, so a `NaN` quantity can reach the POST body via adjacent code paths. Fix: gate on `Number.isFinite(parsed) && parsed > 0`.
- [ ] **`src/components/accounts/inline-balance-editor.tsx:61`, `src/components/accounts/account-form.tsx:77`** — `Intl.NumberFormat("en-US")` is used to display, then the same string is `parseFloat`'d on blur; breaks when the value contains a thousands-comma. Fix: strip `,` before `parseFloat`, or keep state as a raw number and format only for display.
- [ ] **`src/components/accounts/option-builder.tsx` (lazy chain fetch effect)** — No `AbortController` on the in-flight chain fetch; unmount during fetch sets state on an unmounted component. Fix: abort on cleanup.
- [ ] **`src/lib/undo-delete.ts:28–33`** — Sonner's `onAutoClose` and `onDismiss` can both fire on a single toast close, executing `onCommit` twice (re-issuing the DELETE). Fix: gate with an atomic `committed` flag.
- [ ] **`src/components/ui/swipeable-row.tsx:119`** — Desktop fallback dropdown trigger is 28×28 px, below the 44 px target used elsewhere. Fix: `h-10 w-10` or `p-2`.
- [ ] **`src/components/accounts/account-detail.tsx:287–305`** — Editable-name affordance has duplicate `aria-label` on wrapper and inner icon; screen readers announce it twice. Fix: keep one.
- [ ] **`src/components/settings/settings-form.tsx:99,121`** — `setTimeout(() => window.location.reload(), 800)` fires regardless of unmount; if the user navigates away first, the reload kicks them off the new page. Fix: track mounted state or use a router refresh.

## Low

> Polish, i18n gaps, dead code, minor cleanups.

- [ ] **`src/components/layout/theme-toggle.tsx:10–12`** — "Light"/"Dark"/"System" hardcoded; add a `themeToggle` namespace to both message files.
- [ ] **`src/components/accounts/quick-add-holding.tsx:329,347`** — "Search instead" / "enter manually" hardcoded.
- [ ] **`src/components/accounts/account-detail.tsx:356`** — "Sort:" hardcoded.
- [ ] **`src/components/accounts/holding-search.tsx:68`** — `debounceRef` timeout cleared on input change but not on unmount; pending fetch leaks if the dialog closes mid-debounce. Fix: cleanup in a `useEffect` return.
- [ ] **`src/components/ui/freshness-badge.tsx:33–36`** — Empty-dep `useEffect` re-queues a `setTimeout(0)` every render. Fix: merge into a single effect keyed on `timestamp`.
- [ ] **`src/components/accounts/account-detail.tsx:54–58`** — `"new-item"` custom-event listener has no dispatchers in the codebase. Fix: confirm dead via grep and remove.
- [ ] **`src/components/accounts/option-builder.tsx:81`** — Integer-only quantity regex accepts leading zeros (`"007"`). Fix: strip leading zeros in the blur handler.
- [ ] **`src/lib/currencies.ts:34–52`** — `formatCurrency` fallback path emits `"<code> NaN"` if `amount` is `NaN`/`Infinity`. Fix: guard with `Number.isFinite` before formatting.
- [ ] **`prisma/schema.prisma` ExchangeRate** — Table has `id String @id @default(cuid())` plus `@@unique([fromCurrency, toCurrency])`; the cuid is unused and wastes index space. Fix: drop the cuid and use the composite as the primary key (migration required).
