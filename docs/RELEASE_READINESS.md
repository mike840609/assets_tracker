# Assets Tracker — Release Readiness (Pre-Market-Launch)

## Overview

| #   | Suggestion                                                                  | Category              | Impact    | Effort   | Status      |
|-----|-----------------------------------------------------------------------------|-----------------------|-----------|----------|-------------|
| R1  | Add baseline security headers (HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy) | Security              | 🔴 High   | 1 hr     | ✅ Done     |
| R2  | Content-Security-Policy (Report-Only → enforce)                             | Security              | 🔴 High   | 2–3 hrs  | ❌ Not Done |
| R3  | Rate limit `/api/search`, `/api/exchange-rates`, `/api/auth/*`              | Security              | 🔴 High   | 2–3 hrs  | ✅ Done     |
| R4  | `crypto.timingSafeEqual` compare for `CRON_SECRET`                          | Security              | 🟡 Medium | 15 min   | ❌ Not Done |
| R5  | Enforce account/holding ownership on every mutation route                   | Security              | 🔴 High   | 1–2 hrs  | ❌ Not Done |
| R6  | Add `/terms` (Terms of Service) page                                        | Legal / Compliance    | 🔴 High   | 1–2 hrs  | ❌ Not Done |
| R7  | Cookie / analytics consent banner                                           | Legal / Compliance    | 🔴 High   | 2–3 hrs  | ❌ Not Done |
| R8  | GDPR data-export + delete-account flows                                     | Legal / Compliance    | 🔴 High   | 2–3 hrs  | ❌ Not Done |
| R9  | Verify Google OAuth consent screen is published & verified                  | Legal / Compliance    | 🔴 High   | 30 min   | ❌ Not Done |
| R10 | Add support/contact email in footer + `/privacy`                            | Legal / Compliance    | 🟡 Medium | 15 min   | ❌ Not Done |
| R11 | Add `error.tsx`, `global-error.tsx`, `not-found.tsx`                        | Reliability           | 🔴 High   | 1–2 hrs  | ✅ Done     |
| R12 | Add `/api/health` endpoint                                                  | Reliability           | 🟡 Medium | 30 min   | ❌ Not Done |
| R13 | Verify Vercel Cron `/api/cron/snapshot` fires daily in production           | Reliability           | 🔴 High   | 15 min   | ❌ Not Done |
| R14 | Timeout + retry guards on Yahoo Finance / CoinGecko calls                   | Reliability           | 🔴 High   | 30–60 min| ❌ Not Done |
| R15 | Switch Prisma `db push` → `migrate deploy` (committed migrations)           | Reliability           | 🔴 High   | 2–3 hrs  | ❌ Not Done |
| R16 | Document Neon backup / PITR SLA in `README.md`                              | Reliability           | 🟡 Medium | 30 min   | ❌ Not Done |
| R17 | Ship Sentry (or equivalent) for error aggregation + alerts                  | Observability         | 🔴 High   | 1–2 hrs  | ❌ Not Done |
| R18 | Structured logging via `pino` with `userId` / `requestId` context           | Observability         | 🟡 Medium | 3–4 hrs  | ❌ Not Done |
| R19 | On-call playbook (Vercel log queries + baselines) in `README.md`            | Observability         | 🟡 Medium | 45 min   | ❌ Not Done |
| R20 | `.github/workflows/ci.yml` — lint + `tsc --noEmit` + `next build` on PR     | Testing / CI          | 🔴 High   | 1 hr     | ❌ Not Done |
| R21 | Playwright smoke E2E — login, create account+holding, view dashboard        | Testing / CI          | 🔴 High   | 4–6 hrs  | ❌ Not Done |
| R22 | In-app help / FAQ modal + support link                                      | Product               | 🟡 Medium | 2–3 hrs  | ❌ Not Done |
| R23 | Non-destructive data import (merge, not overwrite)                          | Product               | 🔴 High   | 3–4 hrs  | ❌ Not Done |
| R24 | Rename `src/middleware.ts` → `src/proxy.ts` (Next.js 16)                    | Platform Config       | 🟢 Low    | 10 min   | ❌ Not Done |
| R25 | Add `public/robots.txt` + `/sitemap.xml`                                    | Platform Config       | 🟡 Medium | 30 min   | ❌ Not Done |
| R26 | Flip Vercel project `live: true` ONLY after R1–R14 land                     | Platform Config       | 🔴 High   | 5 min    | ❌ Not Done |

## Methodology

Findings sourced against Vercel project `prj_soY30S7ki1x38gmeZXCancJD1PVA`
(`asset-tracker`, team `team_ImEsp9hzYaqzaPz5VmE6LTiW`) on **2026-04-24**
via Vercel MCP:

