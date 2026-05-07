# Assets Tracker — Code Quality Suggestions

**Baseline:** 2026-05-07 · **Items:** 20 (Q1–Q20) · **Status:** ❌ all pending

This doc consolidates engineering-hygiene gaps found by walking the codebase against the existing docs in this folder. Items are concrete and file-cited so they can be picked up one at a time.

## Context

The existing `docs/` set covers feature work (`SUGGESTIONS.md`, `UI_UX_SUGGESTIONS.md`, `ANALYSIS_ROADMAP.md`), performance (`VERCEL_ANALYSIS.md`, `BUNDLE_ANALYSIS.md`, `RENDERING_ANALYSIS.md`), launch readiness (`RELEASE_READINESS.md`), cross-doc execution (`DOCS_REVIEW_SUGGESTIONS.md`), and missing-doc tracking (`CRITICAL_GAPS.md`). What is **not** centrally tracked is engineering-hygiene plumbing — unit testing infrastructure, structured logging, type-safety holes, validation gaps in API handlers, and dev-loop tooling. A few of these surface as scattered checklist items (`R17`, `R18`, `R21`, `D4`) but no doc captures them with file:line evidence and a concrete next step. This doc fills that lane.

**Out of scope** (covered elsewhere — do not duplicate here):

- Feature work and product backlog → `SUGGESTIONS.md`
- Bundle / rendering / Vercel-runtime perf → `VERCEL_ANALYSIS.md`, `BUNDLE_ANALYSIS.md`, `RENDERING_ANALYSIS.md`
- Pre-launch security/legal/SLO checklist → `RELEASE_READINESS.md`
- Missing top-level docs (SECURITY.md, OBSERVABILITY.md, TESTING.md) → `CRITICAL_GAPS.md`

## Status Legend

✅ done · 🚧 in progress · ⚠️ partial · ❌ pending

---

## Testing Infrastructure (Q1–Q4)

### Q1 — Add a unit-test runner ❌

- **Where:** `package.json` (no `test` script, no vitest/jest in `devDependencies`)
- **Why:** The only test surface today is `tests/e2e/` (Playwright smoke). Service-layer math (FX, net-worth, price caching) has zero unit coverage. Cross-ref: `RELEASE_READINESS.md` R21, `DOCS_REVIEW_SUGGESTIONS.md` D4.
- **Proposed action:** Add `vitest` + `@vitest/ui`, wire `npm run test` and `npm run test:watch`, gate on it in `.github/workflows/ci.yml` alongside lint + typecheck. Place specs next to source as `*.test.ts` (matches Next.js conventions) — do not introduce a `tests/unit/` tree that competes with `tests/e2e/`.
- **Effort:** Medium (~1 hr setup, then ongoing per-service work in Q2–Q4).

### Q2 — Unit tests for `src/lib/services/net-worth-service.ts` ❌

- **Where:** the two-pass FX algorithm referenced in `CLAUDE.md` (collect-then-resolve missing pairs).
- **Why:** This is the most consequential math in the app — every dashboard number flows through it. A regression here corrupts every snapshot. Today there is no automated guardrail.
- **Proposed action:** With a fake `rateMap`, cover: identity (USD→USD = 1), inverse fallback, missing-pair resolution path, and the boundary where `resolveMissingRates` defaults to `1` after timeout (`src/lib/services/exchange-rate-service.ts:240`).
- **Effort:** Medium.

### Q3 — Unit tests for `resolveRate` and `getAllExchangeRates` ❌

- **Where:** `src/lib/services/exchange-rate-service.ts:31` (`getAllExchangeRates`), `:40` (`resolveRate`).
- **Why:** The `resolveRate` helper is pure and exhaustively branch-testable; it is called from net-worth, history, and analysis services so a bug fans out.
- **Proposed action:** Pure-function unit tests (no Prisma mock needed for `resolveRate`). For `getAllExchangeRates` use a Prisma test double — see Q1 setup.
- **Effort:** Small.

### Q4 — Unit tests for validators and balance helpers ❌

- **Where:** `src/lib/validators.ts` and `src/lib/balance.ts`.
- **Why:** Zod schemas in `validators.ts` mix `z.discriminatedUnion`, `.refine()` (OCC option-symbol regex on `:54`), and `.transform()` (uppercase symbol on `:32`). One typo silently widens what the API accepts.
- **Proposed action:** Snapshot-test the parsed shape of a known-good payload per schema; add a `should reject` case per refinement. `balance.ts` is pure — small targeted tests.
- **Effort:** Small.

