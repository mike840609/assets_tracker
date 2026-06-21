# Loading Skeleton Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve skeleton loading screens with staggered entrance animations, refined shimmer, and consistent Skeleton component usage across all routes.

**Architecture:** Pure CSS approach — add a `.skeleton-stagger` utility reusing existing `list-row-in` keyframes, refine the shimmer gradient for better light/dark-mode contrast, unify `AppLoadingShell` to use the `Skeleton` component, and apply stagger indices to every `loading.tsx`.

**Tech Stack:** CSS custom properties, existing animation tokens (`--duration-normal`, `--ease-out-expo`, `list-row-in` keyframes), React (`style` prop for `--i` variable).

## Global Constraints

- CSS-only — no new JS dependencies or React transition libraries
- All new animations must be gated by `prefers-reduced-motion: reduce` → `animation: none`
- No interference with Next.js Suspense/streaming architecture
- Reuse existing animation vocabulary from `src/app/globals.css`
- Transform/opacity only — compositor-friendly, no layout thrash
- Preserve all existing comments and docstrings unrelated to changes

---

### Task 1: CSS Foundation — Stagger Class, Shimmer Refinement, Dark-Mode Override

**Files:**

- Modify: `src/app/globals.css` (lines 387–410 shimmer block, lines 470–473 stagger area, lines 477–496 reduced-motion block)

**Interfaces:**

- Produces: `.skeleton-stagger` CSS class (consumed by Tasks 2–4), refined `.skeleton-shimmer` gradient, `.dark .skeleton-shimmer` override

- [ ] **Step 1: Add `.skeleton-stagger` class after the existing `.stagger-rise` block**

In `src/app/globals.css`, after line 473 (end of `.stagger-rise` block) and before the reduced-motion media query comment on line 475, add:

```css
/* ─── Skeleton entrance stagger ──────────────────────────────────────────────
   Route skeletons cascade their sections in with short delays so loading
   states feel progressive rather than a simultaneous wall of gray. Reuses
   the list-row-in keyframes with a tighter per-group delay (35ms vs 45ms
   for list rows) since skeleton groups are coarser than individual rows. */
.skeleton-stagger {
  animation: list-row-in var(--duration-normal) var(--ease-out-expo) backwards;
  animation-delay: calc(var(--i, 0) * 35ms);
}
```

- [ ] **Step 2: Refine shimmer gradient for light mode**

In `src/app/globals.css`, replace the `.skeleton-shimmer` rule (lines 400–410) with:

```css
.skeleton-shimmer {
  background-image: linear-gradient(
    90deg,
    transparent 25%,
    color-mix(in oklab, var(--foreground) 8%, transparent) 50%,
    transparent 75%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}
```

Changes: gradient stops `20%/50%/80%` → `25%/50%/75%` (wider band), foreground mix `12%` → `8%` (softer in light mode).

- [ ] **Step 3: Add dark-mode shimmer override**

In `src/app/globals.css`, immediately after the `.skeleton-shimmer` rule (after the closing `}`), add:

```css
.dark .skeleton-shimmer {
  background-image: linear-gradient(
    90deg,
    transparent 25%,
    color-mix(in oklab, var(--foreground) 15%, transparent) 50%,
    transparent 75%
  );
}
```

This gives dark mode a `15%` foreground mix for better visibility against dark muted backgrounds.

- [ ] **Step 4: Add `.skeleton-stagger` to the reduced-motion block**

In `src/app/globals.css`, inside the `@media (prefers-reduced-motion: reduce)` block, find the line that reads:

```css
.history-cell-in,
.history-rise-in,
.stagger-rise {
  animation: none;
}
```

Replace with:

```css
.history-cell-in,
.history-rise-in,
.stagger-rise,
.skeleton-stagger {
  animation: none;
}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npx next build 2>&1 | tail -20`

