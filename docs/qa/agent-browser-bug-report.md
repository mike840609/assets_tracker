# Agent Browser QA Report — astt v1.7.2

- **Date:** 2026-11-13
- **Tool:** `agent-browser` 0.43.0 (Chromium 153, headless), plus axe-core 4.11.3 injected for WCAG 2 A/AA checks
- **Target:** local dev server (`pnpm dev`, Next.js 16.4.3 + Turbopack), PostgreSQL 16, demo data from `pnpm seed:demo`
- **Accounts used:** Internal Test Login (`e2e-test@preview.local`, seeded) and the self-host owner (`owner@self-host.local`, empty), so empty states and cross-user access could be tested
- **Source changes:** none. All test data was created in the UI and then deleted. At the end, `pnpm seed:demo` restored the seeded user.

## Executive Summary

All 16 routes were tested at desktop size (1440×900). The 12 main routes were also tested at tablet (768×1024) and mobile (390×844), and the mobile hub was checked with a real iPhone 14 user agent. Coverage includes CRUD for accounts, goals, the watchlist and calendar entries. It also includes cash transactions, settings (currency and language), backup export, restore with invalid files, the command palette, logout, empty states and cross-user authorization.

| Severity      | Count  |
| ------------- | ------ |
| P0 — Critical | 0      |
| P1 — High     | 2      |
| P2 — Medium   | 3      |
| P3 — Low      | 6      |
| **Total**     | **11** |

**Biggest risks**

1. **Login with a wrong password crashes to the global error page** (BUG-001). Every mistyped password shows "Something went wrong" and reports an exception to Sentry.
2. **The mobile Plan hub (`/goals`) is blank** when the browser sends a desktop user agent at a width under 768 px (BUG-002). Examples are a narrowed desktop window and iPadOS Safari, which sends a desktop user agent by default, on an iPad mini (744 px) or in Split View. Watchlist, Goals, Projections and Calendar all become unreachable there.
3. **The service worker shows "You are offline" while the user is online** whenever a page takes more than 3 s to load (BUG-003). This is likely in production on cold starts.

**What worked:** authorization is solid. Another user's account, goal, stock or snapshot always returned 404 or had no effect. Goal, watchlist and calendar CRUD worked. Calendar validation and restore-file validation worked. Empty states, i18n key parity across the three locales, and logout all worked. No horizontal overflow at any tested viewport.

**Coverage limits:** tested on the dev server only (no production build). External market data was reachable but not stress-tested. Not tested: Google OAuth, the public Demo (`PUBLIC_DEMO_ENABLED` was off), the cron endpoint, a successful backup restore (it would overwrite data), and adding holdings or options.

---

## Bug List

### BUG-001 — Wrong self-host password crashes the app with the global error page

**Status: Fixed.** Wrong passwords now redirect to `/login?error=CredentialsSignin` and show an inline message (verified twice; `screenshots/fix-001-inline-error.png`).

- **Severity:** P1
- **Affected:** `/login`, self-host password form (the Internal Test password form uses the same pattern)
- **Steps to reproduce** (reproduced 3 times):
  1. Sign out and open `/login`.
  2. Type any wrong password into "Self-host password" and click **Sign in**.
- **Expected:** you stay on `/login` and see an inline "Incorrect password" message.
- **Actual:** the whole document is replaced by `global-error.tsx`, which says "Something went wrong. The app ran into an unexpected error." In dev the overlay shows `Runtime CredentialsSignin`. `captureException` also sends it to Sentry as an app error.
- **Evidence:** `screenshots/issue-wrong-password-global-error.png`, `screenshots/login-wrong-password.png`. Console: `CredentialsSignin: Read more at https://errors.authjs.dev#credentialssignin at action (src/app/login/page.tsx:130:17)`.
- **Suspected root cause:** `src/app/login/page.tsx:130` and `:190`. The inline server actions call `await signIn("self-host", …)` with no try/catch. Auth.js v5 throws `CredentialsSignin` (an `AuthError`) when `authorize` returns `null` (`src/auth.ts:40`).
- **Recommended fix:** wrap both `signIn` calls. Catch `AuthError` and redirect to `/login?error=CredentialsSignin`, then show a translated inline error. Rethrow anything else so Next's redirect error still works (`if (e instanceof AuthError) redirect(...); throw e;`). Consider basic rate limiting while you are in there.

