# Mobile Initial-Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated dashboard paint a useful mobile shell sooner and shorten its critical path without removing charts or increasing Vercel Fluid CPU usage.

**Architecture:** Keep the existing Next.js 16 Cache Components and streaming section boundaries. Add one reusable static loading shell, move authenticated layout work behind it, parallelize existing request work, and retain split chart bundles while measuring the dashboard route separately.

**Tech Stack:** Next.js 16.2.2 App Router, React 19.2.4, TypeScript 5, Vitest 4, Playwright, Node.js 24 standard library.

## Global Constraints

- Every dashboard chart remains part of the initial load; do not use viewport, idle, or interaction-based deferral.
- Vercel Fluid CPU usage is a hard ceiling: no background job, prewarming request, polling loop, extra server invocation, or duplicate database/API read.
- Add no runtime dependency, caching infrastructure, or dashboard aggregation layer.
- Preserve authentication redirects, privacy behavior, translations, theme, navigation, pull-to-refresh, and existing route error handling.
- The loading shell must contain no user or financial data.
- `/` must remain partially prerendered.

---

### Task 1: Establish a dashboard-route asset baseline

**Files:**

- Create: `scripts/ci/dashboard-route-assets.mjs`

**Interfaces:**

- Consumes: `.next/server/app/(main)/page_client-reference-manifest.js`, `.next/server/app/(main)/page/build-manifest.json`, and `.next/static/**` from a production build.
- Produces: `measureDashboardRoute()` returning `{ totalGzipBytes, jsGzipBytes, cssGzipBytes, fileCount }`; CLI option `--write <path>`.

- [ ] **Step 1: Create the route-specific measurement script**

```js
#!/usr/bin/env node

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const ROUTE = "/(main)/page";
const RSC_MANIFEST = join(ROOT, ".next/server/app/(main)/page_client-reference-manifest.js");
const BUILD_MANIFEST = join(ROOT, ".next/server/app/(main)/page/build-manifest.json");

export function measureDashboardRoute() {
  if (!existsSync(RSC_MANIFEST) || !existsSync(BUILD_MANIFEST)) {
    throw new Error("Dashboard build manifests not found; run `pnpm build` first");
  }

  const sandbox = { globalThis: {} };
  runInNewContext(readFileSync(RSC_MANIFEST, "utf8"), sandbox);
  const manifest = sandbox.globalThis.__RSC_MANIFEST?.[ROUTE];
  if (!manifest) throw new Error(`Route manifest ${ROUTE} not found`);

  const buildManifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf8"));
  const files = new Set([
    ...buildManifest.polyfillFiles,
    ...buildManifest.rootMainFiles,
    ...Object.values(manifest.clientModules).flatMap((module) => module.chunks),
    ...Object.values(manifest.entryCSSFiles).flatMap((entries) =>
      entries.map((entry) => entry.path),
    ),
  ]);

  let jsGzipBytes = 0;
  let cssGzipBytes = 0;
  for (const file of files) {
    const relative = file.replace(/^\/_next\//, "");
    const full = join(ROOT, ".next", relative);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const bytes = gzipSync(readFileSync(full)).length;
    if (full.endsWith(".js")) jsGzipBytes += bytes;
    if (full.endsWith(".css")) cssGzipBytes += bytes;
  }

  return {
    totalGzipBytes: jsGzipBytes + cssGzipBytes,
    jsGzipBytes,
    cssGzipBytes,
    fileCount: files.size,
  };
}

const result = measureDashboardRoute();
const output = `${JSON.stringify(result, null, 2)}\n`;
const writeIndex = process.argv.indexOf("--write");
if (writeIndex >= 0) writeFileSync(process.argv[writeIndex + 1], output);
process.stdout.write(output);
```

- [ ] **Step 2: Build and verify the script against the current app**

Run:

```bash
pnpm build
node scripts/ci/dashboard-route-assets.mjs --write /tmp/dashboard-route-before.json
```

Expected: the build lists `◐ /`; the script exits `0` and `/tmp/dashboard-route-before.json` contains four positive numeric fields.

