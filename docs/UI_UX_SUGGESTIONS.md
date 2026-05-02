# UI/UX Suggestions

Recommendations for making the mobile experience feel like a native iOS app, plus desktop polish. Prioritized; cross-references the relevant files in this repo.

## Mobile / iOS-native feel (biggest wins first)

### 1. Large-title navigation bar (iOS 11+ pattern) — ❌ Not Done

`src/components/layout/mobile-header.tsx` is currently a small sticky bar with the logo. Replace it (per route) with the iOS pattern:

- A *very big* page title (e.g. "Dashboard", "Accounts", "$1,234,567") that lives inline at the top of scroll content.
- It collapses into a small centered title in the sticky bar as the user scrolls.

Use `IntersectionObserver` on the big title to drive the swap. This single change is what most makes a web app "feel" iOS.

### 2. Inset-grouped lists, not tables — ✅ Done

iOS Settings/Stocks-style:

- Rounded 16–22px cards.
- Group rows inside.
- Faint hairline dividers between rows (1px, 60% opacity).
- Uppercase tracked-out section headers above each group ("ASSETS", "LIABILITIES").
- Right-aligned chevrons (`ChevronRight` 14px, muted) on tappable rows.

Candidates: `src/components/dashboard/accounts-summary.tsx`, `src/components/accounts/holding-row.tsx`.

> `accounts-summary.tsx`: rounded-2xl cards, hairline dividers `h-px bg-border/60`, uppercase `tracking-widest` headers, ChevronRight icons. Container (`rounded-2xl overflow-hidden border border-border/40`) and hairline dividers also applied in `account-detail.tsx`. `holding-row.tsx` rows now have `hover:bg-muted/40 active:bg-muted/60 transition-colors` for consistent interactive feedback.

### 3. Bottom sheets instead of centered dialogs — ❌ Not Done

On mobile, swap account/holding/transaction *Dialogs* for sheets that slide up from the bottom with a drag handle and swipe-to-dismiss. shadcn has a `Sheet` (Vaul) primitive — use `side="bottom"` with rounded top corners. This is the single most jarring "this is a website" moment in the current flow.

Candidates: `src/components/accounts/holding-form.tsx`, `src/components/accounts/edit-holding-dialog.tsx`, `src/components/accounts/account-form.tsx`.

### 4. Tab bar polish — ⚠️ Partial

The bottom nav at `src/components/layout/sidebar.tsx:129` is close. Two tweaks:

- **Filled vs. outline** icons for active/inactive (iOS tab bars do this, not just color). Lucide doesn't ship filled variants — pair with a tiny pill background `bg-primary/10` behind the active icon, drop the top indicator bar.
- Slightly increase tap targets to ~48×48 and reduce label size to 10–11px uppercase tracking.

> Active state currently uses a top indicator bar (`absolute inset-x-2 -top-3 h-0.5 bg-primary`, sidebar.tsx:152) rather than a pill background. Icon tap targets are ~20px (h-5 w-5), below the 48×48 recommendation.

### 5. Haptics + spring motion — ❌ Not Done

- On tap of nav items, refresh, privacy toggle, sheet open: call `navigator.vibrate?.(10)` for a soft tick.
- Prefer spring curves (`cubic-bezier(0.34, 1.56, 0.64, 1)`) over linear `duration-200`.
- The count-up on net worth is great; consider **ease-out cubic** so it decelerates the way iOS does.

### 6. Pull-to-refresh native feel — ⚠️ Partial

`src/components/dashboard/dashboard-pull-refresh.tsx` exists — make sure it:

- Has a real rubber-band overscroll on iOS (`overscroll-behavior: contain` on the scroll container, plus a transform-based offset).
- Shows a circular progress that *fills* as you pull (not a spinner that appears at threshold).
- Gives a haptic tick at threshold crossing.

> Rubber-band damped pull (`Math.min(delta * 0.5, MAX_PULL)`) and fill-progress indicator are implemented. Haptic tick at threshold crossing (`navigator.vibrate`) is missing.