---

## Observability & Logging (Q5–Q7)

### Q5 — Replace `console.*` with a structured logger ❌

- **Where (verified file:line inventory):**
  - `src/app/api/cron/snapshot/route.ts:26,47,62,79`
  - `src/app/api/options/chain/route.ts:70,93`
  - `src/app/api/search/route.ts:88`
  - `src/app/api/settings/data/route.ts:41,52,161`
  - `src/lib/services/price-service.ts:100,106,167`
  - `src/lib/services/exchange-rate-service.ts:102,124,188,240`
- **Why:** Raw `console.error/warn/log` is unstructured, unfilterable, and lost on Vercel after ~1 hour of log retention. Cross-ref: `RELEASE_READINESS.md` R18.
- **Proposed action:** Introduce `src/lib/log.ts` exporting `logger.{info,warn,error}` with a JSON-line shape `{ level, msg, ctx, ts }`. Pino is the conventional choice; a thin `console.*` wrapper is fine to start. Ban raw `console.*` in `src/app/api/**` and `src/lib/services/**` via an ESLint `no-console` override.
- **Effort:** Medium — mechanical replace, but worth doing in one PR to avoid mixed styles.

### Q6 — Wire Sentry (or equivalent) ❌

- **Where:** No error-tracking SDK in `package.json`. Cross-ref: `RELEASE_READINESS.md` R17.
- **Why:** Today there is no signal when a production user hits an exception inside an API route or a `cacheComponents` boundary. Cron failures (`src/app/api/cron/snapshot/route.ts:79`) only surface in Vercel logs.
- **Proposed action:** Add `@sentry/nextjs` with a 10% trace sample rate, route exceptions from the structured logger in Q5, and filter PII (email, ID) at the `beforeSend` hook. Document `SENTRY_DSN` alongside the existing env vars in `CLAUDE.md` and `.env.example`.
- **Effort:** Medium.

### Q7 — Request-ID propagation through `withAuth` ❌

- **Where:** `src/lib/api-handler.ts:4` (`withAuth`).
- **Why:** Once Q5 lands, every log line in an API request handler should carry the same correlation ID so a user-reported bug can be traced across `console.error` calls inside the request, the cron job, and Sentry. `withAuth` is the only wrapper we ship — it is the natural seam.
- **Proposed action:** Read `request.headers.get("x-request-id")` (or generate via `crypto.randomUUID()`), attach to a `context` object passed into the handler, and emit with every logger call. Vercel injects `x-vercel-id` automatically — prefer that when present.
- **Effort:** Small.

---

## Type Safety (Q8–Q10)

### Q8 — Eliminate `any` in third-party adapters ❌

- **Where (verified):**
  - `src/app/api/options/chain/route.ts:22,46,64` — `yahoo-finance2` `options()` return is untyped, three suppressions in one file.
  - `src/app/api/search/route.ts:64` — `yahooFinance.search()` result typed as `any`.
  - `src/app/api/settings/data/route.ts:114,130,145` — three `(t: any)` map callbacks inside the import handler.
  - `src/lib/auth-adapter.ts:7,12` — `AnyRecord` and `as any` cast on `linkAccount`.
- **Why:** Every `any` defeats `tsc --strict` locally and silently lets new fields slip through API responses. The yahoo-finance ones are the most defensible (upstream gap), but they should be quarantined into typed wrappers, not sprinkled at call sites.
- **Proposed action:**
  - For yahoo-finance: define narrow types in `src/lib/types/yahoo.ts` and cast once at the import boundary; the rest of the file consumes typed values.
  - For `settings/data/route.ts`: the imported transactions are already validated by `dataImportSchema` (`src/lib/validators.ts:106`) — reuse `z.infer<typeof dataImportSchema>` instead of `any`.
  - For `auth-adapter.ts`: type against `@auth/prisma-adapter`'s exported `Adapter` type rather than re-declaring `AnyRecord`.
- **Effort:** Medium.

### Q9 — Replace `z.any()` in validators ❌

