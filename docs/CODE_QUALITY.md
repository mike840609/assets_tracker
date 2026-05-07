# Assets Tracker — Code Quality

This file consolidates three former docs: `CODE_QUALITY_SUGGESTIONS.md` (Q1–Q20, engineering hygiene), `CRITICAL_GAPS.md` (C1–C14, missing documentation audit), and `DOCS_REVIEW_SUGGESTIONS.md` (D1–D10, cross-doc execution backlog).

---

## Engineering Hygiene (Q1–Q20)

**Baseline:** 2026-05-07 · **Items:** 20 · **Status:** ❌ all pending

Concrete, file-cited engineering hygiene gaps. Items can be picked up one at a time.

**Status legend:** ✅ done · 🚧 in progress · ⚠️ partial · ❌ pending

### Testing Infrastructure (Q1–Q4)

#### Q1 — Add a unit-test runner ❌

- **Where:** `package.json` (no `test` script, no vitest/jest in `devDependencies`)
- **Why:** The only test surface today is `tests/e2e/` (Playwright smoke). Service-layer math (FX, net-worth, price caching) has zero unit coverage. Cross-ref: R21, D4.
- **Proposed action:** Add `vitest` + `@vitest/ui`, wire `npm run test` and `npm run test:watch`, gate on it in `.github/workflows/ci.yml` alongside lint + typecheck. Place specs next to source as `*.test.ts` — do not introduce a `tests/unit/` tree that competes with `tests/e2e/`.
- **Effort:** Medium (~1 hr setup, then ongoing per-service work in Q2–Q4).

#### Q2 — Unit tests for `src/lib/services/net-worth-service.ts` ❌

- **Where:** the two-pass FX algorithm — collect-then-resolve missing pairs.
- **Why:** Every dashboard number flows through this. A regression here corrupts every snapshot. No automated guardrail today.
- **Proposed action:** With a fake `rateMap`, cover: identity (USD→USD = 1), inverse fallback, missing-pair resolution path, and the boundary where `resolveMissingRates` defaults to `1` after timeout.
- **Effort:** Medium.

#### Q3 — Unit tests for `resolveRate` and `getAllExchangeRates` ❌

- **Where:** `src/lib/services/exchange-rate-service.ts:31` (`getAllExchangeRates`), `:40` (`resolveRate`).
- **Why:** `resolveRate` is pure and exhaustively branch-testable; it is called from net-worth, history, and analysis services so a bug fans out.
- **Proposed action:** Pure-function unit tests (no Prisma mock needed for `resolveRate`). For `getAllExchangeRates` use a Prisma test double.
- **Effort:** Small.

#### Q4 — Unit tests for validators and balance helpers ❌

- **Where:** `src/lib/validators.ts` and `src/lib/balance.ts`.
- **Why:** Zod schemas in `validators.ts` mix `z.discriminatedUnion`, `.refine()` (OCC option-symbol regex on `:54`), and `.transform()` (uppercase symbol on `:32`). One typo silently widens what the API accepts.
- **Proposed action:** Snapshot-test the parsed shape of a known-good payload per schema; add a `should reject` case per refinement. `balance.ts` is pure — small targeted tests.
- **Effort:** Small.

---

### Observability & Logging (Q5–Q7)

#### Q5 — Replace `console.*` with a structured logger ❌

- **Where (verified file:line inventory):**
  - `src/app/api/cron/snapshot/route.ts:26,47,62,79`
  - `src/app/api/options/chain/route.ts:70,93`
  - `src/app/api/search/route.ts:88`
  - `src/app/api/settings/data/route.ts:41,52,161`
  - `src/lib/services/price-service.ts:100,106,167`
  - `src/lib/services/exchange-rate-service.ts:102,124,188,240`
- **Why:** Raw `console.error/warn/log` is unstructured, unfilterable, and lost on Vercel after ~1 hour of log retention. Cross-ref: R18.
- **Proposed action:** Introduce `src/lib/log.ts` exporting `logger.{info,warn,error}` with a JSON-line shape `{ level, msg, ctx, ts }`. Pino is the conventional choice. Ban raw `console.*` in `src/app/api/**` and `src/lib/services/**` via ESLint `no-console` override.
- **Effort:** Medium — mechanical replace, but worth doing in one PR to avoid mixed styles.

