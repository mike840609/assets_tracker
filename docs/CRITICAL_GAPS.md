# Assets Tracker — Critical Documentation Gaps

## Overview

This document catalogs **critical topics not covered (or under-covered) by the existing docs** in `docs/`. It is the result of a cross-doc audit performed on **2026-05-05** against:

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

## Recommended Sequencing

The four 🔴 High items map cleanly onto a one-week pre-launch hardening sprint:

1. **Day 1** — C1 `SECURITY.md` (also unblocks D1 ownership rollout).
2. **Day 2** — C3 `TESTING.md` + first Vitest run (unblocks C1's auth/ownership contract tests).
3. **Day 3** — C2 `OBSERVABILITY.md` (Sentry + pino + `/api/health`, closes R17/R18/R19/D10).
4. **Day 4** — C4 `DISASTER_RECOVERY.md` (closes R16, unblocks GDPR R12).
5. **Day 5** — C5–C9 in parallel; ship index fix to `CLAUDE.md` first (5 min).

## Cross-References

- Closing C1 also closes/advances: R5, R6, R8, V3, V7, V11, D1.
- Closing C2 also closes/advances: R17, R18, R19, V12, D10.
- Closing C3 also closes/advances: D4, SUGGESTIONS #26.
- Closing C4 also closes/advances: R16, R12.
- Closing C7 also closes/advances: D6, SUGGESTIONS #43/44/48/57/70, UI_UX #13.

Owner: TBD. Review on every release-readiness pass; flip to ✅ as each gap doc lands.