### 7. Status bar / safe areas / chrome — ⚠️ Partial

- Add `<meta name="theme-color">` per color scheme so iOS tints the status bar to match the nav (`oklch(0.14 0.030 200)` dark, `oklch(0.99 0.003 260)` light).
- Confirm `viewport-fit=cover` on the viewport meta and that `pb-safe` covers home-indicator on the bottom nav (it does at `sidebar.tsx:131`). The mobile header should add `pt-safe` too.
- Add `apple-mobile-web-app-capable` + a proper iOS splash so installed-PWA mode looks native.

> `apple-mobile-web-app-capable` (`appleWebApp: { capable: true }`) and `viewport-fit: "cover"` are set in `layout.tsx`. Safe-area env vars applied on mobile header. Missing: `theme-color` meta tag and iOS splash screen configuration.

### 8. iOS typography — ❌ Not Done

- Add `-apple-system, "SF Pro Text", "SF Pro Display"` *before* Geist in the body font stack so when run as PWA on iOS it picks up SF and Dynamic Type.
- Tighten letter-spacing (`-0.02em`) on the big net-worth number — that's the single most "Stocks-app" detail.

### 9. Swipe actions — ❌ Not Done

On `src/components/accounts/holding-row.tsx`, support a left swipe revealing Edit (blue) / Delete (red) buttons — classic iOS list pattern. Library: `framer-motion`'s `drag="x"` with snap points, ~60 lines of code.

### 10. Disclosure transitions — ❌ Not Done

When tapping an account in the list to open `/accounts/[id]`, do a slide-from-right transition (Next.js view transitions API works on Safari now). The default cross-fade feels webby.

## Desktop (smaller, but high leverage)

- **Command palette (⌘K)** — ⚠️ Partial: `cmdk` is installed and `src/components/ui/command.tsx` exists, but no palette UI is wired up. Jump-to-account, privacy toggle, refresh prices, base-currency switch still need implementing.
- **Keyboard shortcuts** — ❌ Not Done: `g d`, `g a`, `g h` Vim-style (or `1–5` for tab indices) for nav.
- **Sticky table headers** — ❌ Not Done: needed in `accounts-summary` and transaction history when the list grows past ~10 rows.
- **Density toggle** — ❌ Not Done: (Comfortable / Compact) — the current 2xl rounded glass cards eat a lot of vertical space at desktop widths; power users want more density.
- **Hover sparklines** — ❌ Not Done: on holding rows (last-30-day mini chart on hover) — pulls from `PriceCache` history if you start storing it.
- **Sidebar collapse to icons-only** — ❌ Not Done: current sidebar at `src/components/layout/sidebar.tsx:28` is fixed `w-64`; a 60px collapsed mode reclaims meaningful canvas on 13" laptops.

## Cross-cutting

- **Empty states with art** — ✅ Done: `src/components/dashboard/dashboard-content.tsx:212` has a wallet SVG illustration with `animate-bounce-slow` and a CTA button. Replicate the same pattern for empty accounts / empty history / empty transactions instead of bare text.
- **Skeleton shimmer** — ❌ Not Done: replace `animate-pulse` with a left-to-right gradient shimmer; it reads as "loading data" rather than "broken layout."
- **Color depth on the dashboard hero** — ❌ Not Done: there's already a gradient stripe at the bottom of the net-worth card (`src/components/dashboard/net-worth-card.tsx:43`); consider an *animated* mesh-gradient background tinted green/red based on day delta. Subtle but premium.

## Suggested implementation order

1. Large-title nav + status-bar `theme-color` + safe-area `pt-safe` on mobile header.
2. Bottom-sheet dialogs for forms.
3. Inset-grouped account/holding lists with disclosure chevrons.
4. Tab-bar pill background + filled-icon pattern.
5. Swipe actions on holding rows.
6. Command palette (desktop).
7. Sidebar collapse + density toggle (desktop).