### BUG-002 — Mobile Plan hub (`/goals`) stays blank with a desktop user agent below 768 px

**Status: Fixed.** The client reads `?tab=` and judges readiness by the panel data that actually arrived. Verified at 744 px with a desktop UA (all four tabs and deep links) and on iPhone 14 (`screenshots/fix-002-calendar-tab-744.png`).

- **Severity:** P1
- **Affected:** `/goals`, plus `/stocks`, `/projections` and `/calendar`, which redirect into it on mobile widths
- **Steps to reproduce** (reproduced at widths 390, 744 and 767):
  1. In a desktop browser (desktop user agent), resize the window to less than 768 px wide. iPadOS Safari on an iPad mini in portrait (744 px) does the same.
  2. Open `/goals`, `/calendar` or `/goals?tab=calendar`.
  3. Click any tab (目標 / Goals, 行事曆 / Calendar).
- **Expected:** the requested tab opens with its content. `/calendar` should land on the Calendar tab.
- **Actual:** the Watchlist tab is selected, but every tab panel is empty (`innerText.length === 0`). The `?tab=` value is dropped. Clicking "Goals" leaves Watchlist selected. Clicking "Calendar" selects it, but the panel stays empty. With an iPhone user agent the same URLs work, and at 768 px they also work.
- **Evidence:** `screenshots/issue-plan-hub-blank-calendar-tab.png`, `screenshots/issue-mobile-calendar-tab.png`. Measured results:

  | Width | Selected tab | Visible panels and their text length |
  | ----- | ------------ | ------------------------------------ |
  | 744   | Watchlist    | watchlist: 0, goals: 0               |
  | 768   | Goals        | goals: 139                           |

- **Suspected root cause:** the server and the client decide "mobile" differently.
  - `src/app/(main)/goals/page.tsx:157-159` decides on the server from the user agent (`isMobileUserAgent`). With a desktop user agent it ignores `tab` and sets `loadedTab = "goals"`.
  - `goals-view.tsx` decides on the client from the viewport (`useIsMobile`, max-width 767px). So `desiredTab` becomes `"watchlist"`, `hasLoadedActivePanel` is never true, and only `<MobilePlanLoading/>` renders.
  - `router.replace` re-requests the page, but the server still says "desktop", so the two never match. `MobileHubRedirect` targets exactly this "resized desktop" case but lands in the broken state.
- **Recommended fix:** when `loadedTab !== activeTab` on the client, fetch the missing panel's data on the client (or call an API or server action). Alternatively, have the server honor `?tab=` regardless of user agent and load that panel's data. At the least, fall back to rendering the goals panel instead of an endless skeleton.

### BUG-003 — Service worker shows "You are offline" while online when a page takes more than 3 s

**Status: Fixed.** A route with no cached copy now waits 15 s (`NAV_OFFLINE_TIMEOUT_MS`) before showing `/offline`; cached routes keep the 3 s race. Covered by `tests/unit/service-worker.test.ts`. Not re-reproduced in the browser, because warm Turbopack compiles finish in about 1 s.

- **Severity:** P2
- **Affected:** any navigation not yet cached by the service worker (`public/sw.js`)
- **Steps to reproduce** (reproduced twice):
  1. Load the app once so `/sw.js` registers.
  2. Go to a page whose server response takes more than 3 s and that isn't cached yet. On the dev server, any route compiling for the first time does this, e.g. `/accounts` (4.9 s) or `/accounts/<id>` (3.4 s). In production, cold starts or slow database queries would do the same.