- [ ] **Step 3: Record the server baseline without changing production behavior**

Record the current Vercel dashboard values for `/` over the same representative window used after deployment:

- Fluid CPU time per invocation
- Function invocation count
- Speed Insights mobile FCP, LCP, INP, and CLS

Expected: a dated baseline is available for the final release gate. Do not add instrumentation, traffic, or a warm-up job.

- [ ] **Step 4: Commit the measurement utility**

```bash
git add scripts/ci/dashboard-route-assets.mjs
git commit -m "perf: measure dashboard route assets"
```

---

### Task 2: Render a static application shell before locale work

**Files:**

- Create: `src/components/layout/app-loading-shell.tsx`
- Create: `tests/unit/app-loading-shell.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**

- Consumes: optional `ReactNode` children.
- Produces: `AppLoadingShell({ children }: { children?: ReactNode })`, marked with `data-app-loading-shell="true"` and containing no personalized values.

- [ ] **Step 1: Write the failing shell test**

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLoadingShell } from "@/components/layout/app-loading-shell";

describe("AppLoadingShell", () => {
  it("renders a private-data-free shell and preserves nested fallback content", () => {
    const html = renderToStaticMarkup(
      createElement(AppLoadingShell, null, createElement("span", null, "route fallback")),
    );

    expect(html).toContain('data-app-loading-shell="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("route fallback");
    expect(html).not.toContain("net-worth-card");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/app-loading-shell.test.ts`

Expected: FAIL because `@/components/layout/app-loading-shell` does not exist.

- [ ] **Step 3: Implement the minimal reusable shell**

```tsx
import type { ReactNode } from "react";

export function AppLoadingShell({ children }: { children?: ReactNode }) {
  return (
    <div
      data-app-loading-shell="true"
      aria-hidden="true"
      className="flex min-h-full w-full flex-1 flex-col bg-background"
    >
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 md:hidden">
        <div className="h-6 w-36 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="size-10 animate-pulse rounded-md bg-muted" />
          <div className="size-10 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {children ?? (
          <div className="space-y-4">
            <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 h-32 animate-pulse rounded-2xl bg-muted" />
              <div className="h-28 animate-pulse rounded-2xl bg-muted" />
              <div className="h-28 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Make the root locale boundary show the shell and remove the redundant locale read**

In `src/app/layout.tsx`, import `AppLoadingShell`, remove `getLocale` from the `next-intl/server` import, delete `await getLocale()`, and change the boundary to:

```tsx
<Suspense fallback={<AppLoadingShell />}>
  <LocaleProviders>{children}</LocaleProviders>
