# UI/UX Suggestions

Recommendations for making the mobile experience feel like a native iOS app, plus desktop polish. Prioritized; cross-references the relevant files in this repo.

## Mobile / iOS-native feel (biggest wins first)

### 1. Large-title navigation bar (iOS 11+ pattern) — ✅ Done

`src/components/layout/mobile-header.tsx` + `src/components/layout/large-title-heading.tsx`

- `LargeTitleHeading` replaces the page-level `<h2>` on all 5 main pages. It renders as `text-4xl` on mobile (≈36 px, close to iOS 34 pt) and the existing `text-3xl` on desktop.
- An `IntersectionObserver` (with `-64px` top `rootMargin` to account for the sticky bar) drives `LargeTitleContext.isVisible`.
- `MobileHeader` reads that flag: logo + app-name fade out and a small centred page title fades in as the user scrolls. The separator border appears only once the large title has collapsed (mirrors iOS behaviour).
- `LargeTitleProvider` (in `(main)/layout.tsx`) resets `isVisible = true` on every route change so detail pages without a `LargeTitleHeading` always show the logo.

### 2. Inset-grouped lists, not tables — ✅ Done

iOS Settings/Stocks-style:

- Rounded 16–22px cards.
- Group rows inside.
- Faint hairline dividers between rows (1px, 60% opacity).
- Uppercase tracked-out section headers above each group ("ASSETS", "LIABILITIES").
- Right-aligned chevrons (`ChevronRight` 14px, muted) on tappable rows.

Candidates: `src/components/dashboard/accounts-summary.tsx`, `src/components/accounts/holding-row.tsx`.

> `accounts-summary.tsx`: rounded-2xl cards, hairline dividers `h-px bg-border/60`, uppercase `tracking-widest` headers, ChevronRight icons. Container (`rounded-2xl overflow-hidden border border-border/40`) and hairline dividers also applied in `account-detail.tsx`. `holding-row.tsx` rows now have `hover:bg-muted/40 active:bg-muted/60 transition-colors` for consistent interactive feedback.

### 3. Bottom sheets instead of centered dialogs — ✅ Done

On mobile, swap account/holding/transaction *Dialogs* for sheets that slide up from the bottom with a drag handle and swipe-to-dismiss. shadcn has a `Sheet` (Vaul) primitive — use `side="bottom"` with rounded top corners. This is the single most jarring "this is a website" moment in the current flow.

Candidates: `src/components/accounts/holding-form.tsx`, `src/components/accounts/edit-holding-dialog.tsx`, `src/components/accounts/account-form.tsx`.

### 4. Tab bar polish — ⚠️ Partial

The bottom nav at `src/components/layout/sidebar.tsx:129` is close. Two tweaks:

- **Filled vs. outline** icons for active/inactive (iOS tab bars do this, not just color). Lucide doesn't ship filled variants — pair with a tiny pill background `bg-primary/10` behind the active icon, drop the top indicator bar.
- Slightly increase tap targets to ~48×48 and reduce label size to 10–11px uppercase tracking.

> Active state currently uses a top indicator bar (`absolute inset-x-2 -top-3 h-0.5 bg-primary`, sidebar.tsx:152) rather than a pill background. Icon tap targets are ~20px (h-5 w-5), below the 48×48 recommendation.

### 5. Haptics + spring motion — ✅ Done

- On tap of nav items, refresh, privacy toggle, sheet open: call `navigator.vibrate?.(10)` for a soft tick.
- Prefer spring curves (`cubic-bezier(0.34, 1.56, 0.64, 1)`) over linear `duration-200`.
- The count-up on net worth is great; consider **ease-out cubic** so it decelerates the way iOS does.

> `src/lib/haptics.ts` exposes `hapticTick()` (`navigator.vibrate?.(10)`). Called in: `togglePrivacyMode` (covers sidebar + mobile header), `MobileNav` link `onClick`, `handleRefreshPrices`, and pull-to-refresh threshold crossing. Spring curve (`--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`) and expo ease-out (`--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`) added to `@theme inline` in `globals.css`. Nav item, icon, and header transitions updated to use `ease-spring` / `ease-out-expo`. Count-up hook changed from `easeOutExpo` to `easeOutCubic` (`1 - (1 - t)³`).

### 6. Pull-to-refresh native feel — ⚠️ Partial

`src/components/dashboard/dashboard-pull-refresh.tsx` exists — make sure it:

- Has a real rubber-band overscroll on iOS (`overscroll-behavior: contain` on the scroll container, plus a transform-based offset).
- Shows a circular progress that *fills* as you pull (not a spinner that appears at threshold).
- Gives a haptic tick at threshold crossing.

> Rubber-band damped pull (`Math.min(delta * 0.5, MAX_PULL)`) and fill-progress indicator are implemented. Haptic tick at threshold crossing now implemented via `hapticTick()` in `pull-to-refresh.tsx`.

### 7. Status bar / safe areas / chrome — ⚠️ Partial

- Add `<meta name="theme-color">` per color scheme so iOS tints the status bar to match the nav (`oklch(0.14 0.030 200)` dark, `oklch(0.99 0.003 260)` light).
- Confirm `viewport-fit=cover` on the viewport meta and that `pb-safe` covers home-indicator on the bottom nav (it does at `sidebar.tsx:131`). The mobile header should add `pt-safe` too.
- Add `apple-mobile-web-app-capable` + a proper iOS splash so installed-PWA mode looks native.

> `apple-mobile-web-app-capable` (`appleWebApp: { capable: true }`) and `viewport-fit: "cover"` are set in `layout.tsx`. Safe-area env vars applied on mobile header. Missing: `theme-color` meta tag and iOS splash screen configuration.

### 8. iOS typography — ❌ Not Done

- Add `-apple-system, "SF Pro Text", "SF Pro Display"` *before* Geist in the body font stack so when run as PWA on iOS it picks up SF and Dynamic Type.
- Tighten letter-spacing (`-0.02em`) on the big net-worth number — that's the single most "Stocks-app" detail.

### 9. Swipe actions — ✅ Done

On `src/components/accounts/holding-row.tsx`, support a left swipe revealing Edit (blue) / Delete (red) buttons — classic iOS list pattern. Library: `framer-motion`'s `drag="x"` with snap points, ~60 lines of code.

> `framer-motion` added as a dependency. `HoldingRow` wraps its content in a `motion.div` with `drag="x"`, `dragDirectionLock`, and spring snap points. Left-swipe past 40 % of the reveal width (144 px total — two 72 px buttons) snaps open; release below threshold snaps closed. Action buttons (`bg-blue-500` Edit / `bg-destructive` Delete) are absolutely positioned behind the draggable content. A haptic tick fires at threshold crossing via `hapticTick()`. On desktop (≥ sm breakpoint), the three-dot `DropdownMenu` is preserved as a fallback so mouse users retain a non-drag path.

### 10. Disclosure transitions — ✅ Done

When tapping an account in the list to open `/accounts/[id]`, do a slide-from-right transition (Next.js view transitions API works on Safari now). The default cross-fade feels webby.

> `viewTransition: true` added to `next.config.ts` (top-level). Four `@keyframes` rules (`vt-slide-in-from-right`, `vt-slide-out-to-left`, `vt-slide-in-from-left`, `vt-slide-out-to-right`) added to `globals.css` using `html:active-view-transition-type()` selectors and the existing `--ease-out-expo` timing function at 300 ms. Outgoing page translates to −30 % (not −100 %) for the iOS-style parallax reveal. `transitionTypes={['nav-forward']}` added to account-card Links in `accounts-list.tsx` and `accounts-summary.tsx`; `transitionTypes={['nav-back']}` added to the breadcrumb back Link in `account-detail.tsx`. `prefers-reduced-motion` override removes translate and shortens to 150 ms cross-fade. Works in Chrome 125+ and Safari 18.2+; other browsers fall back to instant navigation.

## Desktop (smaller, but high leverage)

- **Command palette (⌘K)** — ✅ Done: global palette now mounted in `(main)/layout.tsx` via `src/components/layout/desktop-command-palette.tsx` with navigation, privacy toggle, and price refresh actions. Base-currency switch remains out of scope for now.
- **Keyboard shortcuts** — ✅ Done: supports `1–5` route shortcuts plus Vim-style `g d`, `g a`, `g h`; also `⌘/Ctrl+K` palette open, `⌘/Ctrl+⇧P` privacy toggle, and `⌘/Ctrl+⇧R` refresh prices.
- **Sticky table headers** — ⚠️ Partial: month headers are now sticky in `src/components/history/history-table.tsx`; `accounts-summary`/transaction history still need full sticky header treatment.
- **Density toggle** — ✅ Done: (Comfortable / Compact) — the current 2xl rounded glass cards eat a lot of vertical space at desktop widths; power users want more density.
- **Hover sparklines** — ❌ Not Done: on holding rows (last-30-day mini chart on hover) — pulls from `PriceCache` history if you start storing it.
- **Sidebar collapse to icons-only** — ✅ Done: desktop sidebar now supports a persisted icons-only mode (`w-[72px]`) with a footer toggle control and localStorage preference (`asset-tracker:sidebar-collapsed`) in `src/components/layout/sidebar.tsx`.

