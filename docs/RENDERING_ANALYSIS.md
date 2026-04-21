# Asset Tracker — Rendering Strategy Analysis (SSG → PPR → ISR)

## Overview

The user asked for ISR suggestions. The correct Next.js 16 answer is to walk the rendering ladder **SSG → PPR → ISR** and only use ISR where the first two don't apply. This doc is the rendering-strategy slice that complements `BUNDLE_ANALYSIS.md` and `VERCEL_ANALYSIS.md` — the items here are additive to V17, V18, V20, V21, V26, V27 (not duplicates).

| # | Suggestion | Category | Impact | Effort | Status |
|---|-----------|----------|--------|--------|--------|
| S1 | `/login` → SSG (`force-static`) | SSG · Public page | 🟡 Medium | 10 min | 🚫 Blocked — `force-static` incompatible with `nextConfig.cacheComponents`; PPR shell serves as fallback |
| S2 | `/privacy` → SSG (`force-static`) | SSG · Public page | 🟡 Medium | 10 min | 🚫 Blocked — same constraint as S1 |
| P1 | Verify build output classifies `/`, `/accounts`, `/accounts/[id]`, `/history`, `/analysis`, `/settings` as `◐` | PPR · Verification | 🟡 Medium | 20 min | ❌ Not Done |
| P2 | Move `/accounts` list reads into the cached `fetchUserAccountsWithHoldings` helper | PPR · Route coverage | 🟡 Medium | 45 min | ❌ Not Done |
| I1 | ISR on `GET /api/exchange-rates` (`revalidate` + `Cache-Control`) | ISR · Route handler | 🔴 High | 15 min | 🚫 Blocked — route-segment `revalidate` conflicts with `nextConfig.cacheComponents`; `Cache-Control` shipped |
| I2 | ISR on `GET /api/search` (`revalidate` + `Cache-Control`) | ISR · Route handler | 🔴 High | 15 min | 🚫 Blocked — same constraint as I1; `Cache-Control` shipped |
| I3 | `fetch({ next: { revalidate, tags } })` on CoinGecko fallback | ISR · Upstream fetch | 🟡 Medium | 15 min | ✅ Done (PR 4) |
| I4 | Route-segment `revalidate` backstop on PPR routes | ISR · Backstop | 🟢 Low | 15 min | ❌ Not Done |
| I5 | Document the `fetch({ next: { revalidate } })` pattern on upstream FX APIs | ISR · Reference | 🟢 Low | 10 min | ✅ Done (PR 4) |
| X1 | Verify / trim `revalidateTag(tag, "max")` second argument | Prereq · Correctness | 🔴 High | 15 min | ✅ Done |
| X2 | Add `revalidateTag("snapshots")` after cron snapshot creation | Prereq · Invalidation | 🔴 High | 10 min | ✅ Done |
| X3 | Commit the `next build` classification snippet to this doc | Verification | 🟢 Low | 10 min | ❌ Not Done |

## Methodology

Findings sourced on **2026-04-21** from a direct read of:

- Every page under `src/app/` (`/login`, `/privacy`, `/`, `/accounts`, `/accounts/[id]`, `/history`, `/analysis`, `/settings`).
- Every route handler under `src/app/api/` (`accounts`, `auth`, `cron`, `exchange-rates`, `prices`, `search`, `settings`, `snapshots`).
- The service layer (`price-service.ts`, `exchange-rate-service.ts`, `net-worth-service.ts`, `history-service.ts`, `settings-service.ts`).
- `next.config.ts`, `vercel.json`, and prior coverage in `BUNDLE_ANALYSIS.md` + `VERCEL_ANALYSIS.md`.

Grep confirmed **zero** current uses of `export const revalidate`, `export const dynamic`, or `generateStaticParams` in the repo. The `"use cache"` directive is present on service-layer helpers (V27) but not on any page or route handler.

## The Rendering Ladder

For each surface, pick the highest rung that applies:

1. **SSG** — content has no per-user data and changes only on deploy. Mark the segment `export const dynamic = "force-static"` (+ `revalidate = false`). Infinite TTL. Served from the CDN; zero function invocations on repeat visits.
2. **PPR** — the page has a static shell plus user-specific islands. Move structural reads into a `"use cache"`-wrapped service helper with `cacheTag("x:${userId}")` and `cacheLife("minutes")`. Mutations call `revalidateTag`. With `cacheComponents: true` set in `next.config.ts`, build output flips from `ƒ (Dynamic)` to `◐ (Partial Prerender)`.
3. **ISR** — a route handler returns shared data that can safely be stale for a bounded window. Add `export const revalidate = N` or `fetch(url, { next: { revalidate: N, tags: [...] } })`; layer `Cache-Control: public, s-maxage=N, stale-while-revalidate=M` so Vercel's edge cache short-circuits the function call entirely.

Only fall back to the next rung when the current one can't apply.

## Detailed Enhancement Write-ups

### S1 — `/login` → SSG

**Observation.** `src/app/login/page.tsx` renders a Google OAuth button, i18n copy via `getTranslations("login")`, and a `VERCEL_ENV === "preview"` conditional. No per-user data, no Prisma, no auth check. The `<form action>` targets a server action (`signIn`) — the action itself is dynamic, but the markup around it is not. The page currently compiles as `ƒ (Dynamic)` because nothing hints otherwise.

**Recommendation.** Opt into SSG at the segment level:

```ts
// src/app/login/page.tsx (top of file)
export const dynamic = "force-static";
export const revalidate = false;
```

Caveat: locale comes from the `NEXT_LOCALE` cookie (see `src/i18n/request.ts`). `force-static` bakes the **default** locale (`en-US`) into the HTML; locale switch reloads the page and re-reads the cookie on the subsequent request, which hits the static asset again. Users see the cookie-selected locale only if locale selection forces a client-side re-render or a route segment accepts the locale as a URL segment. Acceptable trade-off for a login page; document alongside the change.

**Critical files.** `src/app/login/page.tsx`.

---

### S2 — `/privacy` → SSG

**Observation.** `src/app/privacy/page.tsx` is legal copy pulled from `getTranslations("privacy")`. No Prisma, no session, no dynamic branches. Same ladder position as `/login`.

**Recommendation.** Same two lines as S1:

```ts
export const dynamic = "force-static";
export const revalidate = false;
```

Privacy copy changes only on deploy, so `revalidate = false` is correct — a redeploy invalidates naturally.

**Critical files.** `src/app/privacy/page.tsx`.

---

### P1 — Verify build-output classification for PPR routes

**Observation.** `VERCEL_ANALYSIS.md` V27 is marked ✅ Done and claims `/`, `/accounts`, `/accounts/[id]`, `/history`, `/analysis`, `/settings` now opt into Partial Prerender via `"use cache"` on their service-layer reads. Classifier state is runtime-observable; it should be verified on the next production build rather than assumed. If any route still prints `ƒ (Dynamic)`, it means a direct dynamic read (cookies, headers, uncached Prisma call) re-entered the page segment and bounced it back out of PPR.

**Recommendation.** Run `npm run build` locally and paste the routes table into this doc's `Verification` subsection (see X3). For any route still classified `ƒ`, trace the leak with `next build --profile` and either move the read behind a cached helper or extract it into a client island fed by `fetch`.

**Critical files.** N/A (verification). Possible follow-ups in `src/app/(main)/*/page.tsx`.

---

### P2 — Move `/accounts` list reads into the cached helper

**Observation.** `src/app/(main)/accounts/page.tsx:28-32` calls `prisma.account.findMany(...)` directly from the page, and line `42` calls `prisma.priceCache.findMany(...)` directly as well. Both paths bypass the `"use cache"` layer. Meanwhile `src/lib/services/net-worth-service.ts:19-31` already exports `fetchUserAccountsWithHoldingsInner` which is `"use cache"`-wrapped with `cacheTag("accounts")` + `cacheTag("accounts:${userId}")`, and re-exports it as `fetchUserAccountsWithHoldings` via React `cache()`. The page isn't using it.

