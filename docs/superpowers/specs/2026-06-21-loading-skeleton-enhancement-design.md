# Loading Skeleton Enhancement — Design Spec

**Date:** 2026-06-21
**Approach:** CSS-only (Approach A)

## Goal

Improve the existing skeleton loading screens across all routes so they feel alive, progressive, and native rather than presenting a static "wall of gray." All changes are CSS-only, reusing the existing animation vocabulary in `globals.css`.

## Scope

Five workstreams, ordered by impact:

### 1. Staggered Skeleton Entrance

**Problem:** All skeleton blocks appear simultaneously — title, cards, charts, tables all pop in at t=0.

**Solution:** Apply a stagger-rise entrance animation to skeleton groups using CSS custom properties.

**Mechanism:**
- Add a new `.skeleton-stagger` utility class in `globals.css` that reuses the existing `list-row-in` keyframes (`opacity: 0 → 1, translateY(8px → 0)`)
- Each major skeleton section receives an incrementing `--i` CSS variable
- Stagger delay: `calc(var(--i, 0) * 35ms)` — subtle 35ms per group
- Duration: `var(--duration-normal)` (~200ms), easing: `var(--ease-out-expo)`
- `animation-fill-mode: backwards` so elements are invisible during their stagger delay
- Gated by `prefers-reduced-motion: reduce` → `animation: none` (already handled in the existing media query block)

**Application pattern per loading.tsx:**
```tsx
// Each top-level section gets a stagger index
<div className="skeleton-stagger" style={{ '--i': 0 } as React.CSSProperties}>
  <Skeleton className="h-10 w-48 rounded-lg" /> {/* Title */}
</div>
<div className="skeleton-stagger" style={{ '--i': 1 } as React.CSSProperties}>
  <Skeleton className="h-10 w-full rounded-lg" /> {/* Actions bar */}
</div>
<div className="skeleton-stagger" style={{ '--i': 2 } as React.CSSProperties}>
  <NetWorthSkeleton /> {/* Hero cards */}
</div>
```

**Stagger grouping:** Group by visual tier, not individual elements. For example, the dashboard groups as: title (0) → actions bar (1) → net worth cards (2) → trend+rail (3) → portfolio+donuts (4) → accounts summary (5). This keeps the total stagger budget under ~200ms so the page never feels slow to fill.

### 2. Improved Shimmer Animation

**Problem:** The current shimmer uses `color-mix(in oklab, var(--foreground) 12%, transparent)` — too subtle, especially in dark mode where the muted background and foreground are closer in value.

**Changes in `globals.css`:**

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

**Dark mode override** (inside the existing `.dark` block):
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

Changes:
- Light mode: `12% → 8%` — slightly softer, less "dirty" feel
- Dark mode: explicit `15%` — more visible against dark muted backgrounds
- Gradient stops: `20%/50%/80% → 25%/50%/75%` — slightly wider highlight band for smoother sweep

### 3. Skeleton → Content Transition

**Problem:** When Suspense resolves, the skeleton is hard-cut replaced with content. The content already has `animate-in fade-in duration-200`, but the skeleton disappears instantly.

**Approach:** This is constrained by how Next.js streaming/Suspense works — we can't animate the removal of the fallback because React unmounts it. However, the content entrance animation (`animate-in fade-in`) already provides a soft arrival. 

**Enhancement:** Ensure every page's content wrapper consistently uses the entrance animation class (`animate-in fade-in duration-200`). Audit each `page.tsx` to confirm this is present. Where missing, add it. This creates the illusion of a crossfade because:
- Skeleton is visible → skeleton disappears (instant, but the next frame renders…)
- Content fades in over 200ms → perceived as a smooth transition

No additional CSS needed for this workstream — just consistency enforcement.

### 4. AppLoadingShell Unification

**Problem:** `AppLoadingShell` uses inline `animate-pulse bg-muted` divs instead of the `Skeleton` component, so it misses the shimmer gradient and has inconsistent animation style.

**Solution:** Replace all inline loading divs in `AppLoadingShell` with `<Skeleton>` component usage, matching the same structural pattern as `DashboardSkeleton` (since `AppLoadingShell` wraps `DashboardSkeleton` in the main layout's Suspense fallback).

**File:** `src/components/layout/app-loading-shell.tsx`

Replace:
```tsx
<div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
```
With:
```tsx
<Skeleton className="h-10 w-48 rounded-lg" />
```

Apply stagger-rise to the shell's children too, so even the very first paint (before layout loads) has the cascading entrance.

### 5. Per-Route Skeleton Polish

Audit each `loading.tsx` to ensure structural fidelity to its page. Apply stagger-rise to each. Known issues to address:

| Route | Issue | Fix |
|-------|-------|-----|
| All routes | No stagger animation | Add `skeleton-stagger` with `--i` per section |
| `(main)/loading.tsx` | Re-exports `DashboardSkeleton` — no stagger | Add stagger in `DashboardSkeleton` |
| `accounts/loading.tsx` | Good structure | Add stagger |
| `accounts/[id]/loading.tsx` | Good structure | Add stagger |
| `analysis/loading.tsx` | Good structure, detailed | Add stagger |
| `goals/loading.tsx` | Good structure | Add stagger |
| `history/loading.tsx` | Good structure | Add stagger |
| `projections/loading.tsx` | Good structure, detailed | Add stagger |
| `settings/loading.tsx` | Good structure, detailed | Add stagger |
| `stocks/loading.tsx` | Good structure | Add stagger |
| `app-loading-shell.tsx` | Uses inline `animate-pulse` divs, not `Skeleton` | Unify to use `Skeleton` component + stagger |

## Files Changed

1. **`src/app/globals.css`** — Add `.skeleton-stagger` class, adjust shimmer gradient, add dark-mode shimmer override
2. **`src/components/layout/app-loading-shell.tsx`** — Replace inline divs with `Skeleton`, add stagger
3. **`src/components/ui/skeleton.tsx`** — No changes needed (already uses `skeleton-shimmer`)
4. **`src/components/dashboard/dashboard-skeleton.tsx`** — Add stagger to tier groups
5. **`src/app/(main)/accounts/loading.tsx`** — Add stagger
6. **`src/app/(main)/accounts/[id]/loading.tsx`** — Add stagger
7. **`src/app/(main)/analysis/loading.tsx`** — Add stagger
8. **`src/app/(main)/goals/loading.tsx`** — Add stagger
9. **`src/app/(main)/history/loading.tsx`** — Add stagger
10. **`src/app/(main)/projections/loading.tsx`** — Add stagger
11. **`src/app/(main)/settings/loading.tsx`** — Add stagger
12. **`src/app/(main)/stocks/loading.tsx`** — Add stagger

## Constraints

- **CSS-only:** No new JS dependencies, no React transition libraries
- **Reduced motion:** All new animations gated by `prefers-reduced-motion: reduce` → `animation: none`
- **Streaming-safe:** No interference with Next.js Suspense/streaming architecture
- **Existing vocabulary:** Reuses `list-row-in` keyframes, `--duration-normal`, `--ease-out-expo` tokens
- **Performance:** Transform/opacity only — compositor-friendly, no layout thrash
- **Bundle impact:** Zero — CSS additions only

## Non-Goals

- View Transitions API integration (browser support insufficient)
- React transition library adoption (unnecessary complexity)
- Skeleton content changes (structure already matches pages well)
- New skeleton components for routes that don't have them (all routes already covered)
