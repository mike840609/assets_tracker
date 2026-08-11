# PWA Install Experience Design

## Goal

Improve Assets Tracker's mobile PWA onboarding beyond the iOS Safari hint by adding an Android/browser install prompt, a reusable installed/standalone status helper, and production-ready icon/splash metadata while preserving the existing visual identity.

## Scope

This change covers three related areas:

1. Android/browser install prompt using the `beforeinstallprompt` lifecycle when the browser exposes it.
2. Shared PWA installed/standalone status detection for current and future install UX.
3. App icon and launch experience polish using the existing green gradient + white growth-line mark.

It does not redesign the brand, change the service worker caching strategy, add push notifications, or add offline-first behavior.

## Android / Browser Install Prompt

Create a small client component responsible for capturing the browser's deferred `beforeinstallprompt` event and offering installation through the existing Sonner UI.

Behavior:

- Listen for `beforeinstallprompt` after mount.
- Call `preventDefault()` and retain the event so the app controls when the browser prompt is opened.
- Only show the Assets Tracker install toast on mobile-class devices, with Android as the primary supported path.
- Do not show if the app is already running as an installed/standalone PWA.
- Do not show on iOS; the separate Safari flow remains the iOS install path.
- Do not show repeatedly after the user dismisses the Assets Tracker install suggestion during the same browser profile. Persist a namespaced localStorage dismissal flag.
- The toast should include an explicit Install action. Clicking it calls the deferred event's `prompt()` method and waits for `userChoice`.
- When the choice is `accepted`, dismiss the hint and mark it handled.
- When the choice is `dismissed`, persist the dismissal flag so the app does not repeatedly nag the user.
- Also listen for `appinstalled` and immediately clear/dismiss any pending install toast.
- Browser API or storage failures must never affect application rendering.

Suggested copy:

English title: `Install Assets Tracker`
English description: `Add it to your home screen for a faster, app-like experience.`
English action: `Install`

Traditional Chinese title: `安裝 Assets Tracker`
Traditional Chinese description: `加入主畫面，享受更快速、更接近原生 App 的使用體驗。`
Traditional Chinese action: `安裝`

Use the existing locale infrastructure when practical.

## Shared PWA Install Status

Create a focused pure helper/module such as `src/lib/pwa-install-status.ts`.

It should expose testable functions for:

- determining whether the runtime is standalone/installed,
- classifying iOS/iPadOS when necessary,
- deciding whether an Android/browser install suggestion should be shown.

Standalone detection must include:

- `window.matchMedia("(display-mode: standalone)").matches`,
- legacy iOS `navigator.standalone === true`.

The browser-specific event listener remains inside the client component; pure eligibility logic stays testable without DOM mounting.

## App Icon Polish

Preserve the current icon concept from `src/app/icon.svg`: green gradient rounded square with a white upward growth line.

Add raster launcher variants based on the same artwork:

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-192.png`
- `public/icons/icon-maskable-512.png`
- Apple touch icon: none added. `src/app/apple-icon.tsx` already emits 180x180; a second static
  file would make Next.js render two competing `apple-touch-icon` tags.

Maskable variants must keep the white growth mark comfortably within the central safe zone so Android launchers can crop the outer background without clipping the mark.

Do not introduce new text inside the icon.

## Manifest / Launch Experience Polish

Update `src/app/manifest.ts` so the manifest includes:

- raster 192x192 and 512x512 icons with purpose `any`,
- 192x192 and 512x512 maskable icons with purpose `maskable`,
- existing `display: "standalone"`,
- consistent `background_color` and `theme_color` using the current dark green app identity.

Keep the SVG source icon for browser/favicon use, but do not rely on the SVG as the only install icon.

For launch/splash polish, rely on standards-based PWA launch metadata rather than adding a large matrix of hard-coded iOS startup images. Modern Android/Chromium generates the launch screen from the manifest icon, background color, and theme color. iOS should use the Apple touch icon plus the existing `appleWebApp` metadata.

Add `applicationName: "Assets Tracker"` to the root metadata if missing. Keep the existing `appleWebApp` settings.

## Architecture

Suggested units:

- `src/lib/pwa-install-status.ts` — pure install/standalone eligibility logic.
- `src/components/layout/pwa-install-prompt.tsx` — browser event lifecycle, Sonner install action, persistence.
- `src/app/layout.tsx` — mount the prompt and metadata wiring only.
- `src/app/manifest.ts` — install metadata and icon declarations.
- raster icon assets — derived from the current SVG artwork.

Do not put install logic inside the shared `src/components/ui/sonner.tsx`.

## Persistence

Use a stable key such as:

`assets-tracker:pwa-install-prompt-dismissed`

If localStorage throws or is unavailable, continue without persistence rather than crashing.

## Testing

Add unit coverage for at least:

- Android mobile + install event available + not standalone -> eligible.
- Android standalone -> not eligible.
- iOS Safari -> not eligible for Android/browser prompt.
- desktop Chrome -> not eligible for mobile install toast.
- previously dismissed install suggestion -> not eligible.
- standalone helper returns true for display-mode standalone.
- standalone helper returns true for legacy iOS standalone.

Also verify the manifest references both `any` and `maskable` 192/512 icon variants.

## Non-Goals

- No iOS Safari hint changes in this PR.
- No service-worker caching changes.
- No notification permissions or push notifications.
- No full offline mode.
- No brand redesign.
- No custom install modal; use the existing toast surface.