#### Q6 — Wire Sentry (or equivalent) ❌

- **Where:** No error-tracking SDK in `package.json`. Cross-ref: R17.
- **Why:** No signal when a production user hits an exception inside an API route or a `cacheComponents` boundary. Cron failures only surface in Vercel logs.
- **Proposed action:** Add `@sentry/nextjs` with a 10% trace sample rate, route exceptions from the structured logger in Q5, and filter PII (email, ID) at the `beforeSend` hook. Document `SENTRY_DSN` alongside existing env vars in `CLAUDE.md` and `.env.example`.
- **Effort:** Medium.

#### Q7 — Request-ID propagation through `withAuth` ❌

- **Where:** `src/lib/api-handler.ts:4` (`withAuth`).
- **Why:** Once Q5 lands, every log line in an API request handler should carry the same correlation ID so a user-reported bug can be traced across calls. Vercel injects `x-vercel-id` automatically — prefer that when present.
- **Proposed action:** Read `request.headers.get("x-request-id")` (or generate via `crypto.randomUUID()`), attach to a `context` object passed into the handler, and emit with every logger call.
- **Effort:** Small.

---

### Type Safety (Q8–Q10)

#### Q8 — Eliminate `any` in third-party adapters ❌

- **Where (verified):**
  - `src/app/api/options/chain/route.ts:22,46,64` — `yahoo-finance2` `options()` return is untyped, three suppressions.
  - `src/app/api/search/route.ts:64` — `yahooFinance.search()` result typed as `any`.
  - `src/app/api/settings/data/route.ts:114,130,145` — three `(t: any)` map callbacks inside the import handler.
  - `src/lib/auth-adapter.ts:7,12` — `AnyRecord` and `as any` cast on `linkAccount`.
- **Why:** Every `any` defeats `tsc --strict` locally and silently lets new fields slip through API responses.
- **Proposed action:**
  - For yahoo-finance: define narrow types in `src/lib/types/yahoo.ts` and cast once at the import boundary.
  - For `settings/data/route.ts`: reuse `z.infer<typeof dataImportSchema>` instead of `any`.
  - For `auth-adapter.ts`: type against `@auth/prisma-adapter`'s exported `Adapter` type.
- **Effort:** Medium.

#### Q9 — Replace `z.any()` in validators ✅

- **Fix applied:** Dropped `z.any()` from `decimalSchema` (now `z.union([z.number(), z.string()])`). Typed `breakdown` as `z.array(z.object({ accountId, value, currency })).optional().nullable()`. _(Done 2026-05-08)_

#### Q10 — Enable `noUncheckedIndexedAccess` ❌

- **Where:** `tsconfig.json:7` (`"strict": true` is on; `noUncheckedIndexedAccess` is not).
- **Why:** Several spots index into maps/objects without a defined-check (e.g. `src/lib/services/exchange-rate-service.ts:225` — `rates[to]` after a presence check). Catching these prevents the next subtle FX-rate bug.
- **Proposed action:** Flip the flag locally, run `tsc --noEmit`, count resulting errors. If under ~50, fix and ship. If far higher, scope to `src/lib/**` first.
- **Effort:** Medium (depends on churn).

---

### API Validation Gaps (Q11–Q13)

#### Q11 — Validate pagination params on the transactions route ✅

- **Where:** `src/app/api/accounts/[id]/transactions/route.ts`.
- **Fix applied:** Added `paginationQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })`. Returns `validationError(...)` on failure. _(Done 2026-05-08)_

#### Q12 — Rate-limit and auth-gate the manual exchange-rates refresh ✅

- **Where:** `src/app/api/exchange-rates/refresh/route.ts`.
- **Fix applied:** Wrapped with `withAuth(...)`, added `rateLimitCheckWithPrune(request, { limit: 5, prefix: "exchange-rates-refresh" })`, and scoped `setting.findFirst` + `account.findMany` to the authenticated `userId`. _(Done 2026-05-08)_