- **Expected:** the page loads, perhaps with a loading indicator.
- **Actual:** after 3 s the full page "You are offline — astt needs a connection…" with a Retry button appears (title "Offline — astt"). The server returned `200` a moment later, but the page is never swapped in.
- **Evidence:** `screenshots/issue-sw-offline-repro1.png`, `screenshots/issue-sw-offline-repro2.png`. Dev log: `GET /accounts/0a5236d8-… 200 in 3.4s`.
- **Suspected root cause:** `public/sw.js:216-223`. `handleNavigation` uses the precached `/offline` page as the timeout fallback in `raceWithTimeout` (`NAV_TIMEOUT_MS = 3000`), even when no cached copy of the route exists and the network is still pending.
- **Recommended fix:** only race against a fresh cached copy of the same route. When none exists, wait for the network and use `/offline` only when `fetch` actually rejects or `navigator.onLine === false`. Optionally skip SW registration in development.

### BUG-004 — Back after deleting an account shows the deleted account and throws an unhandled `TypeError`

**Status: Fixed.** Delete now uses `router.replace` + `router.refresh`, and `loadMore` checks `res.ok`. Verified: Back after delete stays on `/accounts` with no errors.

- **Severity:** P2
- **Affected:** `/accounts/[id]`, Transaction History
- **Steps to reproduce** (reproduced twice):
  1. Open an account's page and click **Delete Account → Delete**. You are sent to `/accounts` with the toast "Account deleted".
  2. Press the browser **Back** button.
- **Expected:** a 404 or "account not found" page, or a redirect to `/accounts`.
- **Actual:** the client router cache shows the deleted account (stale balance, a "Deleting…" button, and the account still in the side nav). The console logs `TypeError: Cannot read properties of undefined (reading 'transactions') at TransactionHistory.loadMore`. A reload shows the correct 404.
- **Evidence:** `screenshots/issue-back-after-delete-repro1.png`, `screenshots/issue-back-after-delete-repro2.png`.
- **Suspected root cause:**
  - `src/components/accounts/transaction-history.tsx:243-252` never checks `res.ok`. A 404 response (or 401 after the session expires) has no `data`, so `page.transactions` throws inside an unhandled promise.
  - The stale page comes from the router cache not being cleared after the delete.
- **Recommended fix:** in `loadMore`, check `if (!res.ok) { setError(...); return; }` and show an error or empty state. After the delete, call `router.refresh()` before or alongside `router.push("/accounts")`, or navigate with `replace`, so Back doesn't land on a page that no longer exists.

### BUG-005 — Account names made only of spaces are accepted

**Status: Fixed.** CRUD name schemas use `.trim()` (backup-import schemas unchanged) and the form trims. Verified: whitespace returns 400 "Name is required", and `"  QA Trim  "` is stored as `QA Trim`.

- **Severity:** P2
- **Affected:** **Add Account** dialog (`/accounts`), `POST /api/accounts`
- **Steps to reproduce** (reproduced twice: in the UI, then confirmed in the database):
  1. Go to `/accounts` and click **Add Account**.
  2. Type three spaces into **Name** and click **Create Account**.
- **Expected:** a validation error saying a name is required.
- **Actual:** you get "Account created" (201). The account appears with no visible name: only an icon in the side nav and an empty breadcrumb or heading. The database stored `name = '   '`.
- **Evidence:** `screenshots/issue-blank-account-detail.png`
- **Suspected root cause:** `src/lib/validators.ts:44` uses `name: z.string().min(1)` without `.trim()`, and `account-form.tsx` sends `name` untrimmed. HTML `required` accepts whitespace. The goal form trims on the client and the rename editor guards against blank names, but this path does neither.
- **Recommended fix:** use `z.string().trim().min(1)` for name fields in `createAccountSchema` (and holdings, goals and similar schemas). Also trim in `account-form.tsx`.

