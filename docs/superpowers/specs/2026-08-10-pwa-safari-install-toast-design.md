# Safari PWA Install Toast Design

## Goal

Help iPhone and iPad users who open Assets Tracker in a non-Safari browser discover that opening the site in Safari and using **Add to Home Screen** provides a more app-like experience.

## Scope

This change adds a lightweight, one-time Sonner toast. It does not redesign the existing PWA setup, add a custom install banner, or attempt to force-open Safari.

## Behavior

Show the toast only when all of the following are true:

1. The client is running on iOS or iPadOS.
2. The current browser is not Safari.
3. The app is not already running in standalone / installed PWA mode.
4. The user has not previously seen this hint on the current device/browser profile.

Do not show the toast on desktop browsers, Android, Safari, or installed standalone mode.

The toast must remain visible indefinitely and must not auto-dismiss. It must expose a close button so the user explicitly dismisses it.

Persist a local flag with `localStorage` after the toast is shown so it does not appear on every visit.

## Copy

Title:

> 像 App 一樣使用 Assets Tracker

Description:

> 使用 Safari 開啟後，點選分享 → 加入主畫面，即可獲得更接近原生 App 的體驗。

Action label:

> 複製連結

English equivalents:

- Title: `Use Assets Tracker like an app`
- Description: `Open this site in Safari, then tap Share → Add to Home Screen for a more app-like experience.`
- Action label: `Copy link`
- Success label: `Copied`

The copy should follow the active application locale.

## Copy-Link Action

Add a Sonner action button to the toast. When the user clicks it:

1. Copy `window.location.href`, preserving the exact current page URL including path, query string, and hash.
2. Keep the PWA hint toast open; copying must never dismiss it.
3. Temporarily change the action label to `Copied` / `已複製` after a successful clipboard write.
4. If the Clipboard API is unavailable or `navigator.clipboard.writeText` rejects, fail silently and keep the action available for another attempt.
5. Do not navigate, open Safari automatically, or replace the current page.

The close button remains the only explicit control that dismisses the toast.

### Action Button Sizing

The Copy link / Copied action must be **36px high** so it uses more of the toast's available vertical space than Sonner's 24px default action button. Keep the existing button width behavior, horizontal padding, color, border radius, and toast dimensions unchanged.

Apply the 36px height only to this PWA hint toast action. Do not change the shared Sonner component or the default action-button height used by other toasts.

## Architecture

Keep the focused client component at `src/components/layout/pwa-install-hint.tsx`, responsible for:

- collecting client browser state,
- checking/writing the local persistence flag,
- triggering the existing Sonner toast,
- copying the current URL when the action is clicked,
- maintaining the transient `Copied` action-label state,
- applying PWA-toast-specific action-button sizing.

Keep browser classification in the pure helper `src/lib/pwa-install-hint.ts` so it remains independently testable. Do not place browser-detection, clipboard behavior, or PWA-specific button sizing inside the shared `src/components/ui/sonner.tsx` component.

## Browser Detection

Use conservative client-side detection because this feature is only a non-critical UX hint. Account for iPadOS devices that can report a desktop-like user agent when possible. Safari detection must exclude common iOS browser tokens such as Chrome (`CriOS`), Firefox (`FxiOS`), Edge (`EdgiOS`), Opera (`OPiOS`), and Brave (`Brave`).

Standalone mode should consider both `window.matchMedia('(display-mode: standalone)').matches` and the legacy iOS `navigator.standalone` value.

## Persistence

Use the stable namespaced key:

`assets-tracker:pwa-safari-hint-shown`

If storage is unavailable or throws, fail silently. The hint is optional and must never block rendering.

## Error Handling

All browser APIs must be accessed client-side only. Any feature-detection, storage, or clipboard failure must not crash or affect the rest of the application.

Clipboard failure does not dismiss the toast and does not mark the copy action as successful.

## Testing

Keep focused tests around both eligibility and toast behavior.

Cover at least:

- iPhone Chrome → show
- iPhone Firefox → show
- iPhone Brave → show
- iPhone Safari → do not show
- Android Chrome → do not show
- desktop Chrome → do not show
- installed standalone PWA → do not show
- already-shown localStorage flag → do not show
- toast duration is infinite
- toast exposes a close button
- toast exposes a localized Copy link action
- Copy link uses the current `window.location.href`
- successful copy does not dismiss the toast
- clipboard failure leaves the toast usable
- PWA hint action button height is exactly 36px
- shared Sonner defaults are not changed to achieve the PWA-specific button height

## Non-Goals

- No automatic redirect or deep link to Safari.
- No separate persistent banner or modal.
- No Android install prompt changes.
- No changes to service-worker registration or web-app manifest behavior.
- No fixed homepage URL for the copy action; always copy the current page URL.
- No global action-button height change for other Sonner toasts.
