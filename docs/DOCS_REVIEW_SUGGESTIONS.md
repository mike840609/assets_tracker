# Assets Tracker — Consolidated Docs Suggestions

## Overview

This document consolidates the highest-value recommendations across:

- `docs/SUGGESTIONS.md`
- `docs/VERCEL_ANALYSIS.md`
- `docs/BUNDLE_ANALYSIS.md`
- `docs/ANALYSIS_ROADMAP.md`

It is intended to be an execution-oriented backlog with dependency-aware ordering.

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

## Methodology

Prioritization order uses three rules:

1. **Risk first**: security and reliability findings before feature expansion.
2. **Unblockers second**: work that enables multiple follow-up improvements.
3. **Fast wins third**: low/medium effort items with immediate production impact.

Review date: **2026-04-20**.

## Detailed Enhancement Write-ups

### D1 — Enforce auth + ownership checks on sensitive APIs

**Observation.** Existing docs identify defense-in-depth gaps where routes rely too heavily on middleware or miss explicit ownership assertions.

**Recommendation.** Ensure every sensitive read/mutation route validates session + resource ownership in-handler, returning `401` / `403` deterministically.

**Why now.** Highest risk class; should precede additional product work.

---

### D2 — Harden cron snapshot endpoint and fan-out behavior

**Observation.** Docs call out missing/misconfigured cron-secret guard rails and scalability risk from unconstrained fan-out.

**Recommendation.**

- Fail fast when `CRON_SECRET` is missing.
- Use timing-safe comparison for auth header checks.
- Batch/chunk user fan-out to avoid uncontrolled burst load.

**Why now.** Prevents both security footguns and reliability failures as tenant count rises.

---

### D3 — Add startup environment validation (`env.ts`)

**Observation.** Non-null assertions on `process.env` can fail deep at runtime with poor diagnostics.

**Recommendation.** Centralize env parsing/validation in `src/lib/env.ts` and import validated values from there.

**Why now.** Improves deploy confidence and shortens incident diagnosis time.

---

### D4 — Establish baseline tests

**Observation.** Docs repeatedly identify low test coverage as a blocker for safe refactors.

**Recommendation.** Add minimum viable coverage in this order:

1. Unit tests for service-layer financial math and aggregations.
2. API integration tests focused on auth/ownership and input validation.
3. One E2E smoke path covering login → account/holding flow.

**Why now.** Enables safe iteration on security/performance tasks above.

---

### D5 — Complete caching and invalidation hygiene

**Observation.** Some read routes still lack explicit cache headers; mutation routes may miss consistent tag invalidation.

**Recommendation.**

- Add `Cache-Control` on read-only APIs where appropriate.
- Audit and standardize `revalidateTag(...)` after mutations.

**Why now.** Reduces stale-data edge cases while improving TTFB/cache-hit ratio.

---

### D6 — Finish accessibility quick wins

**Observation.** Accessibility items are open across controls, charts, and sortable table interactions.

**Recommendation.**

- Add `aria-label` on icon-only controls.
- Add keyboard + semantic sort support (`aria-sort`) for sortable tables.
- Add non-color differentiation for key chart series and states.

**Why now.** High user impact and strong compliance value for relatively modest effort.

---

### D7 — Close hot-path performance items

**Observation.** Existing findings highlight scaling bottlenecks in transaction pagination and external data-fetch paths.

**Recommendation.**

- Move transactions to cursor/keyset pagination.
- Add short-lived cache to `/api/search` lookups.
- Dedupe/chunk symbol batches in price refresh paths.
- Scope exchange-rate refresh work to current user context.

**Why now.** Directly reduces DB and external API amplification at higher load.

---

### D8 — Analysis Phase 2.1: cash-flow decomposition

**Observation.** Roadmap marks this as the most user-valuable next analysis feature.

**Recommendation.** Implement monthly decomposition into contributions vs market performance and visualize as stacked bars.

**Why now.** Delivers immediately understandable insight once platform stability baseline is in place.

---

### D9 — Analysis Phase 2.2: category trend over time

**Observation.** Snapshot `breakdown` data is already collected but underutilized.

**Recommendation.** Aggregate category history and render trend views using existing category color/label conventions.

**Why now.** High leverage from already-stored data; strong explanatory value.

---

### D10 — Observability minimum bar

**Observation.** Docs note missing health endpoint and inconsistent structured diagnostics.

**Recommendation.**

- Add `/api/health` readiness endpoint.
- Replace ad-hoc console logging with structured logging.
- Maintain bundle/perf baseline checks as part of release workflow.

**Why now.** Speeds incident response and makes regressions measurable.

---

## Suggested Delivery Plan

### Sprint A — Stability & Security

- D1 auth/ownership hardening
- D2 cron hardening and fan-out limits
- D3 startup env validation
- D4 minimum test baseline

### Sprint B — Performance & Accessibility

- D5 cache headers + invalidation audit
- D6 accessibility quick wins
- D7 hot-path performance fixes

### Sprint C — Product & Observability

- D8 cash-flow decomposition
- D9 category trend
- D10 observability baseline hardening

## Optional Quick Wins (same day)

- Add `Cache-Control` to remaining read-only APIs.
- Add `/api/health` endpoint.
- Add `aria-label` on icon-only controls.
- Add missing `CRON_SECRET` misconfiguration guard.
- Add short TTL cache for `/api/search`.
