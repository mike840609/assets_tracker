# Assets Tracker — Critical Documentation Gaps

## Overview

This document catalogs **critical topics not covered (or under-covered) by the existing docs** in `docs/`. It is the result of a cross-doc audit performed on **2026-05-05** (first pass C1–C9, second pass C10–C14 same day) against:

- `docs/ANALYSIS_ROADMAP.md`
- `docs/BUNDLE_ANALYSIS.md`
- `docs/DOCS_REVIEW_SUGGESTIONS.md`
- `docs/LOG.md`
- `docs/RELEASE_READINESS.md`
- `docs/RENDERING_ANALYSIS.md`
- `docs/SUGGESTIONS.md`
- `docs/UI_UX_SUGGESTIONS.md`
- `docs/VERCEL_ANALYSIS.md`

Each existing doc is strong inside its lane (perf, bundles, features, UX). The gaps below are **cross-cutting concerns** — they exist as scattered ❌ items inside the backlog docs, but no doc owns them end-to-end. For a financial SaaS (Next.js 16 + Prisma + Neon + NextAuth, real money/portfolio data), shipping without these is the highest residual risk.

## Gap Summary

| #  | Missing Doc / Topic                        | Risk if launched without it                                          | Impact   | Effort     | Status      |
| -- | ------------------------------------------ | --------------------------------------------------------------------- | -------- | ---------- | ----------- |
| C1 | `docs/SECURITY.md` — security posture       | Ownership-bypass, secret leakage, no rotation policy, no audit log    | 🔴 High  | 1 day      | ❌ Not Done |
| C2 | `docs/OBSERVABILITY.md` — Sentry + logging  | Zero error context post-launch; cron failures invisible               | 🔴 High  | 1 day      | ❌ Not Done |
| C3 | `docs/TESTING.md` — testing strategy        | Net-worth / FX / P&L math has zero unit tests                         | 🔴 High  | 1 day      | ❌ Not Done |
| C4 | `docs/DISASTER_RECOVERY.md` — Neon + export | No restore runbook; user data export not specified for GDPR           | 🔴 High  | 0.5 day    | ❌ Not Done |
| C5 | `CONTRIBUTING.md` — onboarding guide        | New contributors lack code-style / commit / PR / test expectations    | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C6 | `docs/API_REFERENCE.md` — route contract    | No formal request/response schema; integrations (Plaid R23) blocked   | 🟡 Med   | 1 day      | ❌ Not Done |
| C7 | `docs/A11Y.md` — accessibility baseline     | Scattered across SUGGESTIONS #43/44/48/57/70 + UI_UX #13; no checklist | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C8 | `docs/DATA_MODEL.md` — ERD + invariants     | Decimal/serialization rules + lossless conversion only in code        | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C9 | `CLAUDE.md` index missing `UI_UX_SUGGESTIONS.md` | Doc is orphaned from the canonical index                          | 🟢 Low   | 5 min      | ❌ Not Done |
| C10 | `docs/FEATURES.md` — recently shipped UX surfaces  | Privacy mode, command palette, swipe actions, pull-to-refresh, view transitions ship without canonical reference | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C11 | `docs/KEYBOARD_SHORTCUTS.md` — power-user reference | ⌘K, ⌘B, ⌘⇧Y (privacy), ⌘⇧R (refresh) etc. only discoverable via git log | 🟢 Low   | 1 hr       | ❌ Not Done |
| C12 | `docs/CI_CD.md` — pipeline runbook                 | `.github/workflows/ci.yml` exists but no doc on required checks, preview gates, branch protection, local repro | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C13 | `docs/PERFORMANCE_BUDGETS.md` — numeric targets     | LCP/INP/CLS targets and bundle KB ceilings live in prose across 3 docs; nothing CI-enforceable | 🟡 Med   | 0.5 day    | ❌ Not Done |
| C14 | `docs/NEON_OPERATIONS.md` — pooler + migrations     | Pooled `DATABASE_URL` vs `DIRECT_URL`, region pinning (`sin1`), `migrate dev` vs `db push` etiquette only in LOG entries | 🟡 Med   | 0.5 day    | ❌ Not Done |

