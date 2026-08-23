# Mobile PWA Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Fix three mobile PWA performance issues: (1) pull-to-refresh React re-renders per touchmove, (2) goals hub blocking Promise.all, (3) recharts bundle duplication across route bundles.

**Architecture:** PTR moves to direct DOM manipulation via refs + rAF batching. Goals hub streams non-default tab data via Suspense boundaries. Recharts duplication resolved by ensuring all chart modules go through lazy dynamic imports (no eager recharts import in route-level components).

**Tech Stack:** Next.js 16 App Router, React 19, Turbopack, Vitest, Tailwind CSS 4.

**Spec:** Issue #705 (High/Medium priority items) at https://github.com/mike840609/assets_tracker/issues/705

## Global Constraints

- Node 24.x, pnpm 11.6.0
- Next.js 16.2.11, React 19.2.4, Turbopack
- Tests: `pnpm vitest run tests/unit/<file>.test.ts`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- No new dependencies
- Preserve hydration safety (server snapshot = false for mobile detection)
- API routes must never be SW-cached (already done in prior task, do not regress)

---

### Task 1: Pull-to-refresh — direct DOM transform + rAF batching

**Files:**

- Modify: `src/components/layout/pull-to-refresh.tsx`
- Modify: `src/components/layout/pull-to-refresh-context.tsx`
- Modify: `src/components/layout/mobile-main-shell.tsx`
- Modify: `src/components/layout/pull-to-refresh-indicator.tsx`
- Test: `tests/unit/pull-to-refresh.test.ts` (create)

**Interfaces:**

- Consumes: existing `HANG_OFFSET = 52` constant from `pull-to-refresh-context.tsx`
- Produces: Context value changes from `{ pull, refreshing, setPull, setRefreshing }` to `{ refreshing, setRefreshing, registerMainRef, registerIndicatorRef }` where:
  - `registerMainRef: (el: HTMLElement | null) => void`
  - `registerIndicatorRef: (el: HTMLElement | null) => void`
- Produces (pure helpers exported from pull-to-refresh.tsx for testing):
  - `dampedPull(deltaY: number): number` — clamped damping math
  - `applyPullTransform(mainEl, indicatorEl, offset, refreshing): void`

**Context:** Currently every touchmove calls setPull(damped), causing React context update that re-renders MobileMainShell and PullToRefreshIndicator on every frame (60-120Hz). The fix: during touchmove, write transform directly to DOM elements via refs, batched with requestAnimationFrame. Only setState at touchend (refresh triggered or reset).

- [ ] **Step 1: Write failing test for pure helpers**

Create `tests/unit/pull-to-refresh.test.ts`. Test these exported functions from `src/components/layout/pull-to-refresh-context.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import { dampedPull } from "@/components/layout/pull-to-refresh";

describe("dampedPull", () => {
  it("returns 0 for negative delta", () => {
    expect(dampedPull(-10)).toBe(0);
  });

  it("returns half of positive delta when below max", () => {
    expect(dampedPull(100)).toBe(50);
  });

  it("caps at MAX_PULL (120)", () => {
    expect(dampedPull(500)).toBe(120);
  });
});
```

And test `applyPullTransform` from same module:

```typescript
describe("applyPullTransform", () => {
  function makeEl() {
    return Object.assign(document.createElement("div"), {
      style: { transform: "", opacity: "" },
    });
  }

  it("sets translateY on main element", () => {
    const main = makeEl();
    const indicator = makeEl();
    applyPullTransform(main as HTMLElement, indicator as HTMLElement, 40, false);
    expect((main as HTMLElement).style.transform).toBe("translateY(40px)");
    expect(indicator.style.opacity).toBe("1");
  });

  it("clears transform when offset is 0", () => {
    const main = makeEl();
    const indicator = makeEl();
    applyPullTransform(main as HTMLElement, indicator as HTMLElement, 0, false);
    expect((main as HTMLElement).style.transform).toBe("");
    expect(indicator.style.opacity).toBe("0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/pull-to-refresh.test.ts`
Expected: FAIL — `dampedPull` and `applyPullTransform` not yet exported

- [ ] **Step 3: Implement**

**`pull-to-refresh-context.tsx`:**
Replace the entire file. New context exposes only `refreshing`, `setRefreshing`, plus two ref registration callbacks. Remove `pull` state entirely.