### BUG-006 — Allocation percentages add up to more than 100% when an asset account has a negative balance

- **Severity:** P3
- **Affected:** `/accounts` (allocation column, treemap, "Total assets")
- **Steps to reproduce:**
  1. On "Bank of Taiwan" (NT$580,000), record a cash **withdrawal** of NT$1,000,000. This is allowed, and the balance becomes -NT$420,000.
  2. Open `/accounts`.
- **Expected:** shares add up to 100%, and a negative asset is excluded or flagged.
- **Actual:** Yuanta is 56.4%, Firstrade 48.6%, Schwab 33.0% and Bank of Taiwan 37.9%, which adds up to 175.9%. The treemap legend adds up to 138%, and the "Total assets" chip shows NT$1M.
- **Evidence:** `screenshots/accounts-negative-asset.png`
- **Suspected root cause:** `src/components/accounts/accounts-list.tsx:1020-1021` uses `Math.abs(baseValue) / allocationDenominator`, while the denominator `totalAssets` is net of the negative balance.
- **Recommended fix:** divide by the sum of positive asset values, and show negative-balance assets separately. Alternatively, warn or confirm before a withdrawal makes an asset account negative.

### BUG-007 — Net-worth trend Y axis shows the same label twice

- **Severity:** P3
- **Affected:** Dashboard "Net Worth Trend", History page trend chart
- **Steps to reproduce:**
  1. Set the base currency to TWD (Settings).
  2. On the Dashboard, select the 3M or 1M range.
- **Expected:** distinct, evenly spaced tick labels.
- **Actual:** 3M shows `1.8M, 1.9M, 2.0M, 2.0M, 2.1M`, and 1M shows `1.9M, 1.9M, 2.0M, 2.1M`. The History page on mobile shows the same thing.
- **Evidence:** `screenshots/issue-duplicate-y-ticks.png`, `screenshots/history-mobile.png`
- **Suspected root cause:** `src/lib/chart-formatters.ts:16-22` (`formatChartTick`) always formats millions with one decimal. The custom `yDomain` in `trend-chart.tsx:411` produces non-round ticks such as 1.95M and 2.025M.
- **Recommended fix:** choose the number of decimals from the tick step (e.g. format with `Intl.NumberFormat({notation:"compact", maximumSignificantDigits})` based on the domain span), or give `YAxis` round ticks.

### BUG-008 — Goal form silently ignores a blank name or a non-positive amount

- **Severity:** P3
- **Affected:** **New Goal** / **Edit Goal** dialog (`/goals`)
- **Steps to reproduce:** in **New Goal**, enter spaces as the name (or a target of 0) and click **Create Goal**.
- **Expected:** an inline validation message.
- **Actual:** nothing happens. No request, toast or error appears, and the dialog stays open.
- **Evidence:** `screenshots/goal-blank-name-submit.png`
- **Suspected root cause:** `src/components/goals/goal-form-dialog.tsx:123` returns early with no feedback.
- **Recommended fix:** set field errors (as the calendar entry form does, see `screenshots/calendar-entry-invalid.png`) and mark the fields `aria-invalid`.

### BUG-009 — Account row action buttons have no accessible name (axe: critical `button-name`)

- **Severity:** P3 (accessibility)
- **Affected:** `/accounts` table, the "…" menu button on every row (5 found)
- **Steps to reproduce:** run axe on `/accounts`, or list buttons with a screen reader.
- **Actual:** `<button id="base-ui-…">` with only an icon and no name. The account page's holdings rows correctly use "Actions for 2330.TW".
- **Suspected root cause:** `src/components/accounts/accounts-list.tsx:1096-1101` has a `DropdownMenuTrigger` with no `aria-label`.
- **Recommended fix:** add `aria-label={t("actionsFor", { name: account.name })}`.

### BUG-010 — Other accessibility issues found by axe and inspection

- **Severity:** P3 (accessibility). Each item was confirmed in the source.