</Suspense>
```

Keep `getMessages()`, `NextIntlClientProvider`, and `HtmlLangSync`; they remain responsible for request locale and client messages.

- [ ] **Step 5: Run focused and structural checks**

Run:

```bash
pnpm vitest run tests/unit/app-loading-shell.test.ts
pnpm typecheck
pnpm build
```

Expected: all commands exit `0`, and the build still lists `◐ /`.

- [ ] **Step 6: Commit the static shell**

```bash
git add src/components/layout/app-loading-shell.tsx src/app/layout.tsx tests/unit/app-loading-shell.test.ts
git commit -m "perf: paint a static app loading shell"
```

---

### Task 3: Put authenticated layout work behind the shell

**Files:**

- Modify: `src/app/(main)/layout.tsx`
- Test: `tests/e2e/smoke.spec.ts` (existing authentication and dashboard checks)

**Interfaces:**

- Consumes: `getSession()`, `cookies()`, `AppLoadingShell`, and `DashboardSkeleton`.
- Produces: synchronous `MainLayout` with a static Suspense fallback and async `AuthenticatedMainLayout` containing protected UI.

- [ ] **Step 1: Run the existing mobile auth/dashboard checks before the change**

Run:

```bash
pnpm exec playwright test tests/e2e/smoke.spec.ts --project="Mobile Chrome" --grep "unauthenticated|dashboard renders"
```

Expected: 2 tests pass.

- [ ] **Step 2: Split the protected layout from its static fallback**

Replace the current async default layout and `SidebarWithSession` helper with this structure; keep the existing provider and navigation JSX inside `AuthenticatedMainLayout`:

```tsx
async function AuthenticatedMainLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  if (!session?.user?.id) redirect("/login?stale-session=1");

  const defaultCollapsed = cookieStore.get("asset-tracker:sidebar-collapsed")?.value === "1";

  return (
    <div className="contents">
      <DensityProvider>
        <PrivacyModeProvider>
          <LargeTitleProvider>
            <PullToRefreshProvider>
              <Sidebar
                userImage={session.user.image ?? null}
                userName={session.user.name ?? null}
                defaultCollapsed={defaultCollapsed}
                appVersion={APP_VERSION}
              />
              <PullToRefreshIndicator />
              <MobileMainShell>
                <MobileHeader />
                <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
              </MobileMainShell>
              <MobileNav />
              <LazyCommandPalette />
            </PullToRefreshProvider>
          </LargeTitleProvider>
        </PrivacyModeProvider>
      </DensityProvider>
    </div>
  );
}

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense
      fallback={
        <AppLoadingShell>
          <DashboardSkeleton />
        </AppLoadingShell>
      }
    >
      <AuthenticatedMainLayout>{children}</AuthenticatedMainLayout>
    </Suspense>
  );
}
```

Add imports for `AppLoadingShell` and `DashboardSkeleton`. Remove the nested sidebar Suspense boundary and its fallback: the authenticated layout now has the session data already, so a second session-rendering component adds no value.

- [ ] **Step 3: Run authentication, dashboard, type, and build checks**

Run:

```bash
pnpm exec playwright test tests/e2e/smoke.spec.ts --project="Mobile Chrome" --grep "unauthenticated|dashboard renders"
pnpm typecheck
pnpm build
```

Expected: 2 Playwright tests pass, typecheck exits `0`, and the build lists `◐ /`.

- [ ] **Step 4: Commit the protected-layout change**

```bash
git add 'src/app/(main)/layout.tsx'
git commit -m "perf: stream the authenticated layout behind its shell"
```

---

### Task 4: Lock in the all-charts initial-load contract

**Files:**

- Modify: `src/components/dashboard/trend-chart.tsx`
- Modify: `src/components/history/history-heatmap.tsx`
- Modify: `src/components/dashboard/allocation-chart.tsx`
- Modify: `src/components/dashboard/currency-exposure-chart.tsx`
- Modify: `src/components/analysis/portfolio-heatmap.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**

- Consumes: the current dashboard chart components and authenticated E2E fixture.
- Produces: stable chart-root test IDs: `trend-chart`, `history-heatmap`, `allocation-chart`, `currency-exposure-chart`, and `portfolio-heatmap`.

- [ ] **Step 1: Extend the dashboard smoke test and verify it fails**

Append these assertions to the existing dashboard test in `tests/e2e/smoke.spec.ts`:

```ts
for (const testId of [
  "trend-chart",
  "history-heatmap",
  "allocation-chart",
  "currency-exposure-chart",
  "portfolio-heatmap",
]) {
  await expect(page.getByTestId(testId)).toBeAttached({ timeout: 15_000 });
}
```

Run:

```bash
pnpm exec playwright test tests/e2e/smoke.spec.ts --project="Mobile Chrome" --grep "dashboard renders"
```

Expected: FAIL because the five chart roots do not yet expose these test IDs.

- [ ] **Step 2: Add stable IDs to the existing chart roots**

Make only these attribute changes; do not alter imports, dynamic boundaries, data flow, or rendering conditions:

