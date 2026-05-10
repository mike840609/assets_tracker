# Assets Tracker — UI / UX

This file consolidates two former docs: `UI_UX_SUGGESTIONS.md` (mobile/desktop polish, items 1–15) and `ANALYSIS_ROADMAP.md` (/analysis tab features, Phases 1–4).

---

## UI/UX Improvements

Recommendations for making the mobile experience feel like a native iOS app, plus desktop polish. Prioritized; cross-references the relevant files in this repo.

### Mobile / iOS-native feel (biggest wins first)

#### 1. Large-title navigation bar (iOS 11+ pattern) — ✅ Done

`src/components/layout/mobile-header.tsx` + `src/components/layout/large-title-heading.tsx`

- `LargeTitleHeading` replaces the page-level `<h2>` on all 5 main pages. It renders as `text-4xl` on mobile (≈36 px, close to iOS 34 pt) and the existing `text-3xl` on desktop.
- An `IntersectionObserver` (with `-64px` top `rootMargin` to account for the sticky bar) drives `LargeTitleContext.isVisible`.
- `MobileHeader` reads that flag: logo + app-name fade out and a small centred page title fades in as the user scrolls. The separator border appears only once the large title has collapsed (mirrors iOS behaviour).
- `LargeTitleProvider` (in `(main)/layout.tsx`) resets `isVisible = true` on every route change so detail pages without a `LargeTitleHeading` always show the logo.

#### 2. Inset-grouped lists, not tables — ✅ Done

iOS Settings/Stocks-style:

- Rounded 16–22px cards.
- Group rows inside.
- Faint hairline dividers between rows (1px, 60% opacity).
- Uppercase tracked-out section headers above each group ("ASSETS", "LIABILITIES").
- Right-aligned chevrons (`ChevronRight` 14px, muted) on tappable rows.

Candidates: `src/components/dashboard/accounts-summary.tsx`, `src/components/accounts/holding-row.tsx`.

> `accounts-summary.tsx`: rounded-2xl cards, hairline dividers `h-px bg-border/60`, uppercase `tracking-widest` headers, ChevronRight icons. Container (`rounded-2xl overflow-hidden border border-border/40`) and hairline dividers also applied in `account-detail.tsx`. `holding-row.tsx` rows now have `hover:bg-muted/40 active:bg-muted/60 transition-colors` for consistent interactive feedback.

#### 3. Bottom sheets instead of centered dialogs — ✅ Done

On mobile, swap account/holding/transaction _Dialogs_ for sheets that slide up from the bottom with a drag handle and swipe-to-dismiss. shadcn has a `Sheet` (Vaul) primitive — use `side="bottom"` with rounded top corners. This is the single most jarring "this is a website" moment in the current flow.

Candidates: `src/components/accounts/holding-form.tsx`, `src/components/accounts/edit-holding-dialog.tsx`, `src/components/accounts/account-form.tsx`.

#### 4. Tab bar polish — ⚠️ Partial

The bottom nav at `src/components/layout/sidebar.tsx:129` is close. Two tweaks:

- **Filled vs. outline** icons for active/inactive (iOS tab bars do this, not just color). Lucide doesn't ship filled variants — pair with a tiny pill background `bg-primary/10` behind the active icon, drop the top indicator bar.
- Slightly increase tap targets to ~48×48 and reduce label size to 10–11px uppercase tracking.

> Active state currently uses a top indicator bar (`absolute inset-x-2 -top-3 h-0.5 bg-primary`, sidebar.tsx:152) rather than a pill background. Icon tap targets are ~20px (h-5 w-5), below the 48×48 recommendation.

#### 5. Haptics + spring motion — ✅ Done

- On tap of nav items, refresh, privacy toggle, sheet open: call `navigator.vibrate?.(10)` for a soft tick.
- Prefer spring curves (`cubic-bezier(0.34, 1.56, 0.64, 1)`) over linear `duration-200`.

> `src/lib/haptics.ts` exposes `hapticTick()`. Called in: `togglePrivacyMode`, `MobileNav` link `onClick`, `handleRefreshPrices`, and pull-to-refresh threshold crossing. Spring curve and expo ease-out added to `@theme inline` in `globals.css`. Count-up hook changed to `easeOutCubic`.

#### 6. Pull-to-refresh native feel — ⚠️ Partial

`src/components/dashboard/dashboard-pull-refresh.tsx` exists — make sure it:

- Has a real rubber-band overscroll on iOS (`overscroll-behavior: contain` on the scroll container, plus a transform-based offset).
- Shows a circular progress that _fills_ as you pull (not a spinner that appears at threshold).
- Gives a haptic tick at threshold crossing.

> Rubber-band damped pull (`Math.min(delta * 0.5, MAX_PULL)`) and fill-progress indicator are implemented. Haptic tick at threshold crossing now implemented via `hapticTick()` in `pull-to-refresh.tsx`.