| #   | Where                           | Problem                                                                                                             | Location                                                                               |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| a   | Account page (`/accounts/[id]`) | `aria-hidden-focus` (8 nodes): swipe-action buttons are focusable inside an `aria-hidden="true"` container          | `src/components/ui/swipeable-row.tsx:117`. Add `inert` / `tabIndex={-1}` while closed  |
| b   | Dashboard, History              | `aria-prohibited-attr`: `aria-label` on a plain `<div>` (heatmap legend)                                            | `src/components/history/history-heatmap.tsx:334`. Add `role="img"` or use visible text |
| c   | Heatmap                         | Screen-reader labels hard-coded in English (`"… net worth activity"`, `", today"`)                                  | `history-heatmap.tsx:399,476`                                                          |
| d   | All dialogs and drawers         | The close button's screen-reader text is the untranslated `"Close"`                                                 | `src/components/ui/dialog.tsx:65,98`, `drawer.tsx:89`                                  |
| e   | Projections                     | "Annual expenses" / "Annual savings" inputs have no linked `<Label>` (their accessible name is the placeholder "0") | `src/components/projections/projection-view.tsx:207-219`. Add `htmlFor`/`id`           |
| f   | Account page                    | One `color-contrast` failure on the `text-muted-foreground/70` group header                                         | account page side panel                                                                |

### BUG-011 — Development-time runtime errors: invalid Base UI `render` usage and an uncached-data error on `/demo/expired`

- **Severity:** P3 (warnings logged as `console.error` on every visit)
- **Affected:** `/offline`, the 404 page, `/demo/expired`, the settings privacy and data panels, and the demo banner
- **Steps to reproduce:** open `/offline` or any unknown URL and check the console. Open `/demo/expired` while signed in.
- **Actual:**
  - `Base UI: A component that acts as a button expected a native <button> because the nativeButton prop is true…` comes from `<Button render={<Link …/>}>` (`src/app/offline/page.tsx:39`, `src/app/not-found.tsx:19`, `src/app/demo/expired/page.tsx`, `src/app/(main)/error.tsx`, and others).
  - `/demo/expired` logs `Route "/demo/expired": Next.js encountered uncached data during prerendering… (blocking-prerender-dynamic)`.
- **Impact:** links are rendered with button semantics (wrong role for assistive tech), and the console noise hides real errors.
- **Recommended fix:** pass `nativeButton={false}` where `Button` renders a `Link`. In `demo/expired/page.tsx`, move `getAuthContext()` into a child wrapped in `<Suspense>`, or export `instant = false`.

---

## Coverage Matrix

Viewports: D = desktop 1440×900, T = tablet 768×1024, M = mobile 390×844 (desktop user agent), M-UA = iPhone 14 emulation.

