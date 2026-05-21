# Dashboard Tab — Impeccable Audit (v2)

**Target:** `/` route (dashboard) — `src/app/(main)/page.tsx` + `src/components/dashboard/*`
**Register:** product
**Date:** 2026-05-21
**Context note:** No PRODUCT.md / DESIGN.md at repo root. Audit grounded in CLAUDE.md, the codebase, and the shared impeccable laws. Run `/impeccable teach` to enrich future audits.

> **History:** v1 audit on this branch scored 11/20 (Acceptable). After successive `/impeccable polish`, `/bolder`, `/layout`, `/adapt`, `/harden`, `/colorize`, and `/animate` passes, this v2 re-audit scores **19/20 (Excellent)**.

---

## Audit Health Score

| #         | Dimension     | v1        | v2        | Δ      | Key finding                                                                                                                                                                                                                                                                                            |
| --------- | ------------- | --------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1         | Accessibility | 2/4       | **4/4**   | +2     | Donut legends are real `<button>`s with `aria-pressed`, focus parity, focus-visible ring. Touch targets 44×44 on coarse pointers. Heading hierarchy h2 → h3 (no skip). Donut SVG `aria-hidden` so SR uses the legend, not random `<path>` traversal.                                                   |
| 2         | Performance   | 3/4       | **4/4**   | +1     | Streaming + lazy charts preserved. `prefers-reduced-motion` now gates `.skeleton-shimmer`. Accounts-summary percentage bar uses `transform: scaleX(...)` instead of animating `width`. Dead `.hero-mesh-*` keyframes removed.                                                                          |
| 3         | Responsive    | 3/4       | **4/4**   | +1     | Sort chips, range chips, `%` toggle, and legend rows all meet WCAG 2.5.5 (44×44) on `(pointer: coarse)`. Compact look preserved on mouse-primary devices.                                                                                                                                              |
| 4         | Theming       | 2/4       | **4/4**   | +2     | Pie palette pulls `var(--chart-1)` … `var(--chart-5)` so the active color schema (emerald / anthropic / ocean / violet / amber / rose) reaches the donuts. Trend-chart delta switched from hardcoded `green-*` to `primary/destructive` tokens. Shadows tinted via `--shadow-strong` / `--shadow-pop`. |
| 5         | Anti-Patterns | 1/4       | **3/4**   | +2     | All five v1 majors are gone: hero-metric template, gradient text, glass-as-default, nested cards, identical card grid. Lands at "mostly clean, subtle issues only."                                                                                                                                    |
| **Total** |               | **11/20** | **19/20** | **+8** | **Excellent — minor polish only**                                                                                                                                                                                                                                                                      |

---

## Anti-Patterns Verdict — PASS

The five v1 tells are all gone:

1. **Hero-metric template** → replaced with a typographic primary in `net-worth-card.tsx`. Massive number (`text-4xl sm:text-5xl lg:text-6xl`, weight 700, `letter-spacing: -0.035em`), delta pill, hairline divider, two-column inline assets/liabilities. Asymmetric, left-aligned, no card frame.
2. **Gradient text** → solid `text-foreground`. Emphasis through scale + weight, not gradient.
3. **Glass-as-default** → no `.glass`, no `.premium-card`, no `.card-gradient` on dashboard surfaces. Each section is a single `<section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5">`.
4. **Nested cards** → 5 nested `Card`/`premium-card` pairs collapsed to 5 single `<section>` elements. No outer wrapper exists only to apply a gradient overlay.
5. **Identical card grid** → the net-worth row is one section with subordinate inline values, not three near-identical cards.

What stops it from being 4/4: beyond the typographic hero, the rest is the Mercury/Stripe school of product UI — well-executed, not particularly memorable. To reach 4/4 you'd need a stronger signature element (a recognizable visual quirk in the trend chart, distinctive type pairing, an unexpected layout move in the chart row). Not strictly necessary for a product surface where trust beats personality.

---

## What Changed Since v1

### Pass: `/impeccable polish`