```tsx
// trend-chart.tsx
<Card data-testid="trend-chart" className="relative h-full flex flex-col pb-0">

// history-heatmap.tsx
<div
  data-testid="history-heatmap"
  className={cn(
    "w-full transition-[filter] duration-300",
    privacyMode && "blur-sm pointer-events-none select-none",
  )}
  aria-hidden={privacyMode || undefined}
>

// allocation-chart.tsx
<Card data-testid="allocation-chart">

// currency-exposure-chart.tsx
<Card data-testid="currency-exposure-chart">

// portfolio-heatmap.tsx
<Card data-testid="portfolio-heatmap" size={isCompact ? "sm" : "default"} style={heatmapStyle}>
```

- [ ] **Step 3: Run the chart contract on Mobile Chrome**

Run:

```bash
pnpm exec playwright test tests/e2e/smoke.spec.ts --project="Mobile Chrome" --grep "dashboard renders"
```

Expected: 1 test passes and all five chart roots attach within 15 seconds.

- [ ] **Step 4: Commit the chart contract**

```bash
git add src/components/dashboard/trend-chart.tsx src/components/history/history-heatmap.tsx src/components/dashboard/allocation-chart.tsx src/components/dashboard/currency-exposure-chart.tsx src/components/analysis/portfolio-heatmap.tsx tests/e2e/smoke.spec.ts
git commit -m "test: require every dashboard chart on initial load"
```

---

### Task 5: Verify performance and the Fluid CPU ceiling

**Files:**

- Verify only; change code only to correct a failed gate.

**Interfaces:**

- Consumes: `/tmp/dashboard-route-before.json`, the finished production build, Vercel baseline metrics, and the existing test suites.
- Produces: an acceptance decision; no new runtime behavior.

- [ ] **Step 1: Run the local quality gates**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec playwright test tests/e2e/smoke.spec.ts --project="Mobile Chrome" --grep "unauthenticated|dashboard renders"
pnpm build
```

Expected: every command exits `0`; the build lists `◐ /`.

- [ ] **Step 2: Compare the dashboard route assets**

Run:

```bash
node scripts/ci/dashboard-route-assets.mjs --write /tmp/dashboard-route-after.json
node -e 'const fs=require("node:fs");const before=JSON.parse(fs.readFileSync("/tmp/dashboard-route-before.json"));const after=JSON.parse(fs.readFileSync("/tmp/dashboard-route-after.json"));if(after.totalGzipBytes>before.totalGzipBytes){console.error({before,after});process.exit(1)}console.log({before,after})'
node scripts/ci/bundle-size.mjs --write /tmp/all-route-assets-after.json
```

Expected: the comparison exits `0`; dashboard-route gzip bytes do not increase. The aggregate measurement is retained for the existing CI gate.

- [ ] **Step 3: Compare repeatable mobile loading metrics**

Use fresh browser contexts and an empty HTTP cache for each run. Collect five dashboard loads in each target browser:

- Android Chrome: Pixel 7 viewport, 4× CPU slowdown, 1.6 Mbps download, 750 Kbps upload, and 150 ms round-trip latency.
- iPhone Safari: iPhone 13/WebKit viewport with the macOS Network Link Conditioner set to the same bandwidth and latency values. WebKit has no equivalent CPU throttle, so compare it only against its own before measurement.

For each browser, compare median FCP, LCP, main-thread blocking time, request count, and transferred bytes against its matching baseline. Use the Performance panel's hard-reload recording so cached runs are excluded.

Expected: FCP and LCP improve beyond run-to-run variance; CLS and interaction readiness do not regress; all charts still attach.

- [ ] **Step 4: Enforce the Vercel release gate**

After the standard preview/production deployment receives an equivalent traffic window, compare `/` against the Task 1 baseline.

Expected:

- Fluid CPU time per invocation is at or below baseline.
- Function invocation count is at or below baseline for equivalent traffic.
- Mobile Speed Insights FCP/LCP improve, with no INP or CLS regression.

If either CPU measure increases, do not merge/release. Inspect the changed request path and remove the added work; do not compensate with a background warmer or broader cache.

- [ ] **Step 5: Commit only if verification required a corrective edit**

```bash
git status --short
```

Expected: clean worktree. If a gate required a correction, rerun the failed gate and commit only that correction with a message naming the measured regression.