- **Where:** `src/lib/validators.ts:104` (`decimalSchema = z.union([z.number(), z.string(), z.any()])`) and `:149` (`breakdown: z.any().optional().nullable()`).
- **Why:** `z.any()` opts out of validation entirely — a malformed import payload reaches Prisma untouched. `breakdown` has a known shape (per-account snapshot), and `decimal` is always number-or-string.
- **Proposed action:**
  - `decimalSchema`: drop `z.any()`, keep `z.union([z.number(), z.string()])` (Decimal is serialized as string in JSON exports).
  - `breakdown`: model the snapshot breakdown explicitly (`z.array(z.object({ accountId, value, currency, ... }))`) — the shape is already documented by `snapshot-service.ts`.
- **Effort:** Small.

### Q10 — Enable `noUncheckedIndexedAccess` ❌

- **Where:** `tsconfig.json:7` (`"strict": true` is on; `noUncheckedIndexedAccess` is not).
- **Why:** Several spots index into maps/objects without a defined-check (e.g. `src/lib/services/exchange-rate-service.ts:225` — `rates[to]` after a presence check, but the type system does not track that). Catching these prevents the next subtle FX-rate bug.
- **Proposed action:** Flip the flag locally, run `tsc --noEmit`, count the resulting errors. If under ~50, fix and ship. If far higher, scope to `src/lib/**` first via `// @ts-expect-error` codemod and roll out per-directory.
- **Effort:** Medium (depends on churn).

---

## API Validation Gaps (Q11–Q13)

### Q11 — Validate pagination params on the transactions route ❌

- **Where:** `src/app/api/accounts/[id]/transactions/route.ts:21-22`.
- **Why:** `Number(searchParams.get("page") || "1")` returns `NaN` when the caller passes `?page=foo`. `Math.max(1, NaN) === NaN`, which then flows into the raw SQL `LIMIT ${limit} OFFSET ${offset}` on `:38-39` — the query fails with a runtime error instead of a 400.
- **Proposed action:** Add a Zod schema `paginationQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })` and parse `searchParams` through it. Return `validationError(...)` on failure (the helper already exists in `src/lib/api-responses.ts`).
- **Effort:** Small.

### Q12 — Rate-limit and auth-gate the manual exchange-rates refresh ❌

- **Where:** `src/app/api/exchange-rates/refresh/route.ts:6` (POST handler).
- **Why:** This route triggers external API calls to `frankfurter.app` and `open.er-api.com`. The sibling GET route already uses `rateLimitCheckWithPrune` (`src/app/api/exchange-rates/route.ts:6`); the POST does not, even though it is the more expensive operation. It also does not invoke `withAuth` (`src/lib/api-handler.ts:4`) — relying on the global middleware allowlist is correct today, but explicit `withAuth` makes the auth contract local and survives middleware refactors.
- **Proposed action:** Wrap the handler with `withAuth(...)` and add `rateLimitCheckWithPrune(request, { limit: 5, prefix: "exchange-rates-refresh" })` at the top.
- **Effort:** Small.

### Q13 — Audit other handlers for unwrapped `Number(...)` and untyped `params` ❌

- **Where:** Survey across `src/app/api/**/route.ts`.
- **Why:** Q11 is one instance; the same pattern likely exists in other paginated endpoints and any `searchParams.get` site.
- **Proposed action:** Grep for `Number(searchParams.get` and `request.json()` calls that are not immediately followed by a `safeParse(...)`. Triage results into per-route fixes that mirror Q11.
- **Effort:** Small (audit) + Medium (per-route fixes).

---

## Dev Tooling (Q14–Q17)

### Q14 — Add Prettier ❌

- **Where:** No `.prettierrc` and no `prettier` dep. ESLint config (`eslint.config.mjs`) does not delegate formatting.
- **Why:** Without an authoritative formatter, every refactor PR has noisy whitespace deltas that obscure intent. `eslint --fix` is not a substitute (it does not normalize quote style or trailing commas reliably).
- **Proposed action:** Add `prettier` + `eslint-config-prettier` (turns off rules that conflict), commit a `.prettierrc` with the team's existing style (2-space, double quotes, semicolons — match what is already in repo), and add `npm run format` / `npm run format:check`. Add `format:check` to CI alongside lint.
- **Effort:** Small.

### Q15 — Husky + lint-staged for pre-commit ❌