- `get_project` — confirmed project is `live: false`, Node 24.x,
  primary domain `assets-tracker-ct.vercel.app`, latest production
  deployment `dpl_9AEBE12n9gT2y1G3KEgZB7PMkGq2` (commit `ba6ec1b`).
- `get_runtime_logs` — production environment, 7-day window
  (2026-04-17 → 2026-04-24), filtered to `error | warning | fatal`:
  **zero** matches. The app is healthy; all items below are
  *prevention*, not *remediation*.
- `list_deployments` — last 20 deployments all `READY`, every recent
  commit green, bundler turbopack. No failing-build signal.
- File-tree audit for missing launch surfaces: `src/app/error.tsx`,
  `src/app/global-error.tsx`, `src/app/not-found.tsx`,
  `src/app/terms/`, `src/app/api/health/`, `.github/workflows/` —
  **all absent** at time of writing.
- Cross-reference: items already flagged in `VERCEL_ANALYSIS.md`
  and `SUGGESTIONS.md` as ❌ Not Done and scoped to a market-launch
  risk are re-listed here with their launch impact stated.

Scope: only **launch blockers or high-risk gaps**. Performance and
nice-to-have work already tracked in `SUGGESTIONS.md`,
`VERCEL_ANALYSIS.md`, `BUNDLE_ANALYSIS.md`, and
`RENDERING_ANALYSIS.md` is **not** duplicated here — see the
"Deferred" section at the bottom.

## Findings

### Security

#### R1 — Baseline security headers missing

`next.config.ts:25-35` sets only `X-DNS-Prefetch-Control`. A public
launch must add:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY` (or `Content-Security-Policy: frame-ancestors 'none'`)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

Without these, an attacker can frame the app into a phishing page
(clickjacking) and browsers will not upgrade the connection to HTTPS
on subsequent visits. Duplicates `VERCEL_ANALYSIS.md#V13` but
re-stated here as a hard **launch blocker**.

#### R2 — Content-Security-Policy

Ship in two stages: `Content-Security-Policy-Report-Only` for 48 h
with `report-uri` pointing at a collection endpoint, review the
violations, then flip to enforced. Allowlist must cover:

- Google OAuth (`accounts.google.com`, `lh3.googleusercontent.com`)
- Vercel Analytics + Speed Insights (`va.vercel-scripts.com`)
- Self-hosted fonts / Next.js inline styles (`'self' 'unsafe-inline'`
  for styles during the Report-Only window, tighten after)

See `VERCEL_ANALYSIS.md#V14`.

#### R3 — No rate limiting on public-touching routes

`/api/search`, `/api/exchange-rates`, and the NextAuth callback
`/api/auth/*` accept unbounded request volume. A single abusive
client can burn through Yahoo Finance quota and drive serverless
cost. Add a token bucket (Upstash Redis or `@vercel/rate-limit`)
keyed by `x-forwarded-for` + `session.user.id` when available, with
conservative per-IP limits (e.g. 60/min for `/api/search`).

#### R4 — `CRON_SECRET` not timing-safe

`src/app/api/cron/snapshot/route.ts` compares the bearer token with
`!==`, which short-circuits on the first byte mismatch and leaks
secret length via timing. Replace with `crypto.timingSafeEqual` on
equal-length buffers (duplicates `SUGGESTIONS.md#112`; blocker
because it's the only guard on a route that can trigger fan-out
writes across every user).

#### R5 — Ownership checks missing on mutation routes

`withAuth` confirms only that a session exists. The `[id]` in
`/api/accounts/[id]/...` is never validated against
`session.user.id`. Today any authenticated user can PATCH/DELETE
another user's accounts, holdings, or transactions by guessing the
ID. Combines `SUGGESTIONS.md#50`, `#109`, and `#110` — these
three items together are the single biggest correctness bug in
the app and must be closed before opening signups.

Routes to patch:

- `src/app/api/accounts/[id]/holdings/route.ts`
- `src/app/api/accounts/[id]/transactions/route.ts`
- `src/app/api/accounts/[id]/cash-transactions/route.ts`
- `src/app/api/accounts/[id]/route.ts` (PATCH / DELETE)

### Legal / Compliance

#### R6 — Terms of Service page missing

`/privacy` ships at `src/app/privacy/` but there is no `/terms`. A
market-facing product needs an enforceable ToS (liability limits,
acceptable-use, termination, governing law). Ship
`src/app/terms/page.tsx` using the same shell as `/privacy`.

#### R7 — No consent banner

Vercel Analytics + Speed Insights are mounted globally. For EU/UK
visitors, ePrivacy + GDPR require explicit opt-in **before** any
non-essential telemetry fires. Add a bottom-of-page banner with
"Accept / Reject non-essential" that gates the Analytics/Speed
Insights mount via `beforeSend` + a cookie flag.