## Methodology

Same prioritization as `DOCS_REVIEW_SUGGESTIONS.md`:

1. **Risk first** — security, observability, recovery before features.
2. **Unblockers second** — testing + API reference unblock contributions and integrations.
3. **Polish third** — contributor and a11y guides.

## Detailed Gap Write-ups

### C1 — `docs/SECURITY.md` (CRITICAL)

**Observation.** Security items are spread thinly: `RELEASE_READINESS.md` R5/R6/R8 (auth/ownership, headers, CSP), `VERCEL_ANALYSIS.md` V3/V7/V11 (rate limiting, headers), `SUGGESTIONS.md` (2FA #38). No doc owns the holistic posture.

**What's missing.**
- Threat model for a personal-finance SaaS (account takeover, IDOR, secret leak, supply chain).
- Secrets management runbook: `AUTH_SECRET`, `CRON_SECRET`, `AUTH_GOOGLE_*`, `DATABASE_URL` rotation cadence + procedure.
- Ownership-check pattern (D1 / R5) with a canonical helper signature and example.
- CSRF posture for mutating routes (NextAuth v5 + RSC actions).
- Dependency vulnerability scanning (npm audit / Dependabot / Snyk wiring).
- Audit-logging plan for sensitive reads/mutations on `Account`, `Holding`, `*Transaction`.
- Webhook signature verification template (for any future Plaid / Stripe / cron-from-Vercel work).
- Rate-limit bypass risks given the in-process limiter in `src/lib/rate-limit.ts`.

**Why now.** R5 (ownership) and D1 are flagged as the single highest-risk correctness bug (any authenticated user can `PATCH/DELETE` other users' accounts by guessing IDs). No security doc means the fix isn't generalized.

---

### C2 — `docs/OBSERVABILITY.md` (CRITICAL)

**Observation.** R17 ("Ship Sentry"), R18 ("pino structured logging"), R19 ("on-call playbook"), V12 (structured logging), D10 (observability baseline) are all ❌ Not Done and live in different docs.

**What's missing.**
- Sentry SDK setup for Next.js 16 RSC + Edge middleware (split package list).
- DSN provisioning + per-environment sample rates.
- pino logger config (request id, user id redaction, JSON shape).
- Vercel log search queries for: 5xx spikes, cron failure (`/api/cron/snapshot`), price-fetch fallbacks, FX-rate misses.
- `/api/health` contract (DB ping, Yahoo/CoinGecko reachability) — currently absent.
- Alert routing: Sentry → Slack/email. Cron-miss alert (Vercel cron didn't fire by 22:00 UTC).
- Bundle-size baseline tracking (referenced in D10 but no implementation).
- Metric definitions: net-worth-calc latency, snapshot-cron duration, FX-cache hit rate.

**Why now.** On day 1 post-launch, with no error tracking or structured logs, debugging is "tail Vercel logs and hope." Daily snapshot cron failures (silently corrupting `NetWorthSnapshot` history) are detection-blind.

---

### C3 — `docs/TESTING.md` (CRITICAL)

**Observation.** Only Playwright E2E exists (`tests/e2e/smoke.spec.ts`). `SUGGESTIONS.md` #26 says "add test coverage" but no plan. D4 says "minimum baseline tests" but unspecified. `ANALYSIS_ROADMAP.md` calls for service-level unit tests but the repo has none.

**What's missing.**
- Testing pyramid: unit (Vitest), integration (Vitest + test DB), E2E (existing Playwright).
- Vitest config + first-test scaffold.
- Service-layer test patterns for the pure-math hot zones:
  - `src/lib/services/net-worth-service.ts` (two-pass missing-rate algorithm).
  - `src/lib/services/exchange-rate-service.ts` (`resolveRate`, identity, inverse).
  - `src/lib/services/history-service.ts` (lossless re-normalization across base-currency switches).
  - `src/lib/services/balance.ts` (balance/value helpers).
- API auth/ownership contract tests (one per route group) — pairs with C1.
- Fixtures / factories for `User`, `Account`, `Holding`, `*Transaction`, `ExchangeRate`, `PriceCache`.
- CI wiring (which suite runs on PR vs nightly).

**Why now.** Refactoring any FX or net-worth code today is a coin flip on silent regressions. Financial math without tests is the textbook example of "ship-stopper."

---

### C4 — `docs/DISASTER_RECOVERY.md` (CRITICAL)

**Observation.** R16 ("Document Neon backup SLA") is ❌ Not Done. No doc covers restore procedures, user data export, or accidental-deletion recovery.

**What's missing.**
- Neon PITR window (default 7d) and the upgrade path if longer retention is needed.
- Restore runbook: branch from PITR → smoke test → cutover.
- Per-user data export endpoint (also blocks GDPR / R12 right-to-export).
- Per-user data deletion (right-to-erasure) including cascade rules across `Account`, `Holding`, `*Transaction`, `NetWorthSnapshot`, `PriceCache`, `ExchangeRate`.
- Migration rollback strategy (Prisma `migrate resolve` patterns; what's safe vs not).
- Snapshot integrity: how to detect a partial cron run and re-snapshot affected users.

**Why now.** Users will store years of portfolio history. First time a user accidentally deletes an account (or we ship a bad migration) determines whether trust survives.

---

### C5 — `CONTRIBUTING.md`

**Observation.** `.github/PULL_REQUEST_TEMPLATE.md` exists but no `CONTRIBUTING.md`. `CLAUDE.md` and `AGENTS.md` cover project conventions but assume Next.js 16 fluency.

**What's missing.**
- Local-dev bootstrap (Neon branch creation, seeding, `.env` template).
- Code style + commit message format (the repo's git log shows a consistent style worth codifying).
- PR review checklist (tests added, docs updated, migration committed, no `db push` drift).
- "When to update which doc" — `LOG.md` vs `SUGGESTIONS.md` status flip vs new doc creation.

---

### C6 — `docs/API_REFERENCE.md`

**Observation.** Route layout is in `CLAUDE.md` but no formal request/response schema. Validators exist in `src/lib/validators.ts` but aren't surfaced as a contract.

**What's missing.**
- One row per route: method, path, auth requirement, Zod schema link, response shape, rate-limit class.
- Optional OpenAPI generation from Zod (e.g., `zod-to-openapi`) — preconditions Plaid integration (R23).

---

### C7 — `docs/A11Y.md`

**Observation.** A11y items are scattered: `SUGGESTIONS.md` #43, #44, #48, #57, #70; `UI_UX_SUGGESTIONS.md` #13 (partial); D6 in `DOCS_REVIEW_SUGGESTIONS.md`. No baseline.

**What's missing.**
- WCAG 2.1 AA target with the rules we're committing to.
- Component-level checklist (form labels, focus rings, keyboard traps in dialogs/sheets, non-color status cues).
- Testing approach (axe-core in Playwright, manual VoiceOver/NVDA passes for critical flows).
- Charts a11y plan (Recharts: aria descriptions + tabular fallback for screen readers).

---

### C8 — `docs/DATA_MODEL.md`

**Observation.** `prisma/schema.prisma` is the source of truth, and `CLAUDE.md` documents the serializer rules (Decimal/Date), but there's no ERD or invariants doc.

**What's missing.**
- ERD diagram (Mermaid).
- Invariants: every monetary value is `Decimal`, every cross-currency value is computed lazily and cached in `PriceCache` / `ExchangeRate`, every snapshot is lossless via `breakdown`.
- Serialization contract (`serializeAccount` / `serializeHolding` / `serializeAccountWithHoldings`) and **why spreading Prisma instances is forbidden**.
- Migration etiquette (when `db push` is acceptable in prototyping vs always-`migrate dev` for merged work).

---

### C9 — Index `UI_UX_SUGGESTIONS.md` in `CLAUDE.md`

**Observation.** `CLAUDE.md`'s "Long-form analysis docs" section lists 8 docs but omits `docs/UI_UX_SUGGESTIONS.md`, which exists and contains 11 implemented/partial UX features.

**Fix.** Add a single bullet to the docs index in `CLAUDE.md`:

> - `docs/UI_UX_SUGGESTIONS.md` — mobile-first iOS patterns + desktop polish (large-title nav, sheets, swipe actions, command palette, density toggle)

### C10 — `docs/FEATURES.md` (recently shipped UX surfaces)

**Observation.** The last ~30 commits shipped a wave of user-facing features that have **zero canonical doc**: privacy mode (commit `dd8ae61` and predecessors — masks holdings/net-worth, persisted in `localStorage`), command palette (`8955c24`, `ae815b1`), swipe actions (`34862d1`, `7ef1f41`, `140a8ad` — left-swipe edit/delete with `framer-motion`, full-swipe danger zone, haptics), pull-to-refresh (`5d04fe7`), View Transitions API (`252807d`), inline validation + numeric `inputmode` (`5705819`). `LOG.md` notes them in passing; `UI_UX_SUGGESTIONS.md` flips them to ✅ Done. Neither is a reference.

**What's missing.**
- One-row-per-feature reference: what it does, how to invoke, persistence surface, accessibility considerations, desktop fallback.
- Specifically for **privacy mode**: what data is masked (holding values, account balances, net-worth), what is *not* (chart shapes, percentages?), toggle persistence (per-device, per-user), screen-reader announcement on toggle, screen-recording use case.
- Specifically for **swipe actions**: the one-row-at-a-time registry pattern, danger-zone threshold, undo path (or lack), how to add a swipe action to a new list.
- Specifically for **view transitions**: which routes opt in, `transitionTypes` map, `prefers-reduced-motion` fallback.

**Why now.** Without a feature reference, the team is the only source of truth on behavior — every new contributor or support question requires re-reading commits. Privacy mode in particular is a trust-bearing feature on a financial app; its semantics need to be written down.

---

### C11 — `docs/KEYBOARD_SHORTCUTS.md` (power-user reference)

**Observation.** Recent commits added shortcuts that only the author knows: `⌘K` (palette), `⌘B` (sidebar collapse — `6bb6547`), `⌘⇧Y` (privacy mode — `dd8ae61`, changed from `⌘⇧P` because of browser conflict), `⌘⇧R` (price refresh). Mac vs Windows variants and i18n'd labels are handled in code but undocumented.

**What's missing.**
- Printable cheat-sheet table: action → Mac → Win/Linux → scope (global / list-row / form).
- Discoverability: where the in-app `?` help should live (R22 hooks here).
- "How to add a new palette action" pointer to the registry file.
- Conflict policy (why `⌘⇧P` was abandoned — `dd8ae61` — should be captured so the next person doesn't reintroduce it).

**Why now.** Shortcuts are a power-user retention lever. They are also the most common support question on any keyboard-driven SaaS.

---

### C12 — `docs/CI_CD.md` (pipeline runbook)

**Observation.** `R20` is ✅ Done — `.github/workflows/ci.yml` runs `npm ci → prisma generate → lint → tsc → next build`. `R21` (E2E in CI) is the next step. No doc owns: which checks are required to merge, branch-protection rules, preview-deploy gates, how Vercel's `build:vercel` interacts with Neon previews, or how to reproduce a CI failure locally.

**What's missing.**
- Required-check list and how to update it.
- Preview-deploy lifecycle: branch push → Neon preview branch (if any) → Vercel preview → E2E (when R21 lands) → merge.
- Local repro recipe (the same commands CI runs, in order).
- "What to do when CI fails" troubleshooting matrix (lint vs tsc vs build vs migrate).

**Why now.** With C5 (`CONTRIBUTING.md`) and C3 (`TESTING.md`) lining up, the CI doc is the missing third leg of the contribution-flow tripod.

---

### C13 — `docs/PERFORMANCE_BUDGETS.md` (numeric targets)

**Observation.** Numbers are scattered: `BUNDLE_ANALYSIS.md` references baseline KB sizes, `VERCEL_ANALYSIS.md` V23–V24 cite Core Web Vitals, `LOG.md` records ad-hoc wins. Nothing is a budget, nothing is enforced.

**What's missing.**
- Concrete ceilings the team commits to (illustrative — pick real numbers):
  - LCP ≤ 2.5s p75 mobile, INP ≤ 200ms p75, CLS ≤ 0.10.
  - Client-route JS ≤ 150 KB gzip first-load.
  - Server route p95 ≤ 400ms (excluding cold start).
  - Snapshot-cron p95 ≤ 30s for 1k users.
- Enforcement plan: bundle-size assertion in CI (e.g., `size-limit`), Vercel Speed Insights threshold alerts, Sentry performance alerts (depends on C2).
- Process for raising a budget (who approves, what evidence is required).

**Why now.** Without numbers, "performance" is opinion. With numbers, regressions are visible in PR diff. Pairs naturally with C2 observability.

---

### C14 — `docs/NEON_OPERATIONS.md` (pooler + migrations runbook)

**Observation.** `LOG.md` 2026-04-26 introduces the `DIRECT_URL` (for migrations) vs pooled `DATABASE_URL` (for runtime) split. `VERCEL_ANALYSIS.md` V5 pins the function region to `sin1` to match Neon. `CLAUDE.md` summarizes the Prisma adapter. No doc unifies the day-2 Neon story.

**What's missing.**
- Pooled vs direct connection: which env var goes where, what breaks when they're swapped.
- Region pinning rationale (`sin1`) and what to change if the Neon region moves.
- Cold-start expectations on Vercel serverless + the warming strategy (if any).
- Migration etiquette: when `prisma migrate dev` is mandatory vs when `db push` is acceptable in prototyping; how to recover if `db push` drift hits a merged migration.
- Neon branch strategy: production / preview / per-PR branches (overlap with C12), promotion path from preview to production.
- Pooler saturation symptoms (timeouts, `too many connections`) and the runbook to mitigate.

**Why now.** Neon-on-Vercel is the production baseline; an outage here takes the whole app down. The information exists in code and LOG entries — it just needs to be one click away. Distinct from C4 (which covers PITR / restore / GDPR export); this is *connectivity and migration ops*.

---

## Recommended Sequencing

The four 🔴 High items map cleanly onto a one-week pre-launch hardening sprint:

1. **Day 1** — C1 `SECURITY.md` (also unblocks D1 ownership rollout).
2. **Day 2** — C3 `TESTING.md` + first Vitest run (unblocks C1's auth/ownership contract tests).
3. **Day 3** — C2 `OBSERVABILITY.md` (Sentry + pino + `/api/health`, closes R17/R18/R19/D10).
4. **Day 4** — C4 `DISASTER_RECOVERY.md` (closes R16, unblocks GDPR R12).
5. **Day 5** — C5–C9 in parallel; ship index fix to `CLAUDE.md` first (5 min).

The 🟡 Medium second-pass items (C10–C14) form a follow-on "developer ergonomics" sprint that depends on the hardening week landing first:

6. **Day 6** — C12 `CI_CD.md` + C14 `NEON_OPERATIONS.md` (locks down the runtime + pipeline; pairs with C5 contributor onboarding).
7. **Day 7** — C13 `PERFORMANCE_BUDGETS.md` (depends on C2 observability for measurement).
8. **Day 8** — C10 `FEATURES.md` + C11 `KEYBOARD_SHORTCUTS.md` (user-facing reference; can be authored by anyone with codebase familiarity).

## Cross-References

- Closing C1 also closes/advances: R5, R6, R8, V3, V7, V11, D1.
- Closing C2 also closes/advances: R17, R18, R19, V12, D10.
- Closing C3 also closes/advances: D4, SUGGESTIONS #26.
- Closing C4 also closes/advances: R16, R12.
- Closing C7 also closes/advances: D6, SUGGESTIONS #43/44/48/57/70, UI_UX #13.
- Closing C11 also closes/advances: R22 (in-app help), UI_UX command-palette entry.
- Closing C12 also closes/advances: R20, R21 (E2E in CI), and unblocks C5 contributor flow.
- Closing C13 also closes/advances: V23, V24, BUNDLE_ANALYSIS baseline tracking.
- Closing C14 also closes/advances: V5, the LOG.md 2026-04-26 `DIRECT_URL` note.

Owner: TBD. Review on every release-readiness pass; flip to ✅ as each gap doc lands.