**Recommendation.** Replace the inline `prisma.account.findMany` with:

```ts
import { fetchUserAccountsWithHoldings } from "@/lib/services/net-worth-service";
// …
const accountsRaw = await fetchUserAccountsWithHoldings(userId);
```

For prices, add a symmetrical cached helper in `price-service.ts`:

```ts
"use cache";
import { cacheLife, cacheTag } from "next/cache";

export async function getCachedPricesForSymbols(symbols: string[]) {
  cacheTag("prices");
  cacheLife("minutes");
  return prisma.priceCache.findMany({ where: { symbol: { in: symbols } } });
}
```

Call it from the page in place of the inline query. Build output should flip `/accounts` from `ƒ` to `◐`. Cross-reference `VERCEL_ANALYSIS.md` V27.

**Critical files.** `src/app/(main)/accounts/page.tsx`, `src/lib/services/net-worth-service.ts`, `src/lib/services/price-service.ts`.

---

### I1 — ISR on `GET /api/exchange-rates`

**Observation.** `src/app/api/exchange-rates/route.ts` is seven lines and has zero caching:

```ts
export async function GET() {
  const rates = await prisma.exchangeRate.findMany();
  return ok(rates);
}
```

Response is identical across all users; data changes only when the cron (`30 21 * * *` UTC) or the manual refresh endpoint writes to `ExchangeRate`. PPR doesn't apply to route handlers — ISR is the correct rung.

