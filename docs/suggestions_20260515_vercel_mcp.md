# Vercel MCP — Findings & Enhancement Suggestions (2026-05-14)

## Context

Companion to [`suggestions_20260515.md`](./suggestions_20260515.md). The S-series digest is the system-of-record backlog (S1–S32). This file captures **only the signal that the Vercel MCP surfaces** — i.e. items that come from inspecting the live project, deployments, build logs, and runtime telemetry on Vercel itself, not from reading the codebase.

When a finding here overlaps an S-item, it appears in the [S-Series Re-Prioritization](#s-series-re-prioritization) table at the bottom — not as a duplicate F-item.

---

## Live Platform Snapshot (2026-05-14)

Captured via `mcp__plugin_vercel_vercel__*` against project `prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team `team_ImEsp9hzYaqzaPz5VmE6LTiW`). Use as a baseline for the next audit.

| Aspect                             | Observed value                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Framework / Node                   | Next.js 16.2.2 / Node 24.x / Turbopack bundler                                   |
| Function region                    | `sin1` (matches Neon `ap-southeast-1`)                                           |
| Build region                       | `iad1` (Washington DC) — fine, build is one-shot                                 |
| Latest prod deploy                 | `dpl_3J2mvqrYWANr68Nao6rASJV8fJD2` (commit `54ed7ce`, READY, 55 s build)         |
| Project flag                       | **`live: false`** in `get_project` response                                      |
| Domains                            | 5 × `*.vercel.app`, **no custom domain**                                         |
| Production runtime logs (last 7 d) | **Empty** (`No logs found` for all levels)                                       |
| Lambdas                            | 4 Node.js functions (`lambdaRuntimeStats: nodejs:4`)                             |
| Build cache                        | 295 MB uploaded; Turbopack compile 29.6 s; full deploy 55 s                      |
| Build warnings                     | 2 × `engines.node: ">=22"` auto-upgrade warning (resolved by F3)                 |
| Prisma                             | Client `7.8.0` generated in build (V3's 7.6.0 → 7.7.0 ask is moot)               |
| Routes shape                       | All app routes are PPR (`◐`) or Dynamic (`ƒ`); no fully static (`○`) page routes |

---

## MCP-Only Findings (F-series)

### F1 — Production runtime logs empty for 7 days · 🔴 · Effort: investigate

`get_runtime_logs` (`environment: production`, last 7 d, all levels) returns `No logs found`. Two possibilities, both worth resolving:

- The cron snapshot at 21:30 UTC isn't firing → silent data loss (matches the worry behind [S6](./suggestions_20260515.md#s6--cron-run-audit-table--freshness-alert)).
- The cron _is_ firing but logs are absent because no `console.*` calls run on the success path → observability blind spot (matches [S4](./suggestions_20260515.md#s4--structured-logger--sentry)).

This **elevates S5 + S6 + S4 to "do first in Tier 1"** — there is currently zero live signal that the daily snapshot pipeline is healthy.

**Action:** Verify in the Vercel dashboard (Functions → `/api/cron/snapshot` → Invocations) whether cron has fired in the last 7 days. If yes → ship S4 (logger) + S5 (`/api/health`) so the next 7 days produce evidence. If no → fix cron _before_ anything else.

### F2 — `live: false` on the Vercel project · 🟡 · Effort: XS

`get_project` returns `"live": false`. Not user-visible; likely a Vercel-internal traffic/billing flag. Confirm via the dashboard whether it indicates "no traffic in N days" vs. a billing throttle. If it's a traffic indicator, it's consistent with F1.

**Action:** One-line check in the dashboard; document the resolved meaning in [`INFRASTRUCTURE.md` § Vercel Platform](./INFRASTRUCTURE.md#vercel-platform).

### F3 — Pin `engines.node` to a specific major · ✅ Done 2026-05-14 · Effort: XS

Build log emitted twice:

> `Warning: Detected "engines": { "node": ">=22" } in your package.json that will automatically upgrade when a new major Node.js Version is released.`

Resolved in this PR — `package.json` now declares `"node": "24.x"`. Verify by inspecting the next deployment's build log: the warning should no longer appear.

### F4 — S8 (CSP) is partly underway · ⚠️ status correction

Untracked file: `src/app/api/_csp/report/route.ts`. The `_` prefix means App Router treats it as a private folder (the route is not yet wired). Someone has already started scaffolding the CSP violation report endpoint that S8 calls for.

**Action:** S8's status in [`suggestions_20260515.md`](./suggestions_20260515.md#s8--csp-header) updated from ❌ → ⚠️ ("report endpoint scaffolded; header + nonce pipeline still missing"). Promote the route under a public path (e.g. `/api/csp/report`) once the header lands.

### F5 — No custom domain on production traffic · 🟡 · Effort: S (one-time)

All 5 domains are `*.vercel.app`. Production traffic served from `assets-tracker-ct.vercel.app`. Not a problem today (personal project) but: subdomain on `vercel.app` means no SEO equity, no email-on-domain, and a confusing OAuth consent screen for any future user beyond the owner.

**Action:** If this stays a personal tool, ignore. If invite-anyone is on the roadmap, register a domain and add it to the project (Vercel handles cert).

### F6 — Vercel Rolling Releases (canary deploys) · 🟡 · Effort: XS

Daily-deploy cadence (5 deploys to production yesterday alone) means a bad ship hits 100% of users instantly. **Rolling Releases** (GA June 2025) lets a deploy go to a configurable % first. Toggle in project settings; no code change.

**Action:** Enable in Vercel dashboard → Settings → Deployments → Rolling Releases. Set canary to 10% for 5 min. Pairs with [S20 (Skew Protection)](./suggestions_20260515.md#s20--vercel-skew-protection) — both are XS dashboard toggles that meaningfully shrink deploy blast radius.

### F7 — Vercel BotID on hot public endpoints · 🟡 · Effort: S

`/api/search` (Yahoo Finance symbol search) and `/api/auth/[...nextauth]` (Google sign-in) are unauthenticated or pre-auth. They're attractive bot-scraping targets that cost Yahoo Finance rate-limit budget. **BotID** (GA June 2025) ships invisible client-side bot detection; protect the routes via the BotID server SDK.

**Action:** Install BotID, gate `/api/search` first (lowest blast radius), then `/api/auth/*` after a week of telemetry. Free up to a quota.

### F8 — Vercel Log Drain to long-term storage · 🟡 · Effort: S

Vercel default log retention is short. The 7-day `No logs found` query in F1 is partly bounded by retention. Set up a Log Drain to a cheap sink (Better Stack / Logtail / Axiom free tier) so the next time something silently breaks, you have history beyond the retention window.

**Action:** Vercel dashboard → Project → Logs → Drains → add HTTPS endpoint. Pairs naturally with [S4 (logger)](./suggestions_20260515.md#s4--structured-logger--sentry) — the logger emits the lines, the drain persists them.

---

## S-Series Re-Prioritization

Driven by the F-series above. No items are removed — only urgency shifts.

| Item                                                                      | Current S-tier | Recommended new tier                  | Reason                                                                                  |
| ------------------------------------------------------------------------- | -------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| [S5](./suggestions_20260515.md#s5--apihealth-endpoint)                    | Tier 1         | Tier 1 — **do first**                 | F1: zero evidence cron is firing; need a healthcheck before adding any observability    |
| [S6](./suggestions_20260515.md#s6--cron-run-audit-table--freshness-alert) | Tier 1         | Tier 1 — **do alongside S5**          | F1: paired with /api/health; without `CronRun` table no historical signal exists either |
| [S4](./suggestions_20260515.md#s4--structured-logger--sentry)             | Tier 1         | Tier 1 — **promote ahead of S1 / S7** | F1: every other Tier-1 item benefits from having a logger first                         |
| [S8](./suggestions_20260515.md#s8--csp-header)                            | Tier 1, ❌     | Tier 1, **⚠️ partial**                | F4: report endpoint already scaffolded                                                  |
| [S20](./suggestions_20260515.md#s20--vercel-skew-protection)              | Tier 2         | Tier 1 — bundle with F6               | F6: both are XS dashboard toggles; logical to ship together                             |

---

## Cross-References

| Tracker                                                | Items referenced here        |
| ------------------------------------------------------ | ---------------------------- |
| [`suggestions_20260515.md`](./suggestions_20260515.md) | S4, S5, S6, S8, S20          |
| [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md)             | V3 (moot), V8, V11, V14, V35 |