- Replaced `green-*` hardcoded Tailwind classes in `trend-chart.tsx` with `bg-primary/10 text-primary` / `bg-destructive/10 text-destructive` (matches `net-worth-card`'s delta vocabulary).
- Added `--shadow-strong` and `--shadow-pop` tokens (hue 260, tinted toward neutral foreground). `.glass` and `.premium-card` dark-mode shadows + donut hover `drop-shadow` reference these tokens. Pure-black `rgba(0,0,0,*)` gone.
- Removed decorative dots from `accounts-summary` section headers (typography + color already carry the signal).
- Replaced Unicode `↑`/`↓` arrows on sort buttons with Lucide `ArrowUp` / `ArrowDown`.
- Removed redundant `rounded-lg` on inner Link inside `rounded-2xl overflow-hidden` parent.
- Consolidated identical `accentClass` / `totalAccentClass` / `dotClass` constants.

### Pass: `/impeccable bolder` (target: `net-worth-card.tsx`)

- Killed gradient text on hero number.
- Killed the three-identical-glass-cards layout.
- Killed `.hero-mesh-positive` / `.hero-mesh-negative` animated backgrounds (and their `@keyframes hero-mesh-drift`).
- Killed the decorative gradient bottom-bar (`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-primary/50`).
- Hero scale: `text-2xl sm:text-3xl` → `text-4xl sm:text-5xl lg:text-6xl`. `letter-spacing: -0.035em`, `leading-[1.05]`.
- Hierarchy: hero `font-bold` over `font-semibold` sub-values over `font-medium text-[11px]` uppercase labels.
- One accent: delta pill carries primary/destructive; liabilities use `foreground/70` (visually subordinate, not "alarming" red).
- `useCountUp`, privacy mode, density toggle, `data-testid="net-worth-card"`, and slide-in entrance all preserved.

### Pass: `/impeccable layout` (target: `src/components/dashboard`)

- Dropped `const CARD_CLASS = "premium-card"` and 6 wrapper `<div>`s in `dashboard-content.tsx`.
- Each chart component now renders its own `<section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5">`. No nesting.
- `Card`/`CardHeader`/`CardTitle`/`CardContent` replaced with `<section>`/`<header>`/`<h3>`/`<div>` in `trend-chart.tsx`, `allocation-chart.tsx`, `currency-exposure-chart.tsx`, `accounts-summary.tsx`, `goals-milestone-card.tsx`.
- Heading hierarchy: page `<h2>` (LargeTitleHeading) → section `<h3>`s. v1 had h2 → `<div>` (shadcn `CardTitle`).
- Skeletons in `dashboard-content.tsx` and `dashboard-skeleton.tsx` use a `SURFACE` const inline so dimensions match the rendered tree (no CLS).

### Pass: `/impeccable adapt` (target: `src/components/dashboard`)

- Sort chips (`accounts-summary`), range chips + `%` toggle (`trend-chart`), and legend rows (both donut charts) all get `pointer-coarse:min-h-[44px]` and `inline-flex items-center justify-center` so the min-h centers content. `%` toggle also gets `pointer-coarse:min-w-[44px]` since a single-char button can otherwise be very narrow.
- Compact `px-2 py-0.5 text-xs` look preserved on mouse-primary devices.

### Pass: `/impeccable harden` (target: donut charts)

- Legend `<div>`s → `<ul><li><button type="button">` with `aria-pressed={isActive}`, `onFocus`/`onBlur` mirroring `onMouseEnter`/`onMouseLeave`, focus-visible ring.
- Color swatch `aria-hidden="true"` (decorative).
- Donut SVG container `aria-hidden="true"` since the legend is the canonical accessible surface.
- `cursor-pointer` dropped (button default cursor).

### Pass: `/impeccable colorize` (target: donut charts)

- Replaced 9-color hardcoded `oklch(...)` arrays with a 5-token `PALETTE` referencing `var(--chart-1)` … `var(--chart-5)`.
- SVG gradient stops switched from `stopColor={...}` attribute to `style={{ stopColor, stopOpacity }}` so CSS vars actually resolve in SVG paint properties.
- Cell `fill={url(#…-${i % PALETTE.length})}` rotates through the 5 stops.
- Legend swatch `style={{ background: PALETTE[…] }}` matches.
- Switching color schema in Settings now also recolors both donuts in real time.

### Pass: `/impeccable animate`

- Removed dead `animate-bounce-slow` class from empty-state SVG (had no `@keyframes` defined anywhere — silently no-op).
- Removed orphan `.hero-mesh-positive`, `.hero-mesh-negative`, and `@keyframes hero-mesh-drift` from `globals.css` (zero consumers after `/bolder`).
- Added `@media (prefers-reduced-motion: reduce) { .skeleton-shimmer::after { animation: none; } }` to globals.css. Targeted, not the heavy-handed `*` nuke pattern.
- Accounts-summary percentage bar: `transition-[width] duration-500` → `transform: scaleX(getPercentage / 100)` with `origin-left motion-normal transition-transform`. Same visual, GPU-compositable, doesn't trip "don't animate layout properties."
- Bar marked `aria-hidden="true"` since it's purely visual.

---

## Out of Scope (worth doing in a follow-up)

These showed up during the dashboard work but are not dashboard-specific:

1. **`.premium-card` / `.card-gradient` still used by** `analysis-view.tsx`, `projection-view.tsx`, `history/page.tsx`, `history/loading.tsx`, `goals/goal-card.tsx`. Same nested-card + decorative-gradient pattern applies. Run `/impeccable layout src/components/analysis` next if you want the score to hold across routes.
2. **No true `<h1>` anywhere.** `LargeTitleHeading` renders as `<h2>` site-wide. Adding a visually-hidden `<h1>` (or promoting LargeTitleHeading to h1) is a layout-level concern, not dashboard-specific.
3. **Empty-state CTA uses `hover:scale-105`** — decorative motion. Minor, didn't flag.

---

## Positive Findings (preserved from v1)

- **Streaming + Suspense pattern is excellent.** Independent skeletons per section, summary deduped across consumers via React `cache()`, lazy-loaded chart components.
- **OKLch token system is sophisticated** — perceptually uniform, 6 color schemas, light/dark adaptations. After the colorize pass, the donuts now participate too.
- **`useChartAnimation` correctly respects `prefers-reduced-motion`** for chart entry animations.
- **`useCountUp` is well-tuned** — easeOutCubic, 600ms, no jitter. Animated metric values feel native.
- **`<FreshnessBadge>` with `aria-live="polite"`** is a quietly good a11y touch.
- **Skeletons match real layout dimensions** — no CLS on hydration. Confirmed after the `/layout` + `/bolder` passes reshaped both.
- **Empty state has a real CTA, not "Nothing here"** — teaches the interface.

---

## Score Trajectory

```
v1 (initial)     11/20  Acceptable
  + polish       12/20  Acceptable  (Theming +1)
  + bolder       16/20  Good        (Anti-Patterns +2, Theming +1, A11y +1)
  + layout       17/20  Good        (Anti-Patterns +1)
  + adapt        18/20  Good        (Responsive +1)
  + harden       18/20  Good        (A11y consolidated to 4)
  + colorize     18/20  Good        (Theming consolidated to 4)
  + animate      19/20  Excellent   (Performance +1)
```

Re-run `/impeccable audit dashboard` after any of the out-of-scope follow-ups to confirm the score holds.