```typescript
"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
export const HANG_OFFSET = 52;
interface Ctx { refreshing: boolean; setRefreshing: Dispatch<SetStateAction<boolean>>; registerMainRef(el: HTMLElement|null): void; registerIndicatorRef(el: HTMLElement|null): void; getMain(): HTMLElement|null; getIndicator(): HTMLElement|null; }
const Ctx = createContext<Ctx>({ refreshing:false, setRefreshing:()=>{}, registerMainRef:()=>{}, registerIndicatorRef:()=>{}, getMain:()=>null, getIndicator:()=>null });
export const usePTR = () => useContext(Ctx);
export function PTRProvider({children}:{children:React.ReactNode}) {
  const [refreshing, setRefreshing] = useState(false);
  const mainRef = useRef<HTMLElement|null>(null);
  const indicatorRef = useRef<HTMLElement|null>(null);
  const registerMain = useCallback((el:HTMLElement|null)=>{mainRef.current=el;},[]);
  const registerIndicator = useCallback((el:HTMLElement|null)=>{indicatorRef.current=el;},[]);
  const getMain = useCallback(()=>mainRef.current,[]);
  const getIndicator = useCallback(()=>indicatorRef.current,[]);
  const value = useMemo(()=>({refreshing,setRefreshing,registerMainRef:registerMain,registerIndicatorRef:registerIndicator,getMain,getIndicator}),[refreshing]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

**`pull-to-refresh.tsx`:**
Export two pure helpers and rewrite component to use them via refs + rAF:

```typescript
// Exported for testing
export function dampedPull(deltaY: number): number {
  if (deltaY <= 0) return 0;
  return Math.min(deltaY * 0.5, MAX_PULL); // MAX_PULL = 120
}

export function applyPullTransform(
  mainEl: HTMLElement,
  indicatorEl: HTMLElement,
  offset: number,
  _isRefreshing: boolean,
): void {
  if (offset <= 0) {
    mainEl.style.transform = "";
    indicatorEl.style.opacity = "0";
    return;
  }
  mainEl.style.transform = `translateY(${Math.min(offset, HANG_OFFSET)}px)`;
  indicatorEl.style.opacity = String(Math.min(offset / THRESHOLD, 1));
}
```

In the component useEffect onTouchMove callback, replace `setPull(damped)` with:

```typescript
if (!rafId && !reduceMotion) {
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const main = getMain();
    const ind = getIndicator();
    if (main && ind) applyPullTransform(main, ind, currentPull, refreshing);
  });
}
```

On cleanup and touchend, cancel any pending rAF and call `applyPullTransform(getMain(), getIndicator(), 0, false)` to reset.

Remove all calls to `setPull` — it no longer exists.

**`mobile-main-shell.tsx`:**
Replace context consumption. Register the `<main>` element via `registerMainRef` from new context. Remove `pull`/`refreshing` consumption entirely — the shell no longer re-renders during pull.

```tsx
export function MobileMainShell({ children }: { children: React.ReactNode }) {
  const { registerMainRef } = usePTR();
  return (
    <main
      ref={registerMainRef}
      className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+1rem+env(safe-area-inset-bottom))] md:pb-0 relative w-full"
    >
      {children}
    </main>
  );
}
```

**`pull-to-refresh-indicator.tsx`:**
Register its root `<div>` via `registerIndicatorRef`. Keep only `refreshing` from context (for spinner state). Remove `pull` dependency — opacity/transform are now written directly by `applyPullTransform`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/pull-to-refresh.test.ts && pnpm typecheck && pnpm lint`
Expected: ALL PASS

- [ ] **Step 5: Run full unit suite to check for regressions**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/pull-to-refresh.tsx src/components/layout/pull-to-refresh-context.tsx src/components/layout/mobile-main-shell.tsx src/components/layout/pull-to-refresh-indicator.tsx tests/unit/pull-to-refresh.test.ts
git commit -m "perf(mobile): eliminate per-touchmove React re-renders in pull-to-refresh"
```

---

### Task 2: Goals hub — stream non-default tab data via Suspense

**Files:**

- Modify: `src/app/(main)/goals/page.tsx`
- Modify: `src/components/goals/goals-view.tsx`
- Test: `tests/unit/mobile-plan-tabs.test.ts` (existing — verify still passes)

**Interfaces:**

- Consumes: Existing `GoalsView` props interface (unchanged)
- Produces: `goals/page.tsx` splits into three async sub-components wrapped in `<Suspense>`:
  - `<GoalsPanel>` — default tab, rendered eagerly (no Suspense wrapper)
  - `<ProjectionsPanel>` — lazy, wrapped in `<Suspense fallback={<PanelSkeleton />}>`
  - `<CalendarPanel>` — lazy, wrapped in `<Suspense fallback={<PanelSkeleton />}>`
  - `<StocksPanel>` — lazy, wrapped in `<Suspense fallback={<PanelSkeleton />}>`
- Each panel fetches its own data server-side. The page-level `Promise.all` shrinks to fetching shared data (settings, translations, locale) + goals only.

- [ ] **Step 1: Verify existing mobile plan tab tests pass first**

Run: `pnpm vitest run tests/unit/mobile-plan-tabs.test.ts`
Expected: PASS (baseline)

- [ ] **Step 2: Refactor goals/page.tsx into panel components**

Split the current single `GoalsContent` into:

```typescript
async function SharedData({ children }: { children: React.ReactNode }) {
  // Fetch settings, translations, messages, locale
  // Pass via props to children (or render directly)
}

async function ProjectionsData({ userId, baseCurrency }: { userId: string; baseCurrency: string }) {
  const projectionData = await getProjectionData(userId, baseCurrency);
  return projectionData;
}

// Similarly CalendarData, StocksData

// In GoalsContent JSX:
<Suspense fallback={<PanelSkeleton />}>
  <ProjectionsSection userId={userId} baseCurrency={settings.baseCurrency} />