#### R8 — GDPR data-export and delete-account flows

Users must be able to retrieve their data (Art. 15, right of access)
and delete their account end-to-end (Art. 17, right to erasure).
Today neither exists. Ship:

- `POST /api/user/export` — returns a JSON zip of all user rows
  (`Account`, `Holding`, `*Transaction`, `NetWorthSnapshot`,
  `Settings`).
- `DELETE /api/user` — cascades through every `userId`-scoped table
  and then the `User` row itself (Prisma `onDelete: Cascade` on the
  relations).
- Surface both on `/settings` with explicit confirmation dialogs.

#### R9 — Google OAuth consent screen must be verified

Unverified apps are capped at 100 users and show the "Google hasn't
verified this app" warning. Confirm in Google Cloud Console:

- App status: **In production**
- App verification: **Published**
- Scopes: `openid email profile` only (no sensitive/restricted scopes
  → no brand review required)

#### R10 — Support / contact email

GDPR Art. 13 requires a reachable contact for data-subject requests.
Add a `support@...` mailto in the footer and `/privacy`.

### Reliability

#### R11 — Error boundaries missing

No `error.tsx`, `global-error.tsx`, or `not-found.tsx` under
`src/app/`. Any render error today falls through to the stock
Next.js red screen. Ship:

- `src/app/error.tsx` — per-route reset + translated copy
- `src/app/global-error.tsx` — last-resort boundary (Next.js 16
  requires its own `<html><body>`)
- `src/app/not-found.tsx` — localized 404 with CTA back to `/`

See `SUGGESTIONS.md#27`.

#### R12 — `/api/health` endpoint

Required for Vercel uptime monitoring, deployment smoke checks, and
future status-page integration. Minimal spec: GET returns 200 with
`{ ok: true, db: "up" | "down", commit: process.env.VERCEL_GIT_COMMIT_SHA }`.
DB probe: `SELECT 1` via Prisma with a 2 s timeout. See
`VERCEL_ANALYSIS.md#V10`.

#### R13 — Verify Cron actually fires

`vercel.json` schedules `/api/cron/snapshot` for `30 21 * * *`. The
7-day runtime-log scan found no invocations in the sampled filters
— confirm the job is firing via Vercel Dashboard → Crons, and that
`NetWorthSnapshot` rows land for every user on at least two
consecutive nights. If nothing fires, users will report "my chart
is flat" on day 2. See `VERCEL_ANALYSIS.md#V11`.

#### R14 — External-call timeout + retry guards

`src/lib/services/price-service.ts` calls Yahoo Finance 2 and
CoinGecko without explicit per-request timeouts or retry logic. A
single slow response from upstream stalls the entire `refreshAllPrices`
fan-out in the daily cron (which has `maxDuration: 60`). Add:

- 5 s timeout per HTTP call (`AbortController`)
- 2 retries with exponential backoff on transient errors (5xx,
  network, ETIMEDOUT)
- Per-symbol failure isolation — one broken symbol must not abort
  the whole refresh

Combines `SUGGESTIONS.md#33` and `#52`.

#### R15 — Prisma migrations, not `db push`

`CLAUDE.md` instructs `npx prisma db push` — fine for solo dev,
dangerous for production. Public launch requires a committed
`prisma/migrations/` directory and a `prisma migrate deploy` step
in CI/build so schema changes are reviewable, reversible, and
auditable across environments.

#### R16 — Document Neon backup SLA

Confirm which Neon plan is in use, the PITR retention window, and
how a restore is performed. Capture in `README.md` under
"Operations" so the operator knows the RPO/RTO before a real user
asks for data recovery.

### Observability

#### R17 — Error tracking (Sentry)

Today errors go to Vercel stdout and are forgotten unless someone
greps logs. Sentry (or Highlight, Axiom, etc.) is non-negotiable
for a public product — it centralizes stack traces, dedupes
frequency, and alerts on new error classes. Wire the Next.js
integration into both server and client bundles.

#### R18 — Structured logging

Replace `console.log` / `console.error` across services with a
singleton `pino` logger that emits JSON, tagged with `userId`,
`requestId`, and `route`. This is the only way Vercel's log-search
(`query=userId:xxx`) stays useful past ~dozen users. Combines
`SUGGESTIONS.md#30`, `#55`, and `VERCEL_ANALYSIS.md#V12`.

#### R19 — On-call playbook

The MCP scan confirmed **0** errors in the last 7 days — capture
that as the "healthy baseline" in `README.md#Operations`, along
with the Vercel runtime-log queries used to verify health
(`level=error`, `statusCode=5xx`, `query=api`, `query=cron`) so a
non-author on-call can answer "is the site broken?" in under 60 s.

