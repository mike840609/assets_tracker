# Fluid Active-CPU Reduction Plan — 2026-06-13 re-audit

_Continuation of `docs/PLATFORM.md` § "Fluid CPU Optimization" (P1–P9). That
section's plan was written 2026-05-17; most of its top items have since shipped
(P3, P4, P5, P8 ✅; P1 matcher tightened; P2 firewall documented). This re-audit
re-reads the live Vercel project and the current code, then re-prioritizes the
**remaining** levers around what actually burns Active CPU today._

## Goal

The project is on the Vercel **Hobby (Free)** plan, which includes **4 hours of
Fluid Active CPU per month**. Usage is approaching that cap. Target: keep monthly
billed Active CPU comfortably under the included allowance with no UX regression.

> **Active CPU ≠ wall-clock.** Fluid bills _CPU time actually spent executing_,
> not time spent waiting on I/O. External HTTP waits (Yahoo / CoinGecko / FX
> providers) and idle DB round-trips are largely **not** billed. The levers that
> move the needle are therefore (a) reducing CPU-bound work — RSC render,
> JSON/Decimal math, JWT crypto, SDK init — and (b) reducing how often that work
> is forced to run cold.

## Live evidence (Vercel MCP, 2026-06-13)

Project `prj_soY30S7ki1x38gmeZXCancJD1PVA` (`asset-tracker`, team
`team_ImEsp9hzYaqzaPz5VmE6LTiW`), production, latest deploy
`dpl_9DAEKtrfPKx6a1S5XQtxNKkkLnJe`.

| Query (7-day window, production)    | Result                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| `source=edge-middleware`, all paths | **2 logs** — both `GET /` → 302 (self/bot)                           |
| `source=serverless`                 | **0 logs**                                                           |
| all sources, no filter              | **14 logs** — `/privacy` ×10 (one-second burst), `/login` ×2, `/` ×2 |
| `query=snapshot` (cron evidence)    | **0 logs** in window                                                 |
| `get_project.live`                  | **`false`**                                                          |

**Headline:** real request volume is effectively zero. The bot-probe storm that
dominated the 2026-05-17 audit (33 edge-middleware hits, `/wp-admin`, `/cmd_sco`)
is **gone** — the tightened matcher (P1) and firewall rules (P2) are working. With
human + bot request traffic this low, **per-request optimization can no longer be
the main lever.** Whatever is consuming the 4-hour budget runs _independently of
request volume_:

1. The **daily cron** (`/api/cron/snapshot`, `30 21 * * *`) and, more importantly,
   the **cold cache rebuilds it forces** by invalidating global cache tags.
2. **Deploy-driven cache resets.** Vercel's `cacheComponents`/ISR cache is
   per-deployment. `list_deployments` shows a very high cadence — ~20 deploys in
   the recent window, multiple **production** deploys per hour during active dev.
   Every production deploy discards the warm render cache, so the next visit to
   each PPR route cold-renders its dynamic holes (Active CPU). With near-zero
   traffic there is never a warm cache to amortize that cost across.
3. The **`/api/health` DB probe** (`SELECT 1` + two `findFirst`s per call) if an
   external uptime monitor polls it on a tight interval — a 24/7 drip that can
   dwarf a once-a-day cron.

Caveat: Hobby log retention is short and the MCP row cap (100) under-samples, so
the cron's daily fire likely rolled out of the window rather than not firing
(the `CronRun` audit table is the authoritative record — see C1).

## What already shipped (P-series recap)

| Item | Lever                                             | Status (2026-06-13)                                      |
| ---- | ------------------------------------------------- | -------------------------------------------------------- |
| P1   | Tighten middleware matcher (skip bot/junk paths)  | ✅ Live in `src/proxy.ts` matcher                        |
| P2   | Vercel Firewall / WAF rules                       | ✅ Documented (`docs/firewall_rules.json`) — verify live |
| P3   | Statically serve `/login` `/privacy` `/terms`     | ✅ Done                                                  |
| P4   | Skip JWT decode for anonymous (no session cookie) | ✅ Done — `hasSessionCookie()` fast path in `proxy.ts`   |
| P5   | Collapse refresh into one user-scoped function    | ✅ Done — `POST /api/refresh`, dirty-gated invalidation  |
| P6   | **Gate the cron's `revalidateTag` on "changed"**  | ❌ **Not done** — cron still invalidates unconditionally |
| P7   | RSC double-auth dedup (trusted header)            | ⏸️ Deferred                                              |
| P8   | Singleton `yahoo-finance2` client                 | ✅ Done — `yahoo-client.ts`                              |
| P9   | Keep-warm pinger                                  | 🚫 Intentionally not shipped                             |