Expected: Build succeeds without CSS errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add skeleton-stagger class, refine shimmer gradient for light/dark modes"
```

---

### Task 2: Unify AppLoadingShell to Use Skeleton Component

**Files:**

- Modify: `src/components/layout/app-loading-shell.tsx` (all 33 lines)

**Interfaces:**

- Consumes: `Skeleton` from `@/components/ui/skeleton`, `.skeleton-stagger` from Task 1
- Produces: Updated `AppLoadingShell` with consistent shimmer animation

- [ ] **Step 1: Replace inline loading divs with Skeleton component**

Replace the entire content of `src/components/layout/app-loading-shell.tsx` with:

```tsx
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLoadingShell({ children }: { children?: ReactNode }) {
  return (
    <div
      data-app-loading-shell="true"
      aria-hidden="true"
      className="flex min-h-full w-full flex-1 flex-col bg-background"
    >
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 md:hidden">
        <Skeleton className="h-6 w-36 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {children ?? (
          <div className="space-y-4">
            <div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>
              <Skeleton className="h-10 w-48 rounded-lg" />
            </div>
            <div className="skeleton-stagger" style={{ "--i": 1 } as React.CSSProperties}>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div
              className="skeleton-stagger grid grid-cols-2 gap-3"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <Skeleton className="col-span-2 h-32 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-loading-shell.tsx
git commit -m "refactor: unify AppLoadingShell to use Skeleton component with stagger"
```

---

### Task 3: Add Stagger to DashboardSkeleton

**Files:**

- Modify: `src/components/dashboard/dashboard-skeleton.tsx` (lines 141–192, the `DashboardSkeleton` export)

**Interfaces:**

- Consumes: `.skeleton-stagger` from Task 1
- Produces: Updated `DashboardSkeleton` with staggered tier entrance (used by `(main)/loading.tsx` re-export and the layout Suspense fallback)

- [ ] **Step 1: Wrap each tier in a stagger div**

In `src/components/dashboard/dashboard-skeleton.tsx`, replace the `DashboardSkeleton` function body (lines 141–192) with:

```tsx
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div
        className="skeleton-stagger flex items-center justify-between mb-2"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <Skeleton className="h-10 w-48 rounded-lg md:h-9" />
      </div>

      {/* Actions bar */}
      <div className="skeleton-stagger" style={{ "--i": 1 } as React.CSSProperties}>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Net worth cards */}
      <div className="skeleton-stagger" style={{ "--i": 2 } as React.CSSProperties}>
        <NetWorthSkeleton />
      </div>

      {/* Tier 2 — trend chart + heatmap footer (8) beside the planning rail (4):
          goals/projection card over the watchlist card. */}
      <div
        className="skeleton-stagger grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <div className="min-w-0 lg:col-span-8">
          <TrendChartSkeleton />
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4">
          <GoalsCardSkeleton />
          <WatchlistCardSkeleton />
        </div>
      </div>

      {/* Tier 3 — portfolio treemap (8) beside the stacked allocation + currency
          donut rail (4). Source order puts the donuts first so the phone reading
          order (allocation → currency → treemap) is preserved; on desktop the
          col-start values place the treemap left and the donuts right. */}
      <div
        className="skeleton-stagger grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
        <div className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1 [&>*]:min-h-0 [&>*]:flex-1">
          <PortfolioHeatmapSkeleton />
        </div>
      </div>

      {/* Tier 4 — accounts summary (matches AccountsSummarySkeleton) */}
      <div className="skeleton-stagger space-y-3" style={{ "--i": 5 } as React.CSSProperties}>
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard-skeleton.tsx
git commit -m "style: add stagger entrance to DashboardSkeleton tiers"
```

---

### Task 4: Add Stagger to All Route Loading Pages

**Files:**

- Modify: `src/app/(main)/accounts/loading.tsx`
- Modify: `src/app/(main)/accounts/[id]/loading.tsx`
- Modify: `src/app/(main)/analysis/loading.tsx`
- Modify: `src/app/(main)/goals/loading.tsx`
- Modify: `src/app/(main)/history/loading.tsx`
- Modify: `src/app/(main)/projections/loading.tsx`
- Modify: `src/app/(main)/settings/loading.tsx`
- Modify: `src/app/(main)/stocks/loading.tsx`

**Interfaces:**

- Consumes: `.skeleton-stagger` from Task 1

Each loading page wraps its top-level visual groups with `className="skeleton-stagger"` and an incrementing `--i` variable. The pattern is consistent across all files:

1. Title gets `--i: 0`
2. Toolbar/controls get `--i: 1`
3. First content section gets `--i: 2`
4. Subsequent sections increment from there
5. Cap at `--i: 5-6` maximum to keep total stagger under ~210ms

Below are the exact changes for each file.

#### 4a. `accounts/loading.tsx`

- [ ] **Step 1: Add stagger to accounts loading**

Replace `src/app/(main)/accounts/loading.tsx` with:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <Skeleton className="h-10 md:h-9 w-32 rounded-lg" />
      </div>

      {/* Toolbar */}
      <div
        className="skeleton-stagger flex items-center justify-between"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        <div className="skeleton-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          <Skeleton className="h-5 w-16" />
        </div>

        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="skeleton-stagger rounded-xl border border-border/50 overflow-hidden"
            style={{ "--i": 3 + i } as React.CSSProperties}
          >
            <div className="px-5 py-4 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>

            <div className="px-4 py-4 space-y-3 bg-background/50">
              {[...Array(i === 0 ? 2 : 1)].map((_, j) => (
                <div key={j} className="rounded-lg border border-border/40 p-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  {i !== 0 && (
                    <div className="mt-3 space-y-2">
                      {[...Array(2)].map((_, k) => (
                        <div
                          key={k}
                          className="flex justify-between py-1.5 border-t border-border/30 first:border-0"
                        >
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3.5 w-16" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4b. `accounts/[id]/loading.tsx`

- [ ] **Step 2: Add stagger to account detail loading**

Replace `src/app/(main)/accounts/[id]/loading.tsx` with:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountDetailLoading() {
  return (
    <div className="md:flex md:gap-6 md:items-start">
      {/* Nav panel — desktop only, mirrors AccountsNavPanel (w-44 xl:w-52) */}
      <aside
        className="skeleton-stagger hidden md:flex flex-col w-44 xl:w-52 shrink-0 gap-2 pt-0.5"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <Skeleton className="h-3 w-16 mx-2 mb-1" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
        <Skeleton className="h-3 w-20 mx-2 mt-3 mb-1" />
        {[...Array(2)].map((_, i) => (
          <Skeleton key={`l-${i}`} className="h-8 w-full rounded-lg" />
        ))}
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        {/* Header: back button + account name */}
        <div
          className="skeleton-stagger flex items-center gap-3"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-10 md:h-9 w-48 rounded-lg" />
        </div>

        {/* Account summary card */}
        <div
          className="skeleton-stagger rounded-xl border border-border/50 bg-card p-6 space-y-4"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Holdings table */}
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4c. `analysis/loading.tsx`

- [ ] **Step 3: Add stagger to analysis loading**

In `src/app/(main)/analysis/loading.tsx`, make 5 targeted edits to wrap the major sections with stagger classes. Replace the function body's opening `<div>` children:

1. Title line (`<Skeleton className="h-10 md:h-9 w-32 rounded-lg" />`): wrap in `<div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>`
2. The sticky toolbar `<div className="sticky ...">`: add `skeleton-stagger` to className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. The lead balance-sheet `<Card size="sm" ...>`: wrap in `<div className="skeleton-stagger" style={{ "--i": 2 } as React.CSSProperties}>`
4. The secondary charts grid `<div className="space-y-4">` (containing Movement + Composition): wrap in `<div className="skeleton-stagger" style={{ "--i": 3 } as React.CSSProperties}>`
5. The top movers `<Card>`: wrap in `<div className="skeleton-stagger" style={{ "--i": 4 } as React.CSSProperties}>`

#### 4d. `goals/loading.tsx`

- [ ] **Step 4: Add stagger to goals loading**

In `src/app/(main)/goals/loading.tsx`, make 4 targeted edits:

1. Title Skeleton: wrap in `<div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>`
2. Mobile tab switcher `<div className="md:hidden flex border-b">`: add `skeleton-stagger` to className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. Subtitle + Add button row: add `skeleton-stagger` to className, add `style={{ "--i": 2 } as React.CSSProperties}`
4. Each goal card in the `.map()`: change className to include `skeleton-stagger`, set `style={{ "--i": 3 + i } as React.CSSProperties}` (capped at 3 cards → max `--i: 5`)

#### 4e. `history/loading.tsx`

- [ ] **Step 5: Add stagger to history loading**

In `src/app/(main)/history/loading.tsx`, make 3 targeted edits:

1. Title row: add `skeleton-stagger` to the flex wrapper className, add `style={{ "--i": 0 } as React.CSSProperties}`
2. Hero row (trend + rail grid): add `skeleton-stagger` to the grid className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. History ledger section: add `skeleton-stagger` to the flex-col wrapper className, add `style={{ "--i": 2 } as React.CSSProperties}`

#### 4f. `projections/loading.tsx`

- [ ] **Step 6: Add stagger to projections loading**

In `src/app/(main)/projections/loading.tsx`, make 5 targeted edits:

1. Title Skeleton: wrap in `<div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>`
2. Header row (subtitle + value-lens): add `skeleton-stagger` to className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. Verdict band: add `skeleton-stagger` to className, add `style={{ "--i": 2 } as React.CSSProperties}`
4. Cockpit grid (assumptions + chart): add `skeleton-stagger` to className, add `style={{ "--i": 3 } as React.CSSProperties}`
5. Milestones timeline: add `skeleton-stagger` to className, add `style={{ "--i": 4 } as React.CSSProperties}`

The collapsible guide (last element) can share `--i: 5` or be left unstaggered since it's below the fold.

#### 4g. `settings/loading.tsx`

- [ ] **Step 7: Add stagger to settings loading**

In `src/app/(main)/settings/loading.tsx`, make 5 targeted edits:

1. Title Skeleton: wrap in `<div className="skeleton-stagger" style={{ "--i": 0 } as React.CSSProperties}>`
2. Preferences section: add `skeleton-stagger` to className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. Synchronization section: add `skeleton-stagger` to className, add `style={{ "--i": 2 } as React.CSSProperties}`
4. Privacy and security section: add `skeleton-stagger` to className, add `style={{ "--i": 3 } as React.CSSProperties}`
5. Data management section: add `skeleton-stagger` to className, add `style={{ "--i": 4 } as React.CSSProperties}`

The install app card can share `--i: 5`.

#### 4h. `stocks/loading.tsx`

- [ ] **Step 8: Add stagger to stocks loading**

In `src/app/(main)/stocks/loading.tsx`, make 3 targeted edits:

1. Title block `<div className="space-y-2">`: add `skeleton-stagger` to className, add `style={{ "--i": 0 } as React.CSSProperties}`
2. Toolbar row: add `skeleton-stagger` to className, add `style={{ "--i": 1 } as React.CSSProperties}`
3. Each stock card in the `.map()`: add `skeleton-stagger` to the Card wrapper, set `style={{ "--i": 2 + item } as React.CSSProperties}`

- [ ] **Step 9: Verify build**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/app/\(main\)/accounts/loading.tsx \
        src/app/\(main\)/accounts/\[id\]/loading.tsx \
        src/app/\(main\)/analysis/loading.tsx \
        src/app/\(main\)/goals/loading.tsx \
        src/app/\(main\)/history/loading.tsx \
        src/app/\(main\)/projections/loading.tsx \
        src/app/\(main\)/settings/loading.tsx \
        src/app/\(main\)/stocks/loading.tsx
git commit -m "style: add stagger entrance animation to all route loading skeletons"
```

---

### Task 5: Visual Verification & Final Commit

**Files:**

- None new — verification only

- [ ] **Step 1: Start dev server and verify visually**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npm run dev`

Manually verify in browser:

1. Navigate to `/` — dashboard skeleton should cascade title → actions → net worth → trend+rail → portfolio+donuts → accounts summary
2. Navigate to `/accounts` — skeleton sections should stagger in
3. Toggle dark mode in browser devtools — shimmer highlight should be more visible than before
4. Enable `prefers-reduced-motion: reduce` in devtools — all animations should be disabled, skeleton blocks should appear immediately with no stagger or shimmer
5. Check mobile viewport — stagger should still work, AppLoadingShell header should use shimmer

- [ ] **Step 2: Stop dev server and verify production build**

Run: `cd /Users/chuntsai/Projects/asset_tracker-wt-20260621-antigravity && npx next build 2>&1 | tail -30`

Expected: Build succeeds with no errors or warnings related to the changes.