| Page / Feature                                 | What was tested                                                                                                             | Result                                        | Gaps                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `/login`                                       | Render (D/T/M), wrong password, Internal Test Login, self-host login, logout → back                                         | **Fail** (BUG-001)                            | Google OAuth                                                                     |
| Auth guards                                    | Logged-out redirects to `/login` (pages) and 401 (APIs). Cross-user GET/PATCH/DELETE on accounts, goals, stocks, snapshots  | Pass                                          | Session expiry timing                                                            |
| `/` Dashboard                                  | Render D/T/M, range buttons, $/% toggle, currency switch, empty state                                                       | **Fail** (BUG-007, a11y BUG-010b)             | Refresh prices under failure                                                     |
| `/accounts`                                    | Render D/T/M, add (validation, whitespace, amount masking), Manage Order (opened), treemap                                  | **Fail** (BUG-005, 006, 009)                  | Reorder save, bulk delete UI                                                     |
| `/accounts/[id]`                               | Render D/T/M, rename (blank guard OK), delete, back-after-delete, record cash (deposit/withdraw), recurring section visible | **Fail** (BUG-004, BUG-010a)                  | Add or edit holdings, options builder, editing past transactions, recurring CRUD |
| `/goals` (desktop)                             | Create, edit, delete, validation, persistence after reload                                                                  | **Fail** (BUG-008); CRUD passes               | Reordering goals                                                                 |
| `/goals` mobile Plan hub                       | Tab deep links via iPhone UA and desktop UA <768 px                                                                         | **Fail** (BUG-002)                            | —                                                                                |
| `/stocks` Watchlist                            | Search, add, duplicate rejected, delete with confirmation, discard guard                                                    | Pass                                          | Edit, reorder, refresh                                                           |
| `/analysis`                                    | Render D/T/M, chart sizing                                                                                                  | Pass (transient width(0) warning is harmless) | Each tab or KPI checked in detail                                                |
| `/projections`                                 | Render D/T/M, input labelling                                                                                               | **Fail** (BUG-010e)                           | Changing sliders and checking the maths                                          |
| `/calendar`                                    | Create (blank title and `javascript:` URL rejected), delete, month nav visible                                              | Pass                                          | Earnings watch management, editing                                               |
| `/history`                                     | Render D/T/M                                                                                                                | **Fail** (BUG-007 on mobile)                  | Snapshot deletion                                                                |
| `/settings`                                    | Base currency save, language switch (zh-TW), backup export (JSON valid), restore with invalid / non-JSON file               | Pass                                          | Successful restore (destructive), second currency, density, colors               |
| Command palette                                | Ctrl+K, navigation entries, empty results                                                                                   | Pass (commands only, by design)               | —                                                                                |
| i18n                                           | en / zh-CN / zh-TW key parity; UI text scan in zh-TW                                                                        | Pass (except BUG-010c/d)                      | zh-CN visual pass                                                                |
| `/privacy`, `/terms`, `/landing`, `/changelog` | Render D (+ T/M for landing)                                                                                                | Pass                                          | Content review                                                                   |
| `/offline`                                     | Render                                                                                                                      | **Fail** (BUG-011)                            | —                                                                                |
| `/demo/expired`                                | Render (signed in)                                                                                                          | **Fail** (BUG-011)                            | Public demo flow (feature flag off)                                              |
| 404 page                                       | Render                                                                                                                      | **Fail** (BUG-011)                            | —                                                                                |
| Service worker / PWA                           | Navigation fallback behavior                                                                                                | **Fail** (BUG-003)                            | Install prompt, real offline mode                                                |
| Responsive layout                              | All main routes at T and M: no horizontal overflow; mobile drawer fits                                                      | Pass                                          | Landscape orientations                                                           |
| `/api/health`                                  | Returns 503 `degraded` because the cron never ran locally (expected)                                                        | Not a bug                                     | —                                                                                |

## Recommended Next Steps

1. **Fix first (P1):**
   - BUG-001: catch `AuthError` in the login server actions. This is a small change.
   - BUG-002: make the Plan hub agree with the server, or load the active panel's data on the client.
2. **Next (P2):**
   - BUG-003: stop using `/offline` as a timeout fallback.
   - BUG-004: check `res.ok` in `TransactionHistory` and refresh the router after deletes.
   - BUG-005: add `.trim()` to name schemas across `validators.ts`.
3. **Then (P3):** allocation maths with negative balances, Y-axis tick formatting, goal form feedback, and the a11y fixes (row action labels, swipe actions, translated close labels, projection labels). Clear the Base UI `nativeButton` warnings.
4. **Fill the gaps:** run this pass again against a production build (`pnpm build && pnpm start`) to confirm BUG-001 and BUG-003 outside dev. Then cover holdings, options and recurring CRUD, plus the public Demo with `PUBLIC_DEMO_ENABLED=true`.
5. **Prevent regressions:** add Playwright tests for the wrong-password flow and for `/goals?tab=calendar` at 744 px with a desktop user agent. Also add `@axe-core/playwright` (axe-core is already in the lockfile) to the E2E suite.