- **Where:** No `.husky/`, no `lint-staged` config in `package.json`.
- **Why:** CI catches lint failures eventually; pre-commit catches them in <2 s and prevents the wasted CI minute. Especially valuable once Q14 (Prettier) lands.
- **Proposed action:** `husky init`, then add a `pre-commit` hook running `npx lint-staged`. Configure lint-staged to run `eslint --fix` + `prettier --write` on staged `*.{ts,tsx,js,mjs}`. Keep it fast — no typecheck or tests at pre-commit.
- **Effort:** Small.

### Q16 — Add a `typecheck` script ❌

- **Where:** `package.json:5-15` (no `typecheck` entry).
- **Why:** Today the only way to verify TS without a full Next.js build is `npx tsc --noEmit` from memory. A named script makes it the obvious local guardrail and lets CI run typecheck without the full build's bundling cost.
- **Proposed action:** Add `"typecheck": "tsc --noEmit"`. Update `.github/workflows/ci.yml` to call it as a separate step (faster failure than `next build`).
- **Effort:** Trivial.

### Q17 — Dependabot or Renovate ❌

- **Where:** No `.github/dependabot.yml` or `renovate.json`.
- **Why:** Next.js 16, React 19, Prisma 7, NextAuth v5-beta — every one of these is on a fast cadence. Manual `npm outdated` reviews are easy to skip and security-relevant patches lag.
- **Proposed action:** Add `.github/dependabot.yml` with weekly grouped PRs (one for prod deps, one for dev deps, one for GitHub Actions). Group breaking-major bumps separately so they require explicit review.
- **Effort:** Small.

---

## Inline Documentation (Q18–Q20)

### Q18 — JSDoc public exports in `src/lib/currencies.ts` ❌

- **Where:** `src/lib/currencies.ts` — `formatCurrency`, `formatNumber`, `formatQuantity`, `getCurrencySymbol`, `getLocaleDefaultCurrency`.
- **Why:** These are called from RSC, client components, and services alike. Behaviour is locale-sensitive (e.g. `getLocaleDefaultCurrency("zh-TW") → "TWD"`) and is the kind of edge a one-line JSDoc protects.
- **Proposed action:** One-line JSDoc per export with the contract — input shape, output shape, and the locale fallback rule. Match the style already used in `src/lib/services/exchange-rate-service.ts:5,8,25,36,...`.
- **Effort:** Small.

### Q19 — JSDoc analysis-service helpers ❌

- **Where:** `src/lib/services/analysis-service.ts` — `aggregateMonthlyChange`, `computeKpis`. Cross-ref: `ANALYSIS_ROADMAP.md` Phase 2 explicitly calls these out as reusable.
- **Why:** The roadmap directs future work to compose on top of these helpers; they need explicit contracts to be reused safely.
- **Proposed action:** Add JSDoc to each describing inputs, the time-bucket convention (calendar month vs trailing 30d), and the currency-normalization assumption.
- **Effort:** Small.

### Q20 — JSDoc small-but-public utilities ❌

- **Where:** `src/lib/undo-delete.ts`, `src/lib/haptics.ts`, `src/lib/options.ts`.
- **Why:** All three were added during the recent UX push (`UI_UX_SUGGESTIONS.md`, `LOG.md` 2026-05-02..06) and are imported from multiple components. They are short enough that a single JSDoc line per export suffices.
- **Proposed action:** One-liner per exported function; emphasize side effects (haptics writes to `navigator.vibrate`; undo-delete owns a window-level pending-deletion registry).
- **Effort:** Small.

---

## Priority Cuts

**Quick wins (≤30 min each):** Q11, Q12, Q14, Q16, Q17, Q18, Q19, Q20.
**Medium:** Q1, Q5, Q9, Q15, Q3, Q4.
**Larger:** Q2, Q6, Q7, Q8, Q10, Q13.

A reasonable first PR sequence: Q14 → Q16 → Q11 → Q12 → Q9. That delivers a formatter, a typecheck script, two API-validation fixes, and tighter validators in five small reviewable PRs before any test-infrastructure work.

## Cross-References

- Sentry / error tracking → `RELEASE_READINESS.md` R17
- Structured logging → `RELEASE_READINESS.md` R18
- Test infrastructure → `RELEASE_READINESS.md` R21, `DOCS_REVIEW_SUGGESTIONS.md` D4
- Missing `TESTING.md` / `OBSERVABILITY.md` / `SECURITY.md` → `CRITICAL_GAPS.md`
