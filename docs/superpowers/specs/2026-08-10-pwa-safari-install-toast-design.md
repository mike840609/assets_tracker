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
4. The user has not previously dismissed or seen this hint on the current device/browser profile.

Do not show the toast on desktop browsers, Android, Safari, or installed standalone mode.

Persist a local flag with `localStorage` after the toast is shown so it does not appear on every visit.

## Copy

Title:

> 像 App 一樣使用 Assets Tracker

Description:

> 使用 Safari 開啟後，點選分享 → 加入主畫面，即可獲得更接近原生 App 的體驗。

The copy should use the application's existing localization infrastructure if this component is rendered inside the locale provider. English should be added alongside Traditional Chinese if the project conventions require both locales for new UI strings.

## Architecture

Create a focused client component, for example `src/components/layout/pwa-install-hint.tsx`, responsible only for:

- detecting iOS/iPadOS,
- detecting Safari vs. other browsers,
- detecting standalone mode,
- checking/writing the local persistence flag,
- triggering the existing Sonner toast.

Mount the component near `LazyToaster` in the root layout so the toast infrastructure is already available. Do not place browser-detection logic inside the shared `src/components/ui/sonner.tsx` component.

## Browser Detection

Use conservative client-side detection because this feature is only a non-critical UX hint. Account for iPadOS devices that can report a desktop-like user agent when possible. Safari detection must exclude common iOS browser tokens such as Chrome (`CriOS`), Firefox (`FxiOS`), Edge (`EdgiOS`), and Opera (`OPiOS`).

Standalone mode should consider both `window.matchMedia('(display-mode: standalone)').matches` and the legacy iOS `navigator.standalone` value.

## Persistence

Use a stable namespaced key such as:

`assets-tracker:pwa-safari-hint-shown`

If storage is unavailable or throws, fail silently. The hint is optional and must never block rendering.

## Error Handling

All browser APIs must be accessed client-side only. Any feature-detection or storage failure should result in no crash and no impact to the rest of the application.

## Testing

Add focused tests for the decision logic, preferably by keeping browser-state classification in pure helper functions that can be tested without mounting the full application.

Cover at least:

- iPhone Chrome → show
- iPhone Firefox → show
- iPhone Safari → do not show
- Android Chrome → do not show
- desktop Chrome → do not show
- installed standalone PWA → do not show
- already-shown localStorage flag → do not show

## Non-Goals

- No automatic redirect or deep link to Safari.
- No persistent banner or modal.
- No Android install prompt changes.
- No changes to service-worker registration or web-app manifest behavior.