## Prioritized plan (C-series)

Ordered by expected Active-CPU saved given the traffic-independent profile above.

### C1 — Measure Active CPU at the source before cutting (prerequisite)

**Why first:** the runtime _request_ logs (above) prove the cost is **not** in
request volume, so optimizing request paths blind would chase the wrong thing.
We need per-source attribution before spending effort.

- Read **Vercel → Project → Usage → Active CPU** and record the current rolling
  30-day total and the daily trend in `docs/LOG.md` as the baseline.
- Read **Vercel → Observability → Functions** to see which function
  (`/api/cron/snapshot`, RSC route render, `/api/health`, `/api/refresh`)
  accounts for the most Active CPU.
- Pull cron cost directly from the audit table: the `CronRun` rows already record
  `durationMs` per run (`src/app/api/cron/snapshot/route.ts`). Query the last 30
  rows to get average + max cron wall time, and cross-check against Active CPU.
- Confirm whether anything polls `/api/health` (uptime monitor, Sentry, external
  checker) and at what interval — this single number may explain the budget.

**Effort:** 30–45 min, no code. **Output:** a baseline + the one or two functions
that dominate, which tells us which of C2–C6 actually matters.

### C2 — Gate the cron's global cache invalidation on actual change (was P6)

**Effect: High, and the highest-confidence code lever.** `/api/cron/snapshot`
today calls, _every single day regardless of whether anything moved_:

```
revalidateTag("exchange-rates", "max")
revalidateTag("net-worth", "max")
revalidateTag("prices", "max")
revalidateTag("prices:crypto", "max")
revalidateTag("snapshots", "max")
revalidateTag(`history:${user.id}`, "max")   // per user
```

Each global invalidation forces the **next** render of every cached RSC read
(`/`, `/analysis`, `/history`, `/settings`, `/accounts`) to cold-rebuild — the
exact expensive Active-CPU work we want to avoid. The manual `/api/refresh` route
**already** solved this with dirty-gating (`pricesDirty`/`ratesDirty` from the
service result); the cron never got the same treatment.

- File: `src/app/api/cron/snapshot/route.ts`.
- Capture `refreshAllPrices()`'s `updated` count and the per-currency
  `refreshExchangeRates` results (they already return `{ updated, ... }`).
- Only `revalidateTag("prices"|"prices:crypto", "max")` when prices updated > 0;
  only `revalidateTag("exchange-rates", "max")` when any rate updated > 0; only
  invalidate `net-worth` when either changed.
- For `snapshots` / `history:${user.id}`: compare each user's new snapshot total
  against the prior snapshot and skip invalidation when it's within an epsilon
  (e.g. `< 0.01` base-currency) **and** no option contracts expired that day.
- Keep the always-on invalidation only for the option-expiry branch (it already
  guards on `expiredOptions.length > 0`).

**Pros:** removes a guaranteed daily cold-rebuild of every cached route on days
when nothing moved (weekends, holidays, flat markets). Reuses a pattern already
proven in `/api/refresh`. **Cons:** a missed invalidation could surface a stale
number for up to 24 h — mitigate by keeping the epsilon tight and leaving the
cheap per-user `history` invalidation on whenever a snapshot row was actually
written.

### C3 — Cut production deploy cadence (process, not code)

**Effect: High, given the observed cadence.** Multiple production deploys per
hour each discard the per-deployment render cache; with ~0 traffic there's no
warm reuse, so every route re-pays cold-render Active CPU on its first
post-deploy hit. The fix is to deploy to **production** less often:

- Land feature work on preview branches (already happening) but **batch merges to
  `master`** so production redeploys a few times a day rather than a few times an
  hour.