### Testing / CI

#### R20 — Minimum CI workflow

`.github/` currently contains only `PULL_REQUEST_TEMPLATE.md` — no
`workflows/`. Breaking changes can land on master unchecked. Add
`.github/workflows/ci.yml` running on every PR:

- `npm ci`
- `npx prisma generate`
- `npm run lint`
- `npx tsc --noEmit`
- `next build` (uses the same Turbopack path Vercel uses)

Fails red → blocks merge.

#### R21 — Playwright smoke E2E

Cover the three must-work paths:

1. Unauth visitor → `/login` → Google OAuth (stub the provider) → `/`
2. Create account → add holding via symbol search → holding appears
3. Dashboard loads with net-worth card + trend chart

Runs in CI on the preview deployment URL. Combines
`SUGGESTIONS.md#26` and `#56`.

### Product

#### R22 — In-app help / support

`SUGGESTIONS.md#68` shipped the onboarding empty state, but there's
no `?` help icon, FAQ modal, or support link from inside the app.
A new user stuck on "what do I put in the symbol field?" has no
recourse today. Ship a small help drawer referencing `README.md`
plus the support email from R10.

#### R23 — Non-destructive data import

`SUGGESTIONS.md#53` — today's import path overwrites. If a user
pastes a CSV, they should see a diff (new / updated / unchanged)
and confirm before anything is written. A destructive default on
real portfolio data is the kind of bug that ends a launch on
week 1.

### Platform Config

#### R24 — Middleware rename

`VERCEL_ANALYSIS.md#V1`. Every build logs
`⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
Not a launch blocker on its own, but it's 10 minutes and removes a
noisy deprecation warning from build logs, so batch it into the
launch PR.

#### R25 — `robots.txt` + `sitemap.xml`

Allow `/privacy` and `/terms` to be crawled (so they show up when
someone Googles the product); `Disallow` everything else. Ship as
`public/robots.txt` and a dynamic `src/app/sitemap.ts` returning the
public routes only.

#### R26 — Flip Vercel `live: true` last

`get_project` reports `"live": false`. Keep it that way until
R1–R14 have shipped and R13 has been verified in prod. Flipping
`live: true` starts Vercel's public listing + preview protections
change, and should only happen after the security/legal/reliability
blockers above are green.

## Deferred (track, but not launch blockers)

These remain tracked in their existing docs and are fine to ship
**after** a soft launch:

- `BUNDLE_ANALYSIS.md` — bundle-size reduction items
- `VERCEL_ANALYSIS.md` — remaining ❌ items not listed above
  (e.g. V7 yahoo consent notices, V15 build-cache audit, V17/V18/V20
  caching polish, V22/V33 bundle analyzer, V23 CLS reservations,
  V29 SSR chart shells are all 🟢/🟡 post-launch work)
- `SUGGESTIONS.md` — feature backlog (#7 cost basis, #17 dividends,
  #23 2FA, #24 Plaid, #25 custom widgets, #35 snapshot breakdown)
- `RENDERING_ANALYSIS.md` — SSG → PPR → ISR ladder items
- PWA manifest / install prompt
- Accessibility polish (`SUGGESTIONS.md#43`, `#44`, `#48`, `#57`, `#70`)
- Translation parity beyond en-US + zh-TW

## Verification

After R1–R26 land, confirm:

- `curl -sI https://assets-tracker-ct.vercel.app/ | rg -i 'strict-transport|x-frame|x-content|referrer|permissions|content-security'`
  → all headers present.
- `curl -s https://assets-tracker-ct.vercel.app/api/health`
  → `{ "ok": true, "db": "up", ... }`.
- `/terms` and `/privacy` load unauthenticated (check the proxy
  matcher allows both).
- Trigger the cron manually:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://assets-tracker-ct.vercel.app/api/cron/snapshot`
  → 200, `NetWorthSnapshot` rows for every user.
- Open a throwaway PR with a deliberate `tsc` error → `ci.yml`
  fails red and blocks merge.
- Re-run Vercel MCP `get_runtime_logs` (`level: error|fatal`,
  `since: 24h`) after the launch PR deploys → still zero. Any new
  5xx after R2 (CSP) is almost certainly a blocked-resource
  violation — inspect `/api/csp-report` before flipping from
  Report-Only to enforced.
- `get_project` once R26 is applied → `"live": true`.

## Launch-day go/no-go

Go only when every 🔴 High item above is ✅ Done. The 🟡 Medium
items (R4, R10, R12, R16, R18, R19, R22, R25) can land in the week
following launch without blocking signups, but should all be closed
within 14 days.