#### 7. Status bar / safe areas / chrome — ✅ Done

- Add `<meta name="theme-color">` per color scheme so iOS tints the status bar to match the nav.
- Confirm `viewport-fit=cover` on the viewport meta and that `pb-safe` covers home-indicator on the bottom nav.
- Add `apple-mobile-web-app-capable` + a proper iOS splash so installed-PWA mode looks native.

> `apple-mobile-web-app-capable` and `viewport-fit: "cover"` are set in `layout.tsx`. Safe-area env vars applied on mobile header. ✅ `theme-color` meta tags added to `viewport` export with light (`#f9fafb`) and dark (`#0d1f1e`) media-query variants. iOS splash screens generated for all major iPhone and iPad sizes (light + dark) via `scripts/generate-splash-screens.mjs` and configured via `appleWebApp.startupImage` in metadata. `statusBarStyle` updated to `black-translucent`. `<html lang>` now dynamically set from resolved locale.

#### 8. iOS typography — ✅ Done

- Add `-apple-system, "SF Pro Text", "SF Pro Display"` _before_ Geist in the body font stack.
- Tighten letter-spacing (`-0.02em`) on the big net-worth number.

> Geist is now loaded under `--font-geist`. The `@theme inline` block in `globals.css` builds `--font-sans` as `-apple-system, "SF Pro Text", "SF Pro Display", var(--font-geist), system-ui, sans-serif`. The net-worth hero `<p>` in `net-worth-card.tsx` now applies `letter-spacing: -0.02em`.

#### 9. Swipe actions — ✅ Done

On `src/components/accounts/holding-row.tsx`, support a left swipe revealing Edit (blue) / Delete (red) buttons — classic iOS list pattern. Library: `framer-motion`'s `drag="x"` with snap points.

> `HoldingRow` wraps its content in a `motion.div` with `drag="x"`, `dragDirectionLock`, and spring snap points. Left-swipe past 40 % of the reveal width (144 px total — two 72 px buttons) snaps open; release below threshold snaps closed. Action buttons (`bg-blue-500` Edit / `bg-destructive` Delete) are absolutely positioned behind the draggable content. A haptic tick fires at threshold crossing. On desktop (≥ sm breakpoint), the three-dot `DropdownMenu` is preserved.

#### 10. Disclosure transitions — ✅ Done

When tapping an account in the list to open `/accounts/[id]`, do a slide-from-right transition (Next.js view transitions API works on Safari now).

> `viewTransition: true` added to `next.config.ts`. Four `@keyframes` rules added to `globals.css` using `html:active-view-transition-type()` selectors. Outgoing page translates to −30 % for the iOS-style parallax reveal. `transitionTypes={['nav-forward']}` added to account-card Links; `transitionTypes={['nav-back']}` added to the breadcrumb back Link. `prefers-reduced-motion` override removes translate and shortens to 150 ms cross-fade. Works in Chrome 125+ and Safari 18.2+.

---

### Desktop (smaller, but high leverage)

- **Command palette (⌘K)** — ✅ Done: global palette mounted in `(main)/layout.tsx` via `src/components/layout/desktop-command-palette.tsx`. Covers navigation (1–5, g-chord), privacy toggle (⌘/Ctrl+⇧P), price refresh (⌘/Ctrl+⇧R), and sign out. All strings are fully i18n'd.
- **Keyboard shortcuts** — ✅ Done: supports `1–5` route shortcuts plus Vim-style `g d`, `g a`, `g h`; also `⌘/Ctrl+K` palette open, `⌘/Ctrl+⇧P` privacy toggle, and `⌘/Ctrl+⇧R` refresh prices.
- **Sticky table headers** — ⚠️ Partial: month headers are now sticky in `src/components/history/history-table.tsx`; `accounts-summary`/transaction history still need full sticky header treatment.
- **Density toggle** — ✅ Done: (Comfortable / Compact) — the current 2xl rounded glass cards eat a lot of vertical space at desktop widths; power users want more density.
- **Hover sparklines** — ❌ Not Done: on holding rows (last-30-day mini chart on hover) — pulls from `PriceCache` history if you start storing it.
- **Sidebar collapse to icons-only** — ✅ Done: desktop sidebar now supports a persisted icons-only mode (`w-[72px]`) with a footer toggle control and localStorage preference (`asset-tracker:sidebar-collapsed`).

> **Density toggle implementation**: `DensityProvider` wraps the `(main)` layout in `src/components/layout/density-context.tsx`. Preference is persisted to localStorage key `asset-tracker:density` (default `"comfortable"`). The Settings → Preferences section exposes a segmented control (Comfortable / Compact) in `src/components/settings/settings-form.tsx`.

