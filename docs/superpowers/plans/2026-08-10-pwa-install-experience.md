# PWA Install Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Android/browser PWA install toast, reusable install-status detection, and complete any/maskable/apple icon metadata while preserving the existing Assets Tracker icon design.

**Architecture:** Keep install eligibility in a pure helper tested under the existing Node Vitest environment. A focused client component owns `beforeinstallprompt`, `appinstalled`, Sonner actions, and localStorage persistence. Manifest and metadata changes stay declarative; raster icons are generated from the existing SVG mark rather than introducing a new brand design.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Sonner, next-intl locale state, Vitest, Web App Manifest.

## Global Constraints

- Android/browser install toast must never show on iOS, desktop, standalone mode, or after dismissal.
- Standalone detection includes both `(display-mode: standalone)` and legacy `navigator.standalone`.
- Use `beforeinstallprompt` only when the browser provides it; do not synthesize or force an install dialog.
- Browser/storage failures must fail silently.
- Preserve the current green gradient + white growth-line icon artwork.
- Add `any` and `maskable` PNG icons at 192x192 and 512x512 plus a 180x180 Apple touch icon.
- Do not change service-worker behavior or the shared Sonner component.

---

### Task 1: Add pure install status and eligibility logic

**Files:**

- Create: `src/lib/pwa-install-status.ts`
- Create: `tests/unit/pwa-install-status.test.ts`

**Interfaces:**

- Produces `isStandalonePwa(input: StandaloneEnvironment): boolean`.
- Produces `shouldOfferPwaInstall(input: PwaInstallEligibility): boolean`.

- [ ] **Step 1: Write failing unit tests**

Cover Android mobile eligible, Android standalone, iPhone Safari, desktop Chrome, dismissed state, display-mode standalone, and legacy iOS standalone.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test:unit tests/unit/pwa-install-status.test.ts`
Expected: FAIL because `@/lib/pwa-install-status` does not exist.

- [ ] **Step 3: Implement minimal pure helper**

Use explicit environment values rather than accessing globals inside pure functions. Mobile eligibility should treat Android user agents as eligible and reject iOS/iPadOS and ordinary desktop user agents.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test:unit tests/unit/pwa-install-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add PWA install status helpers"`

### Task 2: Add browser install prompt lifecycle

**Files:**

- Create: `src/components/layout/pwa-install-prompt.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**

- Consumes `isStandalonePwa` and `shouldOfferPwaInstall`.
- Handles a local `BeforeInstallPromptEvent` shape with `prompt()` and `userChoice`.

- [ ] **Step 1: Implement client event lifecycle**

On mount:

1. Listen for `beforeinstallprompt` and `appinstalled`.
2. Prevent the browser's immediate prompt and retain the event.
3. Read `assets-tracker:pwa-install-prompt-dismissed` defensively.
4. Evaluate standalone/mobile eligibility.
5. Show `toast.info` with localized English/Traditional-Chinese copy selected from the active locale.
6. Add an `Install` action that calls `prompt()` and awaits `userChoice`.
7. Persist dismissal when the browser prompt is declined or when the toast is manually dismissed.
8. Dismiss the toast and clear the deferred event on `appinstalled`.
9. Remove listeners on cleanup.

- [ ] **Step 2: Mount prompt in root locale provider**

Import and render `<PwaInstallPrompt />` beside the existing client locale helpers so locale state is available. Do not modify `LazyToaster` or `src/components/ui/sonner.tsx`.

- [ ] **Step 3: Static verification**

Run `pnpm lint && pnpm typecheck`.
Expected: PASS.

- [ ] **Step 4: Commit**

`git commit -m "feat: add Android PWA install prompt"`

### Task 3: Add launcher icon assets

**Files:**

- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-192.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `src/app/apple-icon.png`

- [ ] **Step 1: Generate raster icon variants from current SVG artwork**

Reproduce the current visual mark: dark-to-emerald diagonal gradient rounded-square background and white upward growth line. For maskable variants, keep the growth mark within the central safe zone while allowing the background to fill the full square.

- [ ] **Step 2: Inspect dimensions**

Verify exact pixel dimensions are 192, 512, 192, 512, and 180 respectively.

- [ ] **Step 3: Commit**

`git commit -m "assets: add PWA launcher icons"`

### Task 4: Update manifest and launch metadata

**Files:**

- Modify: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Create: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Write failing manifest test**

Import the manifest function and assert icon entries include:

- `/icons/icon-192.png`, 192x192, `any`
- `/icons/icon-512.png`, 512x512, `any`
- `/icons/icon-maskable-192.png`, 192x192, `maskable`
- `/icons/icon-maskable-512.png`, 512x512, `maskable`

Also assert `display === "standalone"` and the existing dark-green theme/background values remain present.

- [ ] **Step 2: Run test and verify RED**

Run `pnpm test:unit tests/unit/manifest.test.ts`.
Expected: FAIL against the current SVG/apple-only icon list.

- [ ] **Step 3: Update manifest and root metadata**

Replace install icon declarations with the four raster launcher entries while retaining the current manifest name, start URL, standalone display, portrait orientation, and dark-green launch colors. Add `applicationName: "Assets Tracker"` to root metadata and retain existing `appleWebApp` metadata.

- [ ] **Step 4: Run test and verify GREEN**

Run `pnpm test:unit tests/unit/manifest.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: polish PWA manifest metadata"`

### Task 5: Final verification

- [ ] **Step 1: Run full unit suite**

Run `pnpm test:unit`.

- [ ] **Step 2: Run project checks**

Run `pnpm format:check && pnpm lint && pnpm typecheck`.

- [ ] **Step 3: Review branch diff**

Confirm changes are limited to the PWA install helper/component, manifest/layout metadata, launcher icon assets, tests, and spec/plan. Confirm no service-worker or shared Sonner changes.