</Suspense>
```

Key changes:

1. Move `getProjectionData`, `getCachedTrackedStocks`, `getCalendarEntriesInRange`, `getCalendarEarnings` out of the top-level `Promise.all` into their respective panel components.
2. Top-level `Promise.all` reduces to: translations, messages, locale, settings, goalsWithProgress.
3. Each mobile-only section wraps in `<Suspense>`.
4. On desktop (md+), all sections render together — Suspense boundaries resolve independently so they appear as data becomes ready.
5. Create a simple `PanelSkeleton` inline component (Card + Skeleton matching each panel's approximate height).

- [ ] **Step 3: Adjust GoalsView props if needed**

If panels are now self-fetching server components, `GoalsView` may need fewer props. However, since GoalsView is already a client component receiving serialized data, the minimal change keeps GoalsView unchanged and instead wraps the data-fetching parts of the page in Suspense. The simplest approach:

Keep `GoalsView` receiving all data but split the page's data fetching so non-goals data resolves in parallel Suspense boundaries rather than blocking the initial HTML response.

Concretely: extract a `GoalsHubPanels` async server component that fetches projections/stocks/calendar data, wrap it in Suspense, and pass resolved data down to GoalsView once ready.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/mobile-plan-tabs.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/goals/page.tsx src/components/goals/goals-view.tsx
git commit -m "perf(goals): stream non-default tab data via Suspense boundaries"
```

---

### Task 3: Recharts bundle deduplication

**Files:**

- Investigate first: `pnpm analyze` output
- Modify: chart barrel file (create if needed)
- Modify: import sites that eagerly import recharts outside lazy wrappers

**Interfaces:**

- Consumes: existing lazy wrappers (`lazy-charts.tsx`, `lazy-analysis-charts.tsx`, `lazy-projection-chart.tsx`)
- Produces: A shared `src/components/charts/recharts-barrel.ts` that re-exports everything needed from recharts. All chart files import from this barrel instead of `"recharts"` directly. Turbopack then treats it as a single chunk.

- [ ] **Step 1: Run bundle analysis to confirm duplication**

Run: `ANALYZE=true pnpm build`
Examine `.next/analyze/nodejs.html` output. Confirm whether recharts appears in multiple route chunks.
Record which route bundles contain duplicate recharts code.

- [ ] **Step 2: Create shared recharts barrel**

Create `src/components/charts/recharts-barrel.ts`:

```typescript
// Single re-entry point for all recharts imports.
// Turbopack treats this as one chunk boundary, preventing duplication
// across route bundles. All chart components must import from here.
export * from "recharts";
export type * from "recharts";
```

Then update every chart file to change:

```diff
-import { AreaChart, Area, ... } from "recharts";
+import { AreaChart, Area, ... } from "@/components/charts/recharts-barrel";
```

Files to update (from grep):

- `src/components/history/daily-change-chart.tsx`
- `src/components/dashboard/allocation-chart.tsx`
- `src/components/dashboard/trend-chart.tsx`
- `src/components/analysis/portfolio-heatmap.tsx`
- `src/components/projections/projection-chart.tsx`
- `src/components/analysis/attribution-chart.tsx`
- `src/components/analysis/cumulative-growth-chart.tsx`
- `src/components/analysis/assets-liabilities-chart.tsx`
- `src/components/analysis/cashflow-chart.tsx`
- `src/components/analysis/return-trend-chart.tsx`
- `src/components/ui/chart.tsx`
- `src/components/analysis/category-trend-chart.tsx`
- `src/components/analysis/drawdown-chart.tsx`
- `src/components/analysis/investment-cost-basis-chart.tsx`

Note: `src/components/ui/chart.tsx` uses `* as RechartsPrimitive` — change to `import * as RechartsPrimitive from "@/components/charts/recharts-barrel"`.

Also add `"@/components/charts/recharts-barrel"` to `experimental.optimizePackageImports` in `next.config.ts` (replacing `"recharts"`).

- [ ] **Step 3: Re-run bundle analysis**

Run: `ANALYZE=true pnpm build`
Verify recharts now appears in a single shared chunk rather than duplicated across routes.
Compare total gzip size before vs after.

- [ ] **Step 4: Run full validation**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/recharts-barrel.ts next.config.ts
git add src/components/history/daily-change-chart.tsx src/components/dashboard/allocation-chart.tsx src/components/dashboard/trend-chart.tsx src/components/analysis/portfolio-heatmap.tsx src/components/projections/projection-chart.tsx src/components/analysis/attribution-chart.tsx src/components/analysis/cumulative-growth-chart.tsx src/components/analysis/assets-liabilities-chart.tsx src/components/analysis/cashflow-chart.tsx src/components/analysis/return-trend-chart.tsx src/components/ui/chart.tsx src/components/analysis/category-trend-chart.tsx src/components/analysis/drawdown-chart.tsx src/components/analysis/investment-cost-basis-chart.tsx
git commit -m "perf(charts): consolidate recharts through shared barrel to prevent Turbopack duplication"
```