- Optionally gate production deploys behind tags/releases (Vercel → Git →
  "Production Branch" + ignored-build step) so only intentional releases hit prod.
- Preview deployments have their own (separate) usage and don't share the prod
  cache, so this is specifically about the `master` → production cadence.

**Pros:** directly reduces the number of cold-cache windows. No code risk.
**Cons:** slower prod feedback loop; purely a workflow change, so it needs owner
buy-in rather than a PR.

### C4 — Right-size the `/api/health` probe and its polling

**Effect: Medium–High if it's polled frequently; otherwise negligible.** Each
call runs `SELECT 1` + `netWorthSnapshot.findFirst` + `cronRun.findFirst`
(`src/app/api/health/route.ts`). At a 1-minute uptime-monitor interval that's
~43k invocations/month of real (if small) DB + JSON Active CPU — plausibly larger
than the once-daily cron.

- Confirm the polling source and interval in C1 first.
- Split **liveness** (cheap, no DB — return `{ ok: true }`) from **readiness**
  (the DB probe). Point the high-frequency uptime monitor at liveness only.
- Or relax the monitor interval to 5–15 min, which is plenty for a personal app.
- Or cache the readiness DB probe result for ~60 s so bursts collapse to one query.

### C5 — Verify Sentry tracing is OFF in production

**Effect: Low–Medium, near-zero effort.** Server-side tracing adds per-request
CPU. The code defaults correctly to `tracesSampleRate: 0`
(`src/instrumentation.ts`), but that's overridable by `SENTRY_TRACES_SAMPLE_RATE`.

- Confirm in Vercel → Project → Settings → Environment Variables that
  `SENTRY_TRACES_SAMPLE_RATE` and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` are
  **unset or `0`** in production, and that no `profilesSampleRate` is configured.
- Error capture (`captureException`/`captureMessage`) stays on — it's event-driven
  and cheap. Only continuous tracing/profiling is the concern.

### C6 — RSC double-auth dedup (was P7) — keep deferred until C1 says otherwise

Middleware decodes the JWT, then `getSession()` decodes it again per render. This
only matters once **human navigation volume returns**; at current traffic it's
noise. Revisit only if C1's per-function breakdown shows authenticated RSC render
(JWT crypto) is a top consumer. The trusted-header approach also carries a
spoofing-surface caveat (documented in PLATFORM.md P7) — not worth the risk for a
non-measurable gain today.

### C7 — Do NOT add a keep-warm pinger (reaffirms P9)

A warmer spends Active CPU to avoid cold starts — the opposite of the goal when
traffic is near zero. Leave cold starts as-is; C2–C4 reduce total work instead.

## Recommended execution order

1. **C1** — read Vercel Usage + Observability + `CronRun.durationMs`; identify the
   dominant function and confirm whether `/api/health` is being polled. _(no code)_
2. **C2** — port the `/api/refresh` dirty-gating into the cron. _(one PR, this branch)_
3. **C4** — fix `/api/health` polling/shape if C1 shows it's hot.
4. **C3** — agree a production-deploy batching policy. _(workflow)_
5. **C5** — one-time env-var check.
6. Re-measure after ~3–7 days; only then consider **C6**.

## Verification

After C2 ships, wait for two cron fires (one on a flat-market day) then:

- **Vercel → Usage → Active CPU:** confirm the daily Active-CPU step-down vs. the
  C1 baseline; record in `docs/LOG.md`.
- **Cron correctness:** on a day prices _did_ move, confirm the dashboard shows
  fresh numbers within the cron window (no stale-number regression from C2's
  gating). On a flat day, confirm `CronRun` still wrote a row but the cache tags
  were _not_ invalidated (add a `log.info("cron.revalidate.skipped")` to assert).
- **Functional smoke:** `npm run test:e2e` smoke spec green; manual sign-in →
  dashboard → click Refresh → numbers update.

## Out of scope (intentionally skipped)

- Migrating off Hobby — the owner wants to stay on Free.
- Switching to database sessions — would _increase_ per-render CPU.
- Edge runtime for API routes — blocked by `cacheComponents` (PLATFORM.md V8) and
  most routes need Prisma (Node-only).
- Lowering snapshot frequency below daily — daily granularity is a product
  requirement; C2 removes the waste without touching cadence.