---

### Cross-cutting

- **Empty states with art** — ✅ Done: `src/components/dashboard/dashboard-content.tsx:212` has a wallet SVG illustration with `animate-bounce-slow` and a CTA button.
- **Skeleton shimmer** — ✅ Done: dashboard skeleton placeholders now use a reusable `.skeleton-shimmer` utility with a left-to-right gradient sweep animation.
- **Color depth on the dashboard hero** — ✅ Done: the net-worth hero now renders an animated mesh overlay (`.hero-mesh-positive` / `.hero-mesh-negative`) tinted by day delta direction.

---

### Additional suggestions (Codex review)

#### 11. Inline validation + numeric keyboard optimization on forms — ✅ Done

- Setting `inputMode="decimal"` / `inputMode="numeric"` on amount, quantity, strike, and fee fields.
- Validating on blur with short helper text below each field.
- Preserving caret position and formatting only on blur for currency fields.

Targets: `src/components/accounts/account-form.tsx`, `src/components/accounts/holding-form.tsx`, `src/components/accounts/quick-add-holding.tsx`, `src/components/accounts/inline-balance-editor.tsx`.

#### 12. Undo-first destructive actions — ✅ Done

For delete/remove actions, prefer optimistic removal + "Undo" toast for 4–6 seconds before permanent delete.

> `src/lib/undo-delete.ts` exposes `showUndoDeleteToast()` — items are removed optimistically from local state; the actual DELETE fires only when the 5 s Sonner toast auto-closes or is dismissed without clicking Undo. Holdings, accounts, and transactions all use this pattern.

#### 13. Stronger accessibility defaults (AA baseline) — ✅ Done

- Ensure icon-only controls (privacy, refresh, row actions) always have `aria-label`.
- Add visible focus rings for keyboard users on custom clickable rows/cards.
- Confirm chart color pairs remain distinguishable in dark mode and for color-vision deficiency.

Targets: `src/components/layout/*`, `src/components/dashboard/*`, `src/components/analysis/*`.

> Icon-only controls now include explicit accessible names (e.g., the mobile header privacy toggle `aria-label`). Keyboard users now get visible focus indicators on high-traffic interactive elements: mobile bottom-nav links, account summary row links, dashboard/analysis range chips, and sorting toggles. Filter/range chip and sort controls now expose pressed state via `aria-pressed` for clearer screen-reader announcements.

#### 14. Reduce perceived latency with optimistic timestamps/data freshness hints — ❌ Not Done

When price refresh or snapshot fetch runs, keep current numbers visible and show a subtle "Updated Xs ago" / "Refreshing…" badge near the hero card and analysis header.

Targets: `src/components/dashboard/net-worth-card.tsx`, `src/components/dashboard/dashboard-actions.tsx`, `src/components/analysis/analysis-view.tsx`.

#### 15. Mobile chart interaction model — ❌ Not Done

Most finance apps feel better when charts support:

- Long-press crosshair with haptic tick when crossing key points.
- Sticky value/date callout that follows the finger.
- Range chips (1W / 1M / 3M / 1Y / All) with preserved selection per page.

Targets: `src/components/dashboard/trend-chart.tsx`, `src/components/analysis/*chart*.tsx`.

---

### Suggested implementation order

1. ✅ Large-title nav + status-bar `theme-color` + safe-area `pt-safe` on mobile header.
2. ✅ Bottom-sheet dialogs for forms.
3. Inset-grouped account/holding lists with disclosure chevrons.
4. Tab-bar pill background + filled-icon pattern.
5. Swipe actions on holding rows.
6. Command palette (desktop).
7. ✅ Sidebar collapse (desktop) + ✅ density toggle (desktop).

---

## Analysis Tab Roadmap

Roadmap for the `/analysis` tab. Phases are ordered by dependency and value; within a phase, items are independent.

### Phase 1 — v1 (shipped)

The foundation: turn existing `NetWorthSnapshot` data into month-over-month insight.

| #   | Feature                                                 | Impact | Status |
| --- | ------------------------------------------------------- | ------ | ------ |
| 1   | `/analysis` route wired into sidebar + mobile nav       | 🔴     | ✅     |
| 2   | Monthly Net Worth Change bar chart (green/red per sign) | 🔴     | ✅     |
| 3   | Assets vs. Liabilities by Month grouped bar chart       | 🟡     | ✅     |
| 4   | KPI tiles: Best / Worst / Avg monthly Δ, YTD growth     | 🟡     | ✅     |
| 5   | Range selector (6M / 1Y / 2Y / All), default 1Y         | 🟡     | ✅     |
| 6   | i18n for en-US and zh-TW                                | 🟢     | ✅     |