#### Q13 — Audit other handlers for unwrapped `Number(...)` and untyped `params` ❌

- **Where:** Survey across `src/app/api/**/route.ts`.
- **Why:** Q11 is one instance; the same pattern likely exists in other paginated endpoints.
- **Proposed action:** Grep for `Number(searchParams.get` and `request.json()` calls not immediately followed by a `safeParse(...)`. Triage results into per-route fixes that mirror Q11.
- **Effort:** Small (audit) + Medium (per-route fixes).

---

### Dev Tooling (Q14–Q17)

#### Q14 — Add Prettier ⚠️

- **Where:** `.prettierrc.json` exists and `prettier` is in `devDependencies` — config and dep are done. Missing: no `format` / `format:check` scripts in `package.json`, no `eslint-config-prettier`, and no `format:check` step in `.github/workflows/ci.yml`. _(Audited 2026-05-08)_
- **Why:** Without the CI gate, the formatter has no teeth — PRs can still land with divergent whitespace.
- **Proposed action:** Add `"format": "prettier --write ."` and `"format:check": "prettier --check ."` to `package.json`; add `eslint-config-prettier` to turn off conflicting ESLint rules; add `format:check` as a CI step in `.github/workflows/ci.yml`.
- **Effort:** Trivial (config is already done; just wire the scripts and CI step).

#### Q15 — Husky + lint-staged for pre-commit ❌

- **Where:** No `.husky/`, no `lint-staged` config in `package.json`.
- **Why:** CI catches lint failures eventually; pre-commit catches them in <2 s. Especially valuable once Q14 (Prettier) lands.
- **Proposed action:** `husky init`, then add a `pre-commit` hook running `npx lint-staged`. Configure lint-staged to run `eslint --fix` + `prettier --write` on staged `*.{ts,tsx,js,mjs}`. Keep it fast — no typecheck or tests at pre-commit.
- **Effort:** Small.

#### Q16 — Add a `typecheck` script ✅

- **Fix applied:** Added `"typecheck": "tsc --noEmit"` to `package.json`. Updated `.github/workflows/ci.yml` to call `npm run typecheck`. _(Done 2026-05-08)_

#### Q17 — Dependabot or Renovate ❌

- **Where:** No `.github/dependabot.yml` or `renovate.json`.
- **Why:** Next.js 16, React 19, Prisma 7, NextAuth v5-beta — every one of these is on a fast cadence. Manual `npm outdated` reviews are easy to skip.
- **Proposed action:** Add `.github/dependabot.yml` with weekly grouped PRs (one for prod deps, one for dev deps, one for GitHub Actions).
- **Effort:** Small.

---

### Inline Documentation (Q18–Q20)

#### Q18 — JSDoc public exports in `src/lib/currencies.ts` ❌

- **Where:** `formatCurrency`, `formatNumber`, `formatQuantity`, `getCurrencySymbol`, `getLocaleDefaultCurrency`.
- **Why:** These are called from RSC, client components, and services alike. Behaviour is locale-sensitive (e.g. `getLocaleDefaultCurrency("zh-TW") → "TWD"`) and is the kind of edge a one-line JSDoc protects.
- **Proposed action:** One-line JSDoc per export with the contract — input shape, output shape, and the locale fallback rule.
- **Effort:** Small.

#### Q19 — JSDoc analysis-service helpers ❌

- **Where:** `src/lib/services/analysis-service.ts` — `aggregateMonthlyChange`, `computeKpis`.
- **Why:** The roadmap directs future work to compose on top of these helpers; they need explicit contracts to be reused safely.
- **Proposed action:** Add JSDoc describing inputs, the time-bucket convention (calendar month vs trailing 30d), and the currency-normalization assumption.
- **Effort:** Small.

#### Q20 — JSDoc small-but-public utilities ❌