**Recommendation.** Two-layer caching: Next.js Data Cache + Vercel edge `Cache-Control`.

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export async function GET() {
  const rates = await prisma.exchangeRate.findMany();
  return NextResponse.json(rates, {
    headers: {
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
```

The refresh endpoint (`src/app/api/exchange-rates/refresh/route.ts`) and the cron already call `revalidateTag("exchange-rates")` — cross-wire a `revalidatePath("/api/exchange-rates")` or tag-based cache invalidation at write time so the edge cache busts on refresh. Cross-reference `VERCEL_ANALYSIS.md` V17 (the `"use cache"` side of the same route).

**Critical files.** `src/app/api/exchange-rates/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`, `src/app/api/cron/snapshot/route.ts`.

---

### I2 — ISR on `GET /api/search`

**Observation.** `src/app/api/search/route.ts:48-83` queries Yahoo Finance for symbol metadata on every request. Symbol metadata (name, exchange, currency inference) is stable for days. Every keystroke-completed search currently round-trips to Yahoo; autocomplete bursts multiply the hit count.

**Recommendation.** Key the cache on the query string via `revalidate` + response headers. The `q` param is the sole input, so the Data Cache dedupes naturally.

```ts
export const revalidate = 86400; // 24h — symbol metadata rarely changes

export async function GET(request: Request) {
  // …existing logic…
  return NextResponse.json(quotes, {
    headers: {
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
```

Edge-runtime migration is blocked by `cacheComponents: true` (see `VERCEL_ANALYSIS.md` V8) — ISR on the Node runtime is still a full win since the cache hit never executes the handler.

**Critical files.** `src/app/api/search/route.ts`.

---

### I3 — `fetch({ next: { revalidate, tags } })` on CoinGecko fallback

**Observation.** `src/lib/services/price-service.ts:82-85` calls CoinGecko with `cache: "no-store"`, which opts out of the Next.js Data Cache entirely:

```ts
const res = await fetch(
  `https://api.coingecko.com/api/v3/simple/price?ids=${...}&vs_currencies=usd`,
  { cache: "no-store" }
);
```

`refreshAllPrices` is called from the cron and from `/api/prices/refresh`, so the fallback runs at most a few times a day. The `no-store` flag makes the path fragile against CoinGecko rate limits without any upside.

**Recommendation.**

```ts
const res = await fetch(
  `https://api.coingecko.com/api/v3/simple/price?ids=${...}&vs_currencies=usd`,
  { next: { revalidate: 60, tags: ["prices:crypto"] } }
);
```

Call `revalidateTag("prices:crypto")` from the cron after the upsert loop so the next refresh starts fresh. Between cron runs (if anyone hits the manual refresh), the tag-cached response stays within 60 seconds.

**Critical files.** `src/lib/services/price-service.ts`, `src/app/api/cron/snapshot/route.ts`.

---

### I4 — Route-segment `revalidate` backstop on PPR routes

**Observation.** V26/V27 move structural reads behind `cacheTag("x:${userId}")` and rely on mutation handlers calling `revalidateTag` correctly. If a new mutation endpoint ships without the matching tag call, the cached page is effectively "stale forever" until the service-level `cacheLife` expires. That's a correctness hazard the tag contract doesn't protect against on its own.

**Recommendation.** Add a belt-and-suspenders route-segment `revalidate` to every PPR route:

```ts
// src/app/(main)/page.tsx, /accounts/page.tsx, /history/page.tsx,
// /analysis/page.tsx, /settings/page.tsx
export const revalidate = 900; // 15-minute failure floor
```

This does **not** replace the tag contract (V21) — it's a floor, not a ceiling. Tags invalidate in seconds; the segment `revalidate` only kicks in when a tag call is missed. Low risk, cheap insurance. Cross-reference `VERCEL_ANALYSIS.md` V21.

**Critical files.** `src/app/(main)/page.tsx`, `src/app/(main)/accounts/page.tsx`, `src/app/(main)/history/page.tsx`, `src/app/(main)/analysis/page.tsx`, `src/app/(main)/settings/page.tsx`.

---

### I5 — Document the `fetch` revalidation pattern (reference, no code change)

**Observation.** `src/lib/services/exchange-rate-service.ts:74-77,90-93` already uses the canonical ISR pattern for upstream calls:

```ts
await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
  next: { revalidate: 3600 },
});
```

New upstream fetches in `price-service.ts` (I3) and anywhere else should follow the same idiom. The pattern is not visible anywhere except inside one service file.

**Recommendation.** Keep a code block in this doc's `The Rendering Ladder` section as the canonical reference. When adding a new upstream `fetch`, the default expectation is:

```ts
await fetch(url, {
  next: {
    revalidate: /* seconds — match the upstream's change cadence */,
    tags: [/* used by the cron / refresh endpoint for on-demand busting */],
  },
});
```

No runtime change. This is a docs-only item so future contributors don't reach for `cache: "no-store"` reflexively.

**Critical files.** None (reference).

---

### X1 — Verify / trim `revalidateTag(tag, "max")` second argument

**Observation.** Three handlers pass `"max"` as a second argument to `revalidateTag`:

- `src/app/api/cron/snapshot/route.ts:17` — `revalidateTag("net-worth", "max");`
- `src/app/api/exchange-rates/refresh/route.ts:24` — `revalidateTag("exchange-rates", "max");`
- `src/app/api/prices/refresh/route.ts:7` — `revalidateTag("net-worth", "max");`

The stable Next.js 16 `revalidateTag` signature is `(tag: string): void`. Any second argument is either an unstable/experimental profile hint or is silently ignored. If silently ignored, the code reads as though it's opting into something it isn't — a trap for future readers.

**Recommendation.** Before changing anything, check `node_modules/next/dist/` for the `revalidateTag` export signature in this project's Next.js version (`16.2.2`). If the second argument has no effect in the installed version, drop it for clarity:

```ts
revalidateTag("net-worth");
```

If it *does* map to a `cacheLife` profile in an experimental build, add a one-line comment documenting what `"max"` means and why it's used, so readers don't have to re-derive it. Marked 🔴 High because the tag-invalidation correctness of I1, I3, I4, X2 all assume these calls fire as intended.

**Critical files.** `src/app/api/cron/snapshot/route.ts`, `src/app/api/exchange-rates/refresh/route.ts`, `src/app/api/prices/refresh/route.ts`.

---

### X2 — Add `revalidateTag("snapshots")` after cron snapshot creation

**Observation.** `src/app/api/cron/snapshot/route.ts:25-31` creates a `NetWorthSnapshot` row per user, then returns without invalidating any tag tied to the snapshot table. `src/lib/services/history-service.ts` wraps history reads with `cacheTag("snapshots", "net-worth", "history:${userId}")`. The `net-worth` tag is busted at line 17 (pre-snapshot), but `snapshots` and `history:${userId}` are never busted — so the morning after the cron runs, `/history` and `/analysis` can still serve yesterday's data until `cacheLife("minutes")` rolls over.

**Recommendation.** After the snapshot `Promise.all`, add:

```ts
revalidateTag("snapshots");
for (const user of users) {
  revalidateTag(`history:${user.id}`);
}
```

Or, if the loop is too hot, rely on the broader `revalidateTag("snapshots")` alone and accept the per-user tags expire naturally.

**Critical files.** `src/app/api/cron/snapshot/route.ts`.

---

### X3 — Commit the `next build` classification snippet

**Observation.** P1 asks for build-output verification, but nothing captures the current state in-repo. A regression to `ƒ (Dynamic)` on any PPR route would ship silently.

**Recommendation.** After S1–I4 land, run `npm run build` and paste the `Route (app)` classification table into a new `## Verification` section at the bottom of this doc. Target state:

- `/login`, `/privacy` → `○ (Static)`
- `/`, `/accounts`, `/accounts/[id]`, `/history`, `/analysis`, `/settings` → `◐ (Partial Prerender)`
- `/api/exchange-rates` → shows `revalidate = 3600`
- `/api/search` → shows `revalidate = 86400`

Re-run on every rendering-strategy PR to make regressions visible at review time.

**Critical files.** `docs/RENDERING_ANALYSIS.md` (this file).

---

## Items Explicitly Excluded (and why)

- **`generateStaticParams` for `/accounts/[id]`.** Each id is per-user private data; pre-rendering would leak ownership and serve stale values. PPR is already the right tool (see `VERCEL_ANALYSIS.md` V16).
- **`generateStaticParams` for locales.** `next-intl` here is cookie-based (`NEXT_LOCALE`), not `[locale]`-segmented. SSG per locale would require a routing change — out of scope.
- **Edge runtime on `/api/exchange-rates` / `/api/search`.** Blocked by `cacheComponents: true`; `VERCEL_ANALYSIS.md` V8 documents this. Do not re-propose until the Next.js constraint lifts.
- **Long-cache headers on `/public/*`.** Owned by `VERCEL_ANALYSIS.md` V20 — no duplicate item here.
- **`force-static` on `(main)` routes.** They read `getSession()` which requires cookies — inherently dynamic, PPR-only.

---

## Next Steps

1. **Prereqs first:** ship **X1** and **X2**. Every ISR/PPR item below depends on tags firing correctly.
2. **SSG wins:** ship **S1** and **S2** — ten minutes each, instantly removes function invocations for `/login` and `/privacy`.
3. **PPR coverage:** run **P1** to confirm the V27 claim; ship **P2** to close the `/accounts` gap.
4. **ISR on route handlers:** ship **I1** and **I2** (15 minutes each, 🔴 impact), then **I3** (cleans up the `no-store` footgun).
5. **Backstop:** ship **I4** after V21's `revalidateTag` contract is audited — not before, or mutations could mask each other.
6. **Reference + verification:** land **I5** alongside **I3**; land **X3** after S1–I4 are all in production so the snippet reflects the target state.

Suggested PR grouping:

- **PR 1 (prereqs):** X1 + X2 — correctness fixes with no behaviour change.
- **PR 2 (SSG):** S1 + S2 — trivial, high-confidence.
- **PR 3 (PPR):** P1 verification + P2 refactor — these want to land together so P1's `next build` output already reflects P2.
- **PR 4 (ISR):** I1 + I2 + I3 + I5 — all route/fetch-level caching.
- **PR 5 (backstop + verification):** I4 + X3 — ship after PR 4 has baked for a few days.
