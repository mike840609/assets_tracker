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

#### 7. Status bar / safe areas / chrome — ⚠️ Partial

- Add `<meta name="theme-color">` per color scheme so iOS tints the status bar to match the nav.
- Confirm `viewport-fit=cover` on the viewport meta and that `pb-safe` covers home-indicator on the bottom nav.
- Add `apple-mobile-web-app-capable` + a proper iOS splash so installed-PWA mode looks native.

> `apple-mobile-web-app-capable` and `viewport-fit: "cover"` are set in `layout.tsx`. Safe-area env vars applied on mobile header. Missing: `theme-color` meta tag and iOS splash screen configuration.

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

#### 13. Stronger accessibility defaults (AA baseline) — ⚠️ Partial

- Ensure icon-only controls (privacy, refresh, row actions) always have `aria-label`.
- Add visible focus rings for keyboard users on custom clickable rows/cards.
- Confirm chart color pairs remain distinguishable in dark mode and for color-vision deficiency.

Targets: `src/components/layout/*`, `src/components/dashboard/*`, `src/components/analysis/*`.

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

### Suggested order of attack

1. **Phase 2.1 — Cash Flow Decomposition** (highest user value, no new models)
2. **Phase 2.2 — Category Trend** (unblocks an already-collected data field)
3. **Phase 3.1 — Custom Date Range** (foundational for everything else)
4. **Phase 2.3 — Top Movers** (benefits from #3's date picker)
5. **Phase 3.2 — Yearly/YoY** (cheap once the date picker exists)
6. **Phase 3.3 — Export**, then Phase 4 items by user demand.