- **Where:** `src/lib/undo-delete.ts`, `src/lib/haptics.ts`, `src/lib/options.ts`.
- **Why:** All three were added during the recent UX push and are imported from multiple components.
- **Proposed action:** One-liner per exported function; emphasize side effects (haptics writes to `navigator.vibrate`; undo-delete owns a window-level pending-deletion registry).
- **Effort:** Small.

---

### Priority Cuts

**Quick wins (≤30 min each):** Q11, Q12, Q14, Q16, Q17, Q18, Q19, Q20.
**Medium:** Q1, Q5, Q9, Q15, Q3, Q4.
**Larger:** Q2, Q6, Q7, Q8, Q10, Q13.

A reasonable first PR sequence: Q14 → Q16 → Q11 → Q12 → Q9. That delivers a formatter, a typecheck script, two API-validation fixes, and tighter validators in five small reviewable PRs before any test-infrastructure work.

---

## Critical Documentation Gaps (C1–C14)

Cross-doc audit performed on **2026-05-05**. Each existing doc is strong inside its lane (perf, bundles, features, UX). The gaps below are **cross-cutting concerns** — they exist as scattered ❌ items inside the backlog docs, but no doc owns them end-to-end.

| #   | Missing Doc / Topic                                 | Risk if launched without it                                                                                              | Impact  | Effort  | Status      |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------- | ----------- |
| C1  | `docs/SECURITY.md` — security posture               | Ownership-bypass, secret leakage, no rotation policy, no audit log                                                       | 🔴 High | 1 day   | ❌ Not Done |
| C2  | `docs/OBSERVABILITY.md` — Sentry + logging          | Zero error context post-launch; cron failures invisible                                                                  | 🔴 High | 1 day   | ❌ Not Done |
| C3  | `docs/TESTING.md` — testing strategy                | Net-worth / FX / P&L math has zero unit tests                                                                            | 🔴 High | 1 day   | ❌ Not Done |
| C4  | `docs/DISASTER_RECOVERY.md` — Neon + export         | No restore runbook; user data export not specified for GDPR                                                              | 🔴 High | 0.5 day | ❌ Not Done |
| C5  | `CONTRIBUTING.md` — onboarding guide                | New contributors lack code-style / commit / PR / test expectations                                                       | 🟡 Med  | 0.5 day | ❌ Not Done |
| C6  | `docs/API_REFERENCE.md` — route contract            | No formal request/response schema; integrations (Plaid R23) blocked                                                      | 🟡 Med  | 1 day   | ❌ Not Done |
| C7  | `docs/A11Y.md` — accessibility baseline             | Scattered across SUGGESTIONS #43/44/48/57/70 + UI_UX #13; no checklist                                                   | 🟡 Med  | 0.5 day | ❌ Not Done |
| C8  | `docs/DATA_MODEL.md` — ERD + invariants             | Decimal/serialization rules + lossless conversion only in code                                                           | 🟡 Med  | 0.5 day | ❌ Not Done |
| C9  | `CLAUDE.md` index missing `UI_UX.md`                | Doc is orphaned from the canonical index (was `UI_UX_SUGGESTIONS.md`)                                                    | 🟢 Low  | 5 min   | ❌ Not Done |
| C10 | `docs/FEATURES.md` — recently shipped UX surfaces   | Privacy mode, command palette, swipe actions, pull-to-refresh, view transitions ship without canonical reference         | 🟡 Med  | 0.5 day | ❌ Not Done |
| C11 | `docs/KEYBOARD_SHORTCUTS.md` — power-user reference | ⌘K, ⌘B, ⌘⇧Y (privacy), ⌘⇧R (refresh) etc. only discoverable via git log                                                  | 🟢 Low  | 1 hr    | ❌ Not Done |
| C12 | `docs/CI_CD.md` — pipeline runbook                  | `.github/workflows/ci.yml` exists but no doc on required checks, preview gates, branch protection, local repro           | 🟡 Med  | 0.5 day | ❌ Not Done |
| C13 | `docs/PERFORMANCE_BUDGETS.md` — numeric targets     | LCP/INP/CLS targets and bundle KB ceilings live in prose across 3 docs; nothing CI-enforceable                           | 🟡 Med  | 0.5 day | ❌ Not Done |
| C14 | `docs/NEON_OPERATIONS.md` — pooler + migrations     | Pooled `DATABASE_URL` vs `DIRECT_URL`, region pinning (`sin1`), `migrate dev` vs `db push` etiquette only in LOG entries | 🟡 Med  | 0.5 day | ❌ Not Done |