> **Density toggle implementation**: `DensityProvider` (mirroring `PrivacyModeProvider`) wraps the `(main)` layout in `src/components/layout/density-context.tsx`. Preference is persisted to localStorage key `asset-tracker:density` (default `"comfortable"`). The Settings → Preferences section exposes a segmented control (Comfortable / Compact) in `src/components/settings/settings-form.tsx`. Density-aware spacing applied to: `net-worth-card.tsx` (card padding + grid gap), `accounts-summary.tsx` (row padding + section spacing), `holding-row.tsx` (draggable row padding). No DB migration needed — pure client preference.

## Cross-cutting

- **Empty states with art** — ✅ Done: `src/components/dashboard/dashboard-content.tsx:212` has a wallet SVG illustration with `animate-bounce-slow` and a CTA button. Replicate the same pattern for empty accounts / empty history / empty transactions instead of bare text.
- **Skeleton shimmer** — ✅ Done: dashboard skeleton placeholders now use a reusable `.skeleton-shimmer` utility with a left-to-right gradient sweep animation instead of `animate-pulse`.
- **Color depth on the dashboard hero** — ✅ Done: the net-worth hero now renders an animated mesh overlay (`.hero-mesh-positive` / `.hero-mesh-negative`) tinted by day delta direction and layered behind card content.

## Suggested implementation order

1. ✅ Large-title nav + status-bar `theme-color` + safe-area `pt-safe` on mobile header.
2. ✅ Bottom-sheet dialogs for forms.
3. Inset-grouped account/holding lists with disclosure chevrons.
4. Tab-bar pill background + filled-icon pattern.
5. Swipe actions on holding rows.
6. Command palette (desktop).
7. ✅ Sidebar collapse (desktop) + ✅ density toggle (desktop).

## Additional suggestions (Codex review)

### 11. Inline validation + numeric keyboard optimization on forms — ❌ Not Done

Account/holding forms can reduce entry errors and speed by:

- Setting `inputMode="decimal"` / `inputMode="numeric"` on amount, quantity, strike, and fee fields.
- Validating on blur with short helper text below each field (instead of only toast-level error handling).
- Preserving caret position and formatting only on blur for currency fields to avoid jumpy typing.

Targets: `src/components/accounts/account-form.tsx`, `src/components/accounts/holding-form.tsx`, `src/components/accounts/quick-add-holding.tsx`, `src/components/accounts/inline-balance-editor.tsx`.

### 12. Undo-first destructive actions — ❌ Not Done

For delete/remove actions, prefer optimistic removal + "Undo" toast for 4–6 seconds before permanent delete. This is faster than confirmation modals and feels modern/mobile-native.

Targets: holding/account/transaction delete flows in `src/components/accounts/*` and `src/components/history/history-table.tsx`.

### 13. Stronger accessibility defaults (AA baseline) — ⚠️ Partial

- Ensure icon-only controls (privacy, refresh, row actions) always have `aria-label`.
- Add visible focus rings for keyboard users on custom clickable rows/cards (not only buttons/inputs).
- Confirm chart color pairs remain distinguishable in dark mode and for color-vision deficiency.

Targets: `src/components/layout/*`, `src/components/dashboard/*`, `src/components/analysis/*`.

### 14. Reduce perceived latency with optimistic timestamps/data freshness hints — ❌ Not Done

When price refresh or snapshot fetch runs, keep current numbers visible and show a subtle "Updated Xs ago" / "Refreshing…" badge near the hero card and analysis header. Avoid full-region loading state when data already exists.

Targets: `src/components/dashboard/net-worth-card.tsx`, `src/components/dashboard/dashboard-actions.tsx`, `src/components/analysis/analysis-view.tsx`.

### 15. Mobile chart interaction model — ❌ Not Done

Most finance apps feel better when charts support:

- Long-press crosshair with haptic tick when crossing key points.
- Sticky value/date callout that follows the finger.
- Range chips (1W / 1M / 3M / 1Y / All) with preserved selection per page.

Targets: `src/components/dashboard/trend-chart.tsx`, `src/components/analysis/*chart*.tsx`.