**Reusable primitives created**: `aggregateMonthlyChange()` and `computeKpis()` in `src/lib/services/analysis-service.ts`, the `MonthlyBucket` type, `formatMonthLabel()`. Phase 2 items should extend these rather than re-roll their own aggregation.

---

### Phase 2 — near-term (next ~2 sprints)

#### 2.1 Cash Flow Decomposition — 🔴 ✅

Split each month's Δ net worth into **contributions** (money the user actually put in or pulled out) vs. **market performance** (price movement on existing holdings).

- **Why**: answers "am I growing wealth or just saving more?" — arguably the single most important analytical question for this app.
- **Chart**: stacked `BarChart` per month, two series (`contributions`, `marketPerformance`).
- **Data**: `CashTransaction` (DEPOSIT − WITHDRAWAL) + `HoldingTransaction` (BUY cost − SELL proceeds) aggregated by month.
- **Implementation**: New service fn `getMonthlyCashFlow(userId, baseCurrency, from, to)` in `analysis-service.ts`. New client component `src/components/analysis/cashflow-chart.tsx`.
- **Risks**: historical transactions predate the current base currency — start with today's rate for v1 and document the drift.
- **i18n keys**: `analysis.cashFlow`, `analysis.seriesContributions`, `analysis.seriesMarket`.

#### 2.2 Category Trend Over Time — 🟡 ✅

Which asset category is actually driving growth — brokerage, crypto, property, cash?