### Gap Write-ups

**C1 — `docs/SECURITY.md` (CRITICAL).** Security items are spread thinly. What's missing: threat model for a personal-finance SaaS (IDOR, secret leak, supply chain); secrets rotation runbook (`AUTH_SECRET`, `CRON_SECRET`, `AUTH_GOOGLE_*`, `DATABASE_URL`); ownership-check pattern with a canonical helper signature; CSRF posture for mutating routes (NextAuth v5 + RSC actions); dependency vulnerability scanning; audit-logging plan; webhook signature verification template. **Why now**: R5 (ownership) is the single highest-risk correctness bug — no security doc means the fix isn't generalized. Closing C1 also closes/advances: R5, R6, R8, V3, V7, V11, D1.

**C2 — `docs/OBSERVABILITY.md` (CRITICAL).** R17 (Sentry), R18 (pino), R19 (on-call playbook), V12 (structured logging), D10 (observability baseline) are all ❌ Not Done and live in different docs. What's missing: Sentry SDK setup for Next.js 16 RSC + Edge middleware; pino logger config (request id, user id redaction, JSON shape); Vercel log search queries for 5xx spikes and cron failures; `/api/health` contract; alert routing (Sentry → Slack/email); bundle-size baseline tracking. Closing C2 also closes/advances: R17, R18, R19, V12, D10.

**C3 — `docs/TESTING.md` (CRITICAL).** Only Playwright E2E exists. What's missing: testing pyramid (unit/integration/E2E); Vitest config + first-test scaffold; service-layer test patterns for `net-worth-service.ts` (two-pass algorithm), `exchange-rate-service.ts` (`resolveRate`), `history-service.ts` (lossless re-normalization), `balance.ts`; API auth/ownership contract tests; fixtures / factories for all models; CI wiring. Closing C3 also closes/advances: D4, SUGGESTIONS #26.

**C4 — `docs/DISASTER_RECOVERY.md` (CRITICAL).** R16 ("Document Neon backup SLA") is ❌ Not Done. What's missing: Neon PITR window (default 7d) and upgrade path; restore runbook (branch from PITR → smoke test → cutover); per-user data export endpoint (also blocks GDPR / R12); per-user data deletion including cascade rules; migration rollback strategy; snapshot integrity checking. Closing C4 also closes/advances: R16, R12.

**C5 — `CONTRIBUTING.md`.** `.github/PULL_REQUEST_TEMPLATE.md` exists but no `CONTRIBUTING.md`. What's missing: local-dev bootstrap (Neon branch creation, seeding, `.env` template); code style + commit message format; PR review checklist (tests added, docs updated, migration committed, no `db push` drift); "when to update which doc".

**C6 — `docs/API_REFERENCE.md`.** Route layout is in `CLAUDE.md` but no formal request/response schema. What's missing: one row per route (method, path, auth requirement, Zod schema link, response shape, rate-limit class); optional OpenAPI generation from Zod (`zod-to-openapi`) — preconditions Plaid integration (R23).

**C7 — `docs/A11Y.md`.** A11y items are scattered. What's missing: WCAG 2.1 AA target; component-level checklist (form labels, focus rings, keyboard traps in dialogs/sheets, non-color status cues); testing approach (axe-core in Playwright, manual VoiceOver/NVDA passes); charts a11y plan (Recharts: aria descriptions + tabular fallback). Closing C7 also closes/advances: D6, SUGGESTIONS #43/44/48/57/70, UI_UX #13.

