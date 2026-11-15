# Agent Browser QA Report — Round 2

- **Date:** 2026-11-14
- **Base:** `master` at `45bc03b` (includes PR #776, the round 1 fixes)
- **Tools:** `agent-browser` 0.43.0, axe-core 4.11.3, and Playwright (for focus checks with a real keyboard)
- **Targets:** dev server (`PUBLIC_DEMO_ENABLED=true`) for flows. A production build (`pnpm build && pnpm start`) was used to confirm the focus and contrast findings.
- **Accounts:** Internal Test Login (seeded), the self-host owner (empty, used for restore), and anonymous Public Demo visitors
- **Source changes:** none. Test data was created through the UI or API and removed or reseeded afterwards.

Round 1 covered navigation, accounts, goals, watchlist, calendar and settings. This round covers the gaps it left: holdings, options, recurring rules, Public Demo, a successful restore, failure modes, keyboard use and the light theme.

## Executive Summary

| Severity      | Count |
| ------------- | ----- |
| P0 — Critical | 0     |
| P1 — High     | 0     |
| P2 — Medium   | 3     |
| P3 — Low      | 5     |
| **Total**     | **8** |

**Biggest risks**

1. **Dialogs don't trap keyboard focus** (R2-01). In every dialog tested, Tab moves past the last control to the sidebar behind the modal. This was confirmed on a production build with a real keyboard.
2. **Transaction History shows false data on failure** (R2-02). A network error or non-OK response shows "No transactions yet." for an account that has transactions, and a network error also throws an uncaught `TypeError`.
3. **Light mode fails contrast for the primary button** (R2-03) in 4 of 6 color schemes, including the default Emerald (3.48:1). That puts 8 of 9 pages below WCAG AA.

**What worked**

- **Holdings:** add with search (201, persisted), quantity validation, and the option builder (OCC symbol, strike and ×100 multiplier stored correctly).
- **Recurring investments:** create, edit, pause and delete. The server validates the date range.
- **Public Demo:** enter; isolation (another user's account returns 404, restore returns 403); reset; expiry (redirects to `/demo/expired`, API returns 401); restart.
- **Backup restore:** succeeds with a preview and a case-sensitive `REPLACE` confirmation. The restored counts match the preview exactly.
- **Failure handling:** a failed Refresh Prices shows a clear toast. An expired session redirects navigation to `/login`, and the open form keeps its input.

**Coverage limits**

- Real offline mode with the service worker was **blocked by tooling**. CDP's offline emulation doesn't apply to the service worker target, so pages loaded but their data requests failed.
- Not covered: Google OAuth, zh-CN visual review, and recurring _cash_ rules beyond a code check (they share the investment component's patterns).

---

## Bug List

### R2-01 — Escape doesn't return focus to some dialogs' openers (focus-trap claim retracted)

**Status: Fixed, with a correction.**

- **The focus-trap half was a false positive.** Playwright pressed Tab before the next animation frame, and Base UI's end guard moves focus with `requestAnimationFrame`, so the second Tab left from the guard. With realistic key pacing (60 ms), focus wraps correctly from every starting point in both dialogs.
- **The focus-restore half was real, with two root causes.** Both are fixed:
  1. **Lazily loaded dialogs** (`AccountForm`, `QuickAddHolding`, and `OptionBuilder` inside it) used `next/dynamic` without `ssr: false` or `loading`. Without those, Next adds no Suspense boundary of its own (`loadable.js:49`), so the first open suspended up to a page-level boundary. React then hid the page with `display: none`, which blurred the opener before the dialog rendered. These now use `{ ssr: false }`, the pattern `HoldingForm` already follows.
  2. **`autoFocus` inside a dialog** (e.g. `StockForm`): React focuses the field during commit, before Base UI records the element to return to. `Dialog` in `src/components/ui/dialog.tsx` now captures the focused element during the render in which `open` turns true and passes it to `DialogContent` as the default `finalFocus`.
- **Verified:** Escape returns focus to Add Account, Add Holding, Add stock and New Goal. `tests/e2e/dialog-focus.spec.ts` fails without the fixes and passes with them.

- **Severity:** P2 (accessibility, affects every dialog tested)
- **Affected:** Add Account (`/accounts`), New Goal (`/goals`). Both use `src/components/ui/dialog.tsx`.
- **Steps to reproduce** (Playwright `keyboard.press`, production build, reproduced in both dialogs):
  1. Open **Add Account** or **New Goal**.
  2. Press Tab repeatedly.
- **Expected:** focus cycles inside the dialog. Escape returns focus to the button that opened it.
- **Actual:**
  - After the last control (Close), Tab goes to Base UI's end focus guard, then `<body>`, then **"Open command palette" and "Dashboard" in the sidebar behind the modal**.
  - In Add Account, Escape leaves focus on "Watchlist" rather than "Add Account". New Goal restores focus correctly.
- **Evidence:** Playwright run on the production server:
  - `/accounts`: 6 non-guard focus stops outside the dialog in 14 Tabs.
  - `/goals`: 3 stops outside, including `BUTTON: Open command palette` and `A: Dashboard`.
- **Suspected root cause:** not confirmed.
  - The wrapper uses Base UI 1.4.1 `Dialog` in the standard way (`modal` defaults to trapping focus), and the date input is not the trigger (the escape happens at the end of the sequence).
  - The suspects are Base UI's guard handling or an interaction with the layout.
  - Background content is `aria-hidden` (Base UI `markOthers`) but not `inert`, so it remains focusable.
- **Recommended fix:**
  - Reproduce with a minimal Base UI dialog outside the app layout, then compare with the latest Base UI release.
  - As a mitigation, make background content `inert` while a modal is open.
  - Add an E2E test that tabs past the last control and asserts focus stays inside.

### R2-02 — Transaction History shows "No transactions yet" when loading fails

**Status: Fixed.** `loadMore` now catches network errors, non-OK responses and malformed bodies, and sets a `loadError` state. The panel shows "Couldn't load transactions." with **Retry** (3 locales) instead of "No transactions yet"; a failed "load more" shows the message next to the button. `tests/e2e/transaction-history-errors.spec.ts` aborts the request, asserts the error, then retries successfully. It fails without the fix and passes with it.

- **Severity:** P2 (shows false information)
- **Affected:** `/accounts/[id]`, Transaction History (`src/components/accounts/transaction-history.tsx`)
- **Steps to reproduce** (reproduced twice):
  1. Make `/api/accounts/<id>/transactions` fail, e.g. a network error (`agent-browser network route "**/transactions?**" --abort`).
  2. Open the account page.
- **Expected:** an error state with a retry option. The account has 4 transactions.
- **Actual:**
  - The panel says **"No transactions yet."**
  - A network error also throws an uncaught `TypeError: Failed to fetch` in `loadMore`.
  - With the network back, the same page lists the transactions.
- **Evidence:** `round2/tx-history-network-error.png`. Console: `TypeError: Failed to fetch at TransactionHistory.useCallback[loadMore]`.
- **Root cause:**
  - `loadMore` uses `try/finally` with no `catch`, so a rejected `fetch` is unhandled.
  - The round 1 `!res.ok` guard returns with an empty list, so 401 and 5xx responses also render the empty state.
- **Recommended fix:** track an `error` state. In `loadMore`, catch rejections and non-OK responses, render "Couldn't load transactions" with a Retry button, and keep "No transactions yet" for a successful empty response only.

### R2-03 — Light-mode primary buttons fail WCAG AA contrast in 4 of 6 color schemes

**Status: Fixed.** Light-theme tokens in `src/app/globals.css` now meet ≥ 4.5:1 in both roles: the primary as a fill under white text, and the primary as text on white or on its own tint up to `bg-primary/15`.

- **New primary values:** Emerald 0.485, Anthropic 0.525, Ocean 0.475, Violet 0.525, Rose 0.525. Amber goes to 0.515 and switches to white button text.
- **Muted text:** default `--muted-foreground` 0.53; Anthropic's 0.50.
- **Badges:** the watchlist currency badges use full-opacity `text-primary` instead of `/90`.
- **Verified** on a fresh production build: axe reports **0 WCAG A/AA violations on all 9 pages for all 6 light schemes and for dark mode**.
- **Visual impact:** primaries are noticeably deeper in light mode (see `round2/fix-light-emerald-dashboard.png`). Dark mode is unchanged.

- **Severity:** P2 (accessibility, affects 8 of 9 pages including the default scheme)
- **Affected:** primary buttons, selected toggles and the calendar's "today" in light mode
- **Steps to reproduce:** in Settings choose **Light**, then run axe on any main page.
- **Actual:** contrast of white text on the primary color for the Add Account button:

  | Scheme            | Contrast | Result |
  | ----------------- | -------- | ------ |
  | Emerald (default) | 3.48:1   | fail   |
  | Anthropic         | 3.51:1   | fail   |
  | Ocean             | 4.0:1    | fail   |
  | Rose              | 4.48:1   | fail   |
  | Violet            | pass     |        |
  | Amber             | pass     |        |

  AA requires 4.5:1. Muted text on the accent background is also slightly short (`#6b727e` on `#eaf6ef`, 4.36:1). axe reports `color-contrast` on `/`, `/accounts`, `/goals`, `/history`, `/analysis`, `/projections`, `/calendar` and `/stocks`; only `/settings` is clean. Dark mode passed in round 1.

- **Evidence:** `round2/light-dashboard.png`, axe output (above)
- **Root cause:** in the light theme, `--primary` (for example `oklch(0.6 0.16 150)` for Emerald, `src/app/globals.css:76`) is too light for the near-white `--primary-foreground`.
- **Recommended fix:**
  - Lower the light-theme `--primary` lightness for Emerald, Anthropic, Ocean and Rose until white text reaches 4.5:1, or switch those schemes to a dark `--primary-foreground`.
  - Extend `tests/e2e/a11y.spec.ts` to run in light mode too.

### R2-04 — Holding dialogs have unnamed and placeholder-only controls

**Status: Fixed.** Every label in Edit Holding, Add Holding (`holding-form.tsx`) and the option builder (underlying, expiration, strike, contracts, unit price, OCC symbol) is linked to its control with `useId`. axe reports no violations on any of these dialogs, including the option builder with a live chain loaded. **New finding, not fixed:** Edit Holding is entirely untranslated (title, labels, buttons and toasts are hard-coded English).

- **Severity:** P3 (accessibility)
- **Affected:** Add Holding, Edit Holding, and the option builder (account page)
- **Actual** (axe on the open dialog):
  - **Edit Holding:** `critical select-name`. The asset-type `<select>` has no accessible name.
  - **Option builder, after loading a chain:** `critical button-name` ×2. The expiration and strike pickers have no name.
  - **Add/Edit Holding:** the name, quantity and price inputs have no linked `<label>` (`labels: 0`); their only accessible name is the placeholder ("e.g. 100", "e.g. 180"). axe accepts placeholders, so this is best-practice, not a violation.
- **Recommended fix:** give each control a visible `<Label htmlFor>` (or `aria-label` for the pickers), as was done for the Projections inputs in round 1.

### R2-05 — Many buttons share the same "Actions for {symbol}" name

**Status: Fixed.** Account-page row menus now have distinct names: "Holding actions for VOO", "Transaction actions for VOO, Buy, Jul 8, 2026 02:30 PM" (cash rows use "Cash"), and "Recurring rule actions for VOO" (3 locales). Verified unique on a seeded account. `ledger-date.spec.ts` was updated to the new name.

- **Severity:** P3 (accessibility)
- **Affected:** account page. The holdings row, each transaction-history row and each recurring rule for one symbol use the same label.
- **Actual:** with VOO held, bought and scheduled, the page has **6 buttons named "Actions for VOO"** that open different menus (holding edit/delete, transaction edit/delete, recurring edit/pause/delete).
- **Recommended fix:** make each label specific, e.g. "Holding actions for VOO", "Transaction actions for VOO, Buy, Nov 14", "Recurring investment actions for VOO".

### R2-06 — Error messages are discarded, generic or untranslated

**Status: Fixed.** New `src/lib/api-error.ts` (`apiErrorMessage`, `assertOk`, `errorText`, unit-tested) is used by transaction edit/delete, recurring investment and cash save/pause/delete, and the goal form. 401 shows a translated "Your session has expired. Sign in again." Validation and server reasons are shown as-is (they are English). Network errors fall back to the translated generic text. An invalid recurring amount shows "Enter an amount greater than 0." All three repro cases were verified on a production build.

- **Severity:** P3
- **Actual:**
  - **Edit transaction:** turning the only BUY into a SELL returns 400 `"Holding quantity cannot be negative"`, but the UI shows only "Failed to update transaction" (`transaction-history.tsx:335`).
  - **Recurring investment, invalid amount:** reuses the generic "Failed to add recurring investment" (`recurring-investments.tsx:129-131`).
  - **Recurring investment, server error:** the server's precise message (e.g. "End date must be on or after the start date") is discarded.
  - **Expired session:** saving a goal shows the raw English server string "Unauthorized" (`goal-form-dialog.tsx:160`). It is untranslated in zh-TW/zh-CN and doesn't suggest signing in again. The open dialog does keep the user's input.
- **Recommended fix:** use one helper for API errors. Map known statuses (401 → "Your session expired. Sign in again", with a link; 400 field errors → inline messages) and show the server's validation messages instead of generic text.

### R2-07 — Demo banner says "in 24 hours remaining" (and "剩餘 24 小時後")

**Status: Fixed.** `formatRemaining` (moved to `src/lib/demo/format-remaining.ts`, unit-tested) formats a plain duration with `Intl.NumberFormat` unit style: "24 hours remaining" / "剩餘 24 小時". Verified on a production build.

- **Severity:** P3 (copy, all locales)
- **Affected:** Public Demo banner (`src/components/demo/demo-mode-banner.tsx:34-38, 99`)
- **Actual:** "Expires Nov 15, 2026, 4:55 AM · in 24 hours remaining".
- **Root cause:** `formatRemaining` uses `Intl.RelativeTimeFormat` ("in 24 hours" / "24 小時後"), and the result is inserted into `"{duration} remaining"` / `"剩餘 {duration}"`.
- **Recommended fix:** format a plain duration, e.g. `Intl.NumberFormat(locale, { style: "unit", unit: "hour", unitDisplay: "long" })`.

### R2-08 — Recurring-rule delete uses a native `window.confirm`

**Status: Fixed.** Both recurring components use the shared AlertDialog (Cancel / Delete). `window.confirm` no longer appears anywhere in `src/`.

- **Severity:** P3 (consistency)
- **Affected:** `recurring-investments.tsx:198`, `recurring-cash-transactions.tsx:183`
- **Actual:** "Stop this recurring investment? Already-purchased shares are kept." appears as a browser `confirm()` dialog. Every other delete in the app uses the styled AlertDialog. The text is translated, but the dialog is unstyled, blocks the page, and can't be themed or tested like the others.
- **Recommended fix:** use the shared AlertDialog confirm pattern.

---

## Observations (not filed as bugs)

- A quantity like `0.000000001` is silently rounded to `0` on blur, which disables Add. It's unrealistic input, but a hint would help.
- Deleting a holding's only BUY transaction leaves a hidden zero-quantity holding row. The UI filters it out, so this looks intentional.
- There is no skip link. `<nav>`/`<main>` landmarks satisfy WCAG 2.4.1, but keyboard users tab through about 15 sidebar controls on every page.

## Coverage Matrix

| Area                       | What was tested                                                                                     | Result                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Holdings                   | Search and add, quantity validation (0, negative, text, tiny), edit dialog, delete with undo        | **Pass**, with R2-04 and R2-05                                               |
| Options                    | Load chain, pick expiry and strike, add contract; check stored OCC symbol, strike, type, multiplier | **Pass**, with R2-04                                                         |
| Transactions               | Edit type, quantity guard (server), delete                                                          | **Pass** for logic; **fail** on error copy (R2-06) and failure state (R2-02) |
| Recurring investments      | Create, edit amount, pause, delete, empty submit, end-before-start (API)                            | **Pass**, with R2-06 and R2-08                                               |
| Recurring cash             | Code check only (same patterns)                                                                     | Not tested in the browser                                                    |
| Public Demo                | Enter, isolation (404/403), reset, expiry → `/demo/expired` (API 401), restart                      | **Pass**, with R2-07                                                         |
| Backup restore             | Preview, `REPLACE` confirmation (case-sensitive), success, post-restore pages                       | **Pass**                                                                     |
| Failure modes              | Refresh Prices abort, transactions abort, expired session (save and navigate)                       | Mixed (R2-02, R2-06)                                                         |
| Offline (service worker)   | `set offline on`                                                                                    | **Blocked**: CDP offline emulation doesn't reach the service worker          |
| Keyboard                   | Tab order, skip link, dialog focus trap and restore (Playwright, production)                        | **Fail** (R2-01)                                                             |
| Light theme                | axe on 9 pages; contrast for 6 schemes                                                              | **Fail** (R2-03)                                                             |
| Google OAuth, zh-CN visual | —                                                                                                   | Not tested                                                                   |

## Recommended Next Steps

1. **Fix the P2s first.**
   - R2-02 is the smallest change: an error state with Retry in `TransactionHistory`.
   - R2-03 needs light-theme token tweaks for 4 schemes, plus a light-mode run of `a11y.spec.ts`.
   - R2-01 should start with a minimal Base UI repro, then add an `inert` background mitigation.
2. **Then the P3 accessibility items** (R2-04, R2-05) together, since they touch the same account-page components.
3. **Then error messages** (R2-06): one shared API-error helper.
4. **Small P3s:** the demo banner copy (R2-07) and the native confirm (R2-08).
5. **Tests to add:** focus-trap E2E (tab past the last control), a transactions-failure E2E using `page.route` abort, and the light-mode axe scan.
6. **Remaining coverage:** check offline mode on a real device (or with Playwright's `context.setOffline`, which also covers service workers), plus Google OAuth on a Vercel preview.

## Fix Verification (P2s)

Typecheck, lint and prettier pass; Vitest 1337/1337; full Playwright suite on a fresh production build **80 passed, 0 failed** (32 skipped: Public Demo projects and project-gated specs). This includes the 3 new E2E tests, each confirmed to fail without its fix.

**Lesson for future runs:** the stale light-mode results during this fix came from Turbopack's CSS hot reload serving an older stylesheet. Contrast and other CSS checks should be run on a fresh production build.

## Fix Verification (P3s)

Typecheck, lint and prettier pass; Vitest 1342/1342; full Playwright suite on a fresh production build **80 passed, 0 failed**. All round 2 bugs (3 P2, 5 P3) are now fixed.

**Follow-ups, also fixed:**

- **Edit Holding is now translated.** It uses a new `editHolding` namespace for its 8 own strings and reuses `quickAddHolding`, `optionBuilder` and `common` for the rest. Errors go through `api-error.ts`. Verified in zh-TW (`round2/fix-edit-holding-zh-tw.png`).
- **The lazily loaded Plan-hub panels** (`StockTrackerView`, `ProjectionView`, `CalendarView`) were checked for the same Suspense-hiding problem as the dialogs. First-time tab switches on an iPhone UA hid nothing and kept focus on the tab, because tab changes go through `router.replace` transitions. No change needed.