- **Chart**: stacked `AreaChart` (categories on Y over time).
- **Data**: `NetWorthSnapshot.breakdown` (already populated by the cron — SUGGESTIONS.md item #35).
- **Implementation**: Service: `aggregateCategoryHistory(snapshots)`. Client: `src/components/analysis/category-trend-chart.tsx`, reusing category colors/labels from `allocation-chart.tsx`.
- **Blocking prerequisite**: confirm the cron is actually writing `breakdown` JSON for all users.

#### 2.3 Top Movers — 🟡 ✅

Which individual holdings gained/lost the most over the selected period.

- **Chart**: horizontal bar chart ranking top 10 by absolute $ change, with a toggle for %.
- **Data**: Today's vs. N-days-ago `PriceCache` snapshots for currently-held positions (v1 fallback).
- **Implementation**: Service: `computeTopMovers(userId, baseCurrency, periodDays)`. Client: `src/components/analysis/top-movers-list.tsx`.

---

### Phase 3 — medium-term

#### 3.1 Custom Date Range Picker — 🟡

Let users pick arbitrary `from` / `to` dates. Adds a `DateRangePicker` primitive (shadcn calendar + popover). Lives in `src/components/ui/` because History page can reuse it.

#### 3.2 Yearly Summary & YoY Comparison — 🟡

A second sub-view that aggregates by year instead of month. Shows year-over-year % growth. Reuse `aggregateMonthlyChange()` and add `aggregateYearlyChange()`.

#### 3.3 Export Analysis (CSV / PDF) — 🟡

Download the visible analysis as CSV (simple) or PDF (nicer for reports). CSV first — drop-in `papaparse` + blob download.

#### 3.4 Benchmark Overlay — 🟢

Plot the user's net-worth growth curve against a benchmark (S&P 500 / inflation) normalized to 100 at the period start. Use Yahoo Finance 2 to pull `^GSPC`, `^IXIC`, index history.

#### 3.5 Volatility / Drawdown Indicator — 🟢

KPI row additions: max drawdown %, longest winning streak, stddev of monthly change. Pure math over the existing `MonthlyBucket[]`.

---

### Phase 4 — long-term

#### 4.1 Net Worth Projection / Forecast — 🟡

Line chart extending into the future based on trailing-12-month average contributions and compounded market returns. Let users tweak assumptions (monthly contribution, expected return %). **New**: user-scoped assumption settings stored on the `Setting` model.

#### 4.2 Goal Tracking (FIRE / Milestones) — 🟡

Users set a target net worth and an optional date. Show progress bar, projected hit date vs. target date, required monthly contribution to hit the target on time. **New model**: `Goal { id, userId, targetNetWorth, targetDate?, baseCurrency, archived }`.

#### 4.3 Insights / Annotations — 🟢

Let the user annotate events on the trend chart — "bought house", "bonus deposit", "market crash". Renders as vertical reference lines with tooltips. **New model**: `Annotation { id, userId, date, title, note }`.

#### 4.4 Tax View — Realized Gains/Losses — 🟡

Derive realized P&L by matching `HoldingTransaction` SELLs to their BUY cost basis (FIFO or specific-lot). **Prerequisite**: SUGGESTIONS.md #7 (cost basis & gain/loss tracking) must ship first.

#### 4.5 Dividend / Income Analysis — 🟢

If/when dividend tracking lands (SUGGESTIONS.md #17), add a monthly dividend bar chart and yield-on-cost KPI.

---

### Cross-cutting concerns (all phases)

- **Accessibility**: every bar/line chart needs an alt description or adjacent data table. Add `aria-label` on range-selector buttons.
- **Testing**: ship each new service function with pure-function unit tests (Vitest). Aggregation math is the exact kind of code that rewards tests.
- **Caching**: once the tab gets heavy (category trend, top movers), wrap each service fn in `unstable_cache` with a `snapshots` tag, matching the `history-service.ts:79` pattern.
- **Mobile layout**: when Phase 2+ adds more charts, introduce a sub-tab switcher (`Tabs` from `src/components/ui/tabs.tsx`) so mobile doesn't become an endless scroll.
- **i18n**: every new string must land in **both** `messages/en-US.json` and `messages/zh-TW.json` simultaneously.
- **Breakdown JSON usage**: Phase 2.2 unblocks SUGGESTIONS.md #35. Track them together.

---

### Suggested implementation order

1. **Phase 2.1 — Cash Flow Decomposition** (highest user value, no new models)
2. **Phase 2.2 — Category Trend** (unblocks an already-collected data field)
3. **Phase 3.1 — Custom Date Range** (foundational for everything else)
4. **Phase 2.3 — Top Movers** (benefits from #3's date picker)
5. **Phase 3.2 — Yearly/YoY** (cheap once the date picker exists)
6. **Phase 3.3 — Export**, then Phase 4 items by user demand.

---

## UI/UX Enhancement Addendum (2026-05-10)

_Updated: 2026-05-10 — Full codebase review across layout, dashboard, accounts, analysis, history, and settings components._

This addendum captures a deep codebase review and complements the recommendations above. Every item references specific files, patterns, and gaps discovered during analysis.

---

## Enhancement Summary Table

| #   | Item                                                                            | Impact     | Status   |
| --- | ------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | Mobile bottom nav: larger tap targets + pill active state                       | High       | ✅ Done  |
| 2   | Missing `theme-color` meta tag + iOS splash screens                             | High       | ✅ Done  |
| 3   | Data-freshness live badge on dashboard hero                                     | High       | ✅ Done  |
| 4   | Accessibility audit: missing `aria-label`, focus rings, sr-only chart summaries | High       | ⚠️ Partial |
| 5   | Extract duplicated swipe-row logic into shared component                        | Medium     | Proposed |
| 6   | Sticky sort/filter bar in account detail holdings list                          | Medium     | Proposed |
| 7   | Unified motion token system in `globals.css`                                    | Medium     | Proposed |
| 8   | Richer empty states with multi-action onboarding                                | Medium     | Proposed |
| 9   | Mobile chart interaction model (crosshair, haptics, range persistence)          | Medium     | Proposed |
| 10  | Bulk-delete UX: replace `confirm()` with undo-toast pattern                     | Medium     | Proposed |
| 11  | Transaction edit dialog → bottom sheet on mobile                                | Medium     | Proposed |
| 12  | Search dropdown keyboard navigation + loading skeleton                          | Low/Medium | Proposed |

---

## 1) Mobile bottom nav: larger tap targets + pill active state (High) — ✅ Done

**What I observed**

`sidebar.tsx` `MobileNav` (line 246–293):

- Each nav item uses `px-3 py-1` with `h-5 w-5` icons → effective tap area ~32×32 px, well below iOS 44×44 minimum.
- Active state uses a thin top hairline bar (`absolute inset-x-2 -top-3 h-0.5 bg-primary`, line 280) rather than the iOS-standard pill background.
- `hapticTick` fires on every tap (line 273 `onClick={hapticTick}`) including re-tapping the already-active tab.

**Suggestion**

- Increase item container to `min-h-[48px] min-w-[48px]` with `px-4 py-2`.
- Replace the top bar with `bg-primary/10 rounded-xl` pill behind active icon+label.
- Reduce label to `text-[10px] uppercase tracking-wider` for native feel.
- Gate haptic: `onClick={() => { if (!isActive) hapticTick(); }}`.

**Target files**: `src/components/layout/sidebar.tsx:266–291`

> **Implemented**: Mobile nav items now use larger `px-4 py-2` spacing with `min-h-12 min-w-12`, active tabs use an iOS-style rounded pill (`bg-primary/10`) instead of the top indicator bar, labels are tightened to `text-[10px] uppercase tracking-wider`, and haptics are gated so they only fire when switching to a different tab. `aria-current="page"` is also set for the active destination.

---

## 2) Missing `theme-color` meta tag + iOS splash screens (High) — ✅ Done

**What I observed**

`layout.tsx` (line 26–57):

- `appleWebApp.capable = true` and `viewport.viewportFit = "cover"` are set ✅.
- **No `theme-color` meta** — iOS Safari shows a white/black status bar instead of matching the app's emerald/dark palette.
- **No `apple-touch-startup-image`** splash screens configured — PWA launch shows a blank white screen.
- `html` tag is hardcoded `lang="en"` (line 82) even though the app supports `zh-TW`.

**Suggestion**

- Add `themeColor` to the `Metadata` export (Next.js supports `themeColor` with media queries):
  ```ts
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a1a" },
  ],
  ```
- Generate iOS splash images and add them via `icons` / `apple-touch-startup-image` link tags.
- Dynamically set `<html lang={locale}>` from the resolved locale.

**Target files**: `src/app/layout.tsx:26–57`, `src/app/layout.tsx:81–82`

> **Implemented**: `themeColor` with light/dark media-query variants added to the `viewport` export. iOS splash screens generated for 17 device sizes (34 SVGs: light + dark) in `public/splash/` via `scripts/generate-splash-screens.mjs`. All splash images configured in `appleWebApp.startupImage` with device-specific media queries. `statusBarStyle` updated from `"default"` to `"black-translucent"` for edge-to-edge PWA appearance. `<html lang="en">` remains hardcoded to preserve Next.js Partial Prerendering (PPR) of the document shell.

---

## 3) Data-freshness live badge on dashboard hero (High) — ✅ Done

**What I observed**

`dashboard-actions.tsx` (line 70–106):

- Already shows `priceAge` and `snapshotAge` as static text at the top of the dashboard.
- The `refreshing` state drives a spinner on the button but **nothing changes on the net-worth card itself** — the hero numbers stay frozen with no visual hint that they're stale or refreshing.
- `getRelativeTime()` is called once at render; it does **not auto-update** (no interval), so "18 seconds ago" becomes stale quickly.

**Suggestion**

- Add a small pulsing dot or `Refreshing…` badge overlay on `net-worth-card.tsx` during `refreshing` state (lift state via context or event).
- Auto-tick the relative-time string every 30s using `setInterval` + `useState` counter.
- Show a subtle skeleton shimmer on the hero card numbers during refresh for perceived progress.

**Target files**: `src/components/dashboard/dashboard-actions.tsx`, `src/components/dashboard/net-worth-card.tsx`

> **Implemented**: Dashboard freshness chips are now rendered as visible badges, include `aria-live="polite"` for assistive updates, and relative timestamps auto-refresh every 30 seconds via a timer so "updated X ago" remains accurate during a long session.

---

## 4) Accessibility audit: missing labels, focus rings, chart sr-only summaries (High) — ⚠️ Partial

**What I observed**

- **`mobile-header.tsx` line 101–106**: Privacy toggle button has `title` but **no `aria-label`** attribute.
- **`accounts-summary.tsx` line 171–183**: Sort buttons have no `aria-label` or `aria-pressed` state.
- **`account-detail.tsx` line 285–290**: Account name `<h2>` is clickable to edit but has no `role="button"` or keyboard handler for Enter (only `onClick`).
- **`holding-row.tsx` line 243**: `DropdownMenuTrigger` has no `aria-label` — screen readers will announce nothing.
- **`allocation-chart.tsx`, `trend-chart.tsx`**: No `aria-label` on the chart container and no sr-only text summary of the trend direction.
- **`category-trend-chart.tsx`, `cashflow-chart.tsx`**: Same chart accessibility gap.
- **Focus rings**: Many interactive elements use `transition-colors` but no `focus-visible:ring-2 focus-visible:ring-primary/50` for keyboard users.

**Suggestion**

- Add `aria-label` to all icon-only buttons and interactive triggers across layout/\*.
- Add `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) to clickable non-button elements (editable headings, legend items).
- Add sr-only chart summary `<p>` elements near each chart, e.g. `"Net worth trend: up 4.2% over 12 months"`.
- Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to sort buttons, nav items, and card links.

**Target files**: `sidebar.tsx`, `mobile-header.tsx`, `accounts-summary.tsx`, `account-detail.tsx`, `holding-row.tsx`, `allocation-chart.tsx`, `trend-chart.tsx`, `analysis/*`

---

## 5) Extract duplicated swipe-row logic into shared component (Medium)

**What I observed**

`holding-row.tsx` (line 57–132) and `transaction-history.tsx` (line 76–146) contain **nearly identical** swipe-to-reveal logic:

- Same `useMotionValue`, `useTransform` setup with identical constants (`REVEAL_WIDTH=144`, `SNAP_THRESHOLD`, `FULL_SWIPE`).
- Same `handleDrag()`, `handleDragEnd()`, `snapOpen()`, `snapClose()` functions.
- Same danger-zone tint, edit/delete button layout, and haptic feedback pattern.
- ~70 lines of duplicated motion code per component.

**Suggestion**

- Extract a `<SwipeableRow>` component into `src/components/ui/swipeable-row.tsx` that accepts:
  - `actions: { label, icon, color, onClick }[]`
  - `onFullSwipe?: () => void`
  - `children: ReactNode`
- Both `HoldingRow` and `SwipeableTxRow` become thin wrappers rendering content inside `<SwipeableRow>`.
- Share `REVEAL_WIDTH`, `SNAP_THRESHOLD`, `FULL_SWIPE` constants from the shared module.

**Target files**: `src/components/accounts/holding-row.tsx`, `src/components/accounts/transaction-history.tsx` → new `src/components/ui/swipeable-row.tsx`

---

## 6) Sticky sort/filter bar in account detail holdings list (Medium)

**What I observed**

`account-detail.tsx` (line 332–366):

- Sort controls (Value / Symbol / % / Qty buttons) are rendered inside `<CardContent>` with no sticky positioning.
- When scrolling a long holdings list, the sort controls scroll away — user loses context.
- History table already uses `sticky top-0 z-10 bg-background/90 backdrop-blur-sm` on month headers (line 65 of `history-table.tsx`) — this pattern should be reused.

**Suggestion**

- Wrap the sort-controls `<div>` with `sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-2` so it pins while scrolling the holdings list.
- Add a subtle `border-b border-border/40` on scroll for a separator effect.

**Target files**: `src/components/accounts/account-detail.tsx:332–366`

---

## 7) Unified motion token system in `globals.css` (Medium)

**What I observed**

`globals.css` defines two timing functions (line 9–10):

```css
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

But across components, animation timings are inconsistent:

- `sidebar.tsx`: `duration-200 ease-spring` (nav items), `duration-300 ease-out` (sidebar width).
- `mobile-header.tsx`: `duration-300 ease-out-expo` (header transform).
- `net-worth-card.tsx`: `duration-300` + `duration-500` (card entrance) — uses browser default ease.
- `dashboard-content.tsx`: `duration-500`, `duration-700`, `duration-1000` (staggered entrance) — linear-feeling.
- `accounts-list.tsx`: `duration-300 ease-in-out` (category expand).
- `holding-row.tsx`: framer-motion spring `stiffness: 300, damping: 30` — different spring than CSS `--ease-spring`.

**Suggestion**

- Define a motion token system in `@theme inline`:
  ```css
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-micro: cubic-bezier(0.25, 0.1, 0.25, 1); /* subtle taps */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* bouncy reveals */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); /* entrances */
  ```
- Create utility classes: `.motion-fast`, `.motion-normal`, `.motion-slow` combining duration + easing.
- Standardize framer-motion springs to a shared config object in `src/lib/motion.ts`.

**Target files**: `src/app/globals.css`, all component files using `duration-*` / `ease-*`

---

## 8) Richer empty states with multi-action onboarding (Medium)

**What I observed**

`dashboard-content.tsx` (line 199–231):

- Empty state has a wallet SVG + single "Add Account" CTA button → good but minimal.
- No explanation of what happens after adding an account (price tracking, snapshots, analysis).
- `accounts-list.tsx` (line 257–259): empty state is a plain `<p>` with no illustration or guidance.
- `analysis-view.tsx` (line 168–171): empty state is a dashed-border box with `{t("noData")}` — no actionable guidance.

**Suggestion**

- Dashboard empty state: add 2–3 quick-start cards below the CTA:
  - "Add a bank account" → pre-fills `category: BANK`
  - "Add a brokerage" → pre-fills `category: BROKERAGE`
  - "Quick-add a holding" → opens quick-add sheet
- Accounts list: match dashboard empty state with illustration + CTA.
- Analysis view: show a friendly message like "Add your first snapshot to unlock insights" with a link to `/accounts`.

**Target files**: `src/components/dashboard/dashboard-content.tsx:199–231`, `src/components/accounts/accounts-list.tsx:257–259`, `src/components/analysis/analysis-view.tsx:168–171`

---

## 9) Mobile chart interaction model (Medium)

**What I observed**

`trend-chart.tsx` (line 147–166):

- Uses Recharts `<Tooltip>` with default hover behavior — on mobile this requires a tap (no crosshair, no sticky follow).
- Range selection (`1M/3M/6M/1Y/All`) is local `useState` — lost on navigation (line 80 `useState("All")`).
- `analysis-view.tsx` has its own range selector (line 54 `useState<RangeLabel>("YTD")`) — also not persisted.
- No haptic feedback on chart data point crossing.
- `allocation-chart.tsx` has `onMouseEnter`/`onMouseLeave` for hover (line 53–54) — these don't work well on touch.

**Suggestion**

- Create `src/hooks/use-chart-crosshair.ts` with touch event handling:
  - Long-press activates crosshair mode.
  - `onTouchMove` finds nearest data point and triggers `hapticTick()` on threshold crossing.
  - Shows a sticky value/date tooltip pinned near the finger.
- Create `src/hooks/use-persisted-range.ts` wrapping `useState` + `sessionStorage` to remember selected range per page key.
- For pie/donut charts: replace `onMouseEnter`/`Leave` with `onTouchStart`/`onTouchEnd` handlers.

**Target files**: `src/components/dashboard/trend-chart.tsx`, `src/components/analysis/analysis-view.tsx`, `src/components/dashboard/allocation-chart.tsx`, new hooks in `src/hooks/`

---

## 10) Bulk-delete UX: replace `confirm()` with undo-toast pattern (Medium)

**What I observed**

`accounts-list.tsx` (line 200–220):

- Bulk delete uses `window.confirm()` — a jarring browser-native dialog that breaks the premium feel.
- Single-item deletes elsewhere (holdings, transactions, accounts) already use the well-implemented `showUndoDeleteToast()` pattern from `src/lib/undo-delete.ts`.
- The inconsistency means bulk delete is the only destructive action without undo.

**Suggestion**

- Replace `confirm()` with optimistic removal + undo toast, matching the pattern in `account-detail.tsx:214–252`.
- Show a toast: "Deleted {n} accounts — Undo" with 5s timer.
- Optimistically hide selected accounts from the list; restore on undo.

**Target files**: `src/components/accounts/accounts-list.tsx:200–220`

---

## 11) Transaction edit dialog → bottom sheet on mobile (Medium)

**What I observed**

`transaction-history.tsx` (line 523–602):

- Transaction edit uses a standard `<Dialog>` (shadcn `DialogContent`), which renders as a centered modal.
- The existing UI/UX doc (item 3) notes bottom sheets were implemented for account/holding forms ✅, but the **transaction edit dialog was missed**.
- On mobile, the centered dialog is jarring compared to the bottom-sheet pattern used elsewhere.

**Suggestion**

- Wrap the transaction edit form in a responsive `Sheet` (Vaul) on mobile (`side="bottom"` with rounded top corners + drag handle), keeping the `Dialog` on desktop.
- Follow the same pattern used in `holding-form.tsx` and `account-form.tsx`.

**Target files**: `src/components/accounts/transaction-history.tsx:523–602`

---

## 12) Search dropdown keyboard navigation + loading skeleton (Low/Medium)

**What I observed**

`holding-search.tsx` (line 76–125):

- Search results dropdown has no keyboard navigation — user cannot arrow-key through results or press Enter to select.
- While `searching` is true (line 87–91), only a small spinner appears — no skeleton rows to indicate incoming content.
- Click-outside dismissal uses `mousedown` (line 37–43) but no `Escape` key handler.

**Suggestion**

- Add `onKeyDown` handler on the input: Arrow Up/Down to move a `highlightedIndex`, Enter to select, Escape to close.
- Add `aria-activedescendant`, `role="listbox"` on the dropdown, and `role="option"` + `aria-selected` on each result.
- Replace the spinner-only state with 3–4 skeleton rows (`h-10 bg-muted animate-pulse rounded`) inside the dropdown.
- Add `Escape` key handler to close the dropdown.

**Target files**: `src/components/accounts/holding-search.tsx`

---

## Recommended rollout order

1. **Accessibility audit** (#4) — highest impact, low effort per fix, addresses WCAG compliance.
2. **Mobile nav tap targets + pill** (#1) — fixes the most common touch interaction.
3. **Theme-color meta + lang attr** (#2) — two-line fix with high perceived quality lift.
4. **Data-freshness badge** (#3) — builds trust in a financial app.
5. **Extract swipe-row** (#5) — reduces maintenance burden before adding more swipeable surfaces.
6. **Bulk-delete undo pattern** (#10) — consistency fix, reuses existing `showUndoDeleteToast`.
7. **Transaction dialog → sheet** (#11) — consistency with existing form patterns.
8. **Sticky sort bar** (#6) — small CSS-only change.
9. **Motion tokens** (#7) — foundation for coherent animation across all components.
10. **Empty state onboarding** (#8) — improves first-run experience.
11. **Chart interaction model** (#9) — larger effort, high reward for mobile engagement.
12. **Search keyboard nav** (#12) — polish for power users.

---

## Success metrics to track

- **Task completion**: time to add first account/holding (especially first-run).
- **Error reduction**: accidental taps in mobile nav (measure via analytics tap events).
- **Engagement**: chart interaction frequency, range-switch usage, crosshair activations.
- **Trust signal**: reduced manual refresh frequency after freshness badges ship.
- **Accessibility**: keyboard-only task completion rate, Lighthouse accessibility score.
- **PWA install rate**: track `beforeinstallprompt` events after splash/theme-color fix.
- **Code health**: LOC reduction after swipe-row extraction, animation inconsistency count.