**C8 — `docs/DATA_MODEL.md`.** What's missing: ERD diagram (Mermaid); invariants (every monetary value is `Decimal`, every cross-currency value computed lazily, every snapshot is lossless via `breakdown`); serialization contract and why spreading Prisma instances is forbidden; migration etiquette.

**C9 — Update `CLAUDE.md` index.** `CLAUDE.md`'s "Long-form analysis docs" section needs to be updated to reference the consolidated files (this doc and the others in the new structure).

**C10 — `docs/FEATURES.md`.** Recently shipped features have zero canonical doc: privacy mode, command palette, swipe actions, pull-to-refresh, View Transitions API, inline validation. What's missing: one-row-per-feature reference (what it does, how to invoke, persistence surface, accessibility considerations, desktop fallback). Specifically: privacy mode masking semantics; swipe actions one-row-at-a-time registry pattern; view transitions `transitionTypes` map.

**C11 — `docs/KEYBOARD_SHORTCUTS.md`.** Recent commits added shortcuts that only the author knows: `⌘K` (palette), `⌘B` (sidebar collapse), `⌘⇧Y` (privacy mode), `⌘⇧R` (price refresh). What's missing: printable cheat-sheet table (action → Mac → Win/Linux → scope); discoverability (where the in-app `?` help should live); "how to add a new palette action"; conflict policy (why `⌘⇧P` was abandoned). Closing C11 also closes/advances: R22 (in-app help).

**C12 — `docs/CI_CD.md`.** `R20` is ✅ Done — `.github/workflows/ci.yml` runs. No doc owns: required-check list, branch-protection rules, preview-deploy gates, how Vercel's `build:vercel` interacts with Neon previews, or how to reproduce a CI failure locally. Closing C12 also closes/advances: R20, R21 (E2E in CI).

**C13 — `docs/PERFORMANCE_BUDGETS.md`.** Numbers are scattered across PERFORMANCE.md prose. What's missing: concrete ceilings (LCP ≤ 2.5s p75 mobile, INP ≤ 200ms p75, CLS ≤ 0.10, client-route JS ≤ 150 KB gzip); enforcement plan (bundle-size assertion in CI via `size-limit`, Vercel Speed Insights threshold alerts); process for raising a budget. Closing C13 also closes/advances: V23, V24, bundle baseline tracking.

**C14 — `docs/NEON_OPERATIONS.md`.** `LOG.md` 2026-04-26 introduces the `DIRECT_URL` vs pooled `DATABASE_URL` split. No doc unifies the day-2 Neon story. What's missing: pooled vs direct connection (which env var goes where, what breaks when swapped); region pinning rationale (`sin1`); cold-start expectations; migration etiquette (`migrate dev` vs `db push`); Neon branch strategy (production / preview / per-PR); pooler saturation symptoms and runbook. Closing C14 also closes/advances: V5, the LOG.md 2026-04-26 `DIRECT_URL` note.

### Recommended Sequencing

**Week 1 — Pre-launch hardening sprint:**

1. **Day 1** — C1 `SECURITY.md` (also unblocks D1 ownership rollout).
2. **Day 2** — C3 `TESTING.md` + first Vitest run (unblocks C1's auth/ownership contract tests).
3. **Day 3** — C2 `OBSERVABILITY.md` (Sentry + pino + `/api/health`, closes R17/R18/R19/D10).
4. **Day 4** — C4 `DISASTER_RECOVERY.md` (closes R16, unblocks GDPR R12).
5. **Day 5** — C5–C9 in parallel; update CLAUDE.md index first (5 min).

**Week 2 — Developer ergonomics sprint:** 6. **Day 6** — C12 `CI_CD.md` + C14 `NEON_OPERATIONS.md`. 7. **Day 7** — C13 `PERFORMANCE_BUDGETS.md` (depends on C2 observability for measurement). 8. **Day 8** — C10 `FEATURES.md` + C11 `KEYBOARD_SHORTCUTS.md`.

---

## Cross-Doc Synthesis / Delivery Plan (D1–D10)

Execution-oriented backlog with dependency-aware ordering. Review date: **2026-04-20**.

| #   | Suggestion                                                                                            | Category               | Impact    | Effort      | Status      |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------- | --------- | ----------- | ----------- |
| D1  | Enforce auth + ownership checks on all sensitive API routes                                           | Security               | 🔴 High   | 1-2 hrs     | ❌ Not Done |
| D2  | Harden cron path (`CRON_SECRET` guard, timing-safe compare, controlled fan-out concurrency)           | Security / Reliability | 🔴 High   | 1-2 hrs     | ❌ Not Done |
| D3  | Add startup environment validation (`src/lib/env.ts`)                                                 | Reliability / DX       | 🔴 High   | 1 hr        | ✅ Done     |
| D4  | Add baseline tests (service-layer + API auth checks + 1 E2E smoke)                                    | Testing                | 🔴 High   | 1-2 days    | ❌ Not Done |
| D5  | Complete caching hygiene (`Cache-Control`, `revalidateTag` coverage audit)                            | Performance            | 🟡 Medium | 1-2 hrs     | ❌ Not Done |
| D6  | Finish accessibility quick wins (`aria-label`, keyboard semantics, non-color cues)                    | Accessibility          | 🔴 High   | 2-3 hrs     | ❌ Not Done |
| D7  | Close hot-path performance items (cursor pagination, `/api/search` TTL cache, symbol dedupe/chunking) | Performance            | 🔴 High   | 2-4 hrs     | ❌ Not Done |
| D8  | Build Analysis Phase 2.1 — cash flow decomposition                                                    | Feature                | 🔴 High   | 1-2 sprints | ❌ Not Done |
| D9  | Build Analysis Phase 2.2 — category trend from snapshot `breakdown`                                   | Feature                | 🟡 Medium | 1 sprint    | ❌ Not Done |
| D10 | Establish observability baseline (`/api/health`, structured logging, bundle baseline tracking)        | Observability          | 🟡 Medium | 2-4 hrs     | ❌ Not Done |

**D1** — Ensure every sensitive read/mutation route validates session + resource ownership in-handler, returning `401` / `403` deterministically. Highest risk class; should precede additional product work.

**D2** — Harden cron snapshot endpoint: fail fast when `CRON_SECRET` is missing, use timing-safe comparison, batch/chunk user fan-out to avoid uncontrolled burst load.

**D3** — Centralize env parsing/validation in `src/lib/env.ts`. ✅ Done.

**D4** — Establish minimum viable coverage: (1) unit tests for service-layer financial math, (2) API integration tests focused on auth/ownership and input validation, (3) one E2E smoke path covering login → account/holding flow.

**D5** — Add `Cache-Control` on read-only APIs; audit and standardize `revalidateTag(...)` after mutations. Reduces stale-data edge cases while improving TTFB/cache-hit ratio.

**D6** — Add `aria-label` on icon-only controls; add keyboard + semantic sort support (`aria-sort`) for sortable tables; add non-color differentiation for key chart series and states.

**D7** — Close hot-path performance items: cursor/keyset pagination for transactions; short-lived cache for `/api/search` lookups; dedupe/chunk symbol batches in price refresh paths; scope exchange-rate refresh to current user context.

**D8** — Analysis Phase 2.1 cash-flow decomposition. See UI_UX.md Phase 2.1 for full spec.

**D9** — Analysis Phase 2.2 category trend. See UI_UX.md Phase 2.2 for full spec.

**D10** — Observability minimum bar: add `/api/health` readiness endpoint; replace ad-hoc `console` logging with structured logging; maintain bundle/perf baseline checks as part of release workflow.

### Suggested Delivery Plan

**Sprint A — Stability & Security:** D1, D2, D3, D4

**Sprint B — Performance & Accessibility:** D5, D6, D7

**Sprint C — Product & Observability:** D8, D9, D10

### Optional Quick Wins (same day)

- Add `Cache-Control` to remaining read-only APIs.
- Add `/api/health` endpoint.
- Add `aria-label` on icon-only controls.
- Add missing `CRON_SECRET` misconfiguration guard.
- Add short TTL cache for `/api/search`.
