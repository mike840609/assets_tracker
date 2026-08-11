# Safari PWA Install Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a one-time localized Sonner toast to iPhone/iPad users in non-Safari browsers, suggesting Safari → Share → Add to Home Screen for an app-like experience.

**Architecture:** Keep browser eligibility logic in a pure helper so it is easy to unit test in the existing Node-based Vitest setup. A small client component reads real browser state, checks localStorage, calls the helper, shows the existing Sonner toast, and persists the shown flag; the root layout mounts this component inside the existing NextIntl provider while the shared toaster remains unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl, Sonner, Vitest.

## Global Constraints

- Show only on iOS/iPadOS when the current browser is not Safari.
- Never show in standalone / installed PWA mode.
- Never show after `assets-tracker:pwa-safari-hint-shown` has been persisted.
- Browser/storage detection failures must fail silently and must not affect application rendering.
- Safari detection must exclude `CriOS`, `FxiOS`, `EdgiOS`, and `OPiOS`.
- Do not change service-worker registration, manifest behavior, Android install behavior, or the shared Sonner component.
- Add both English and Traditional Chinese UI copy.

---

### Task 1: Add and test pure PWA hint eligibility logic

**Files:**

- Create: `src/lib/pwa-install-hint.ts`
- Create: `tests/unit/pwa-install-hint.test.ts`

**Interfaces:**

- Produces: `shouldShowSafariPwaHint(input: SafariPwaHintEnvironment): boolean`
- `SafariPwaHintEnvironment` contains `userAgent: string`, `platform: string`, `maxTouchPoints: number`, `isStandalone: boolean`, and `hasBeenShown: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/pwa-install-hint.test.ts` with focused cases for iPhone Chrome, iPhone Firefox, iPhone Safari, Android Chrome, desktop Chrome, iPadOS desktop-style user agent, standalone mode, and already-shown state.

```ts
import { describe, expect, it } from "vitest";
import { shouldShowSafariPwaHint } from "@/lib/pwa-install-hint";

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const base = {
  userAgent: iphoneSafari,
  platform: "iPhone",
  maxTouchPoints: 5,
  isStandalone: false,
  hasBeenShown: false,
};

describe("shouldShowSafariPwaHint", () => {
  it("shows on iPhone Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(true);
  });

  it("shows on iPhone Firefox", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/142.0 Mobile/15E148 Safari/605.1.15",
      }),
    ).toBe(true);
  });

  it("does not show on iPhone Safari", () => {
    expect(shouldShowSafariPwaHint(base)).toBe(false);
  });

  it("does not show on Android Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "Linux armv8l",
        userAgent:
          "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
      }),
    ).toBe(false);
  });

  it("does not show on desktop Chrome", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "MacIntel",
        maxTouchPoints: 0,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      }),
    ).toBe(false);
  });

  it("shows for iPadOS desktop-style user agent in a non-Safari browser", () => {
    expect(
      shouldShowSafariPwaHint({
        ...base,
        platform: "MacIntel",
        maxTouchPoints: 5,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 CriOS/140.0.0.0 Version/18.0 Safari/605.1.15",
      }),
    ).toBe(true);
  });

  it("does not show in standalone mode", () => {
    expect(shouldShowSafariPwaHint({ ...base, isStandalone: true })).toBe(false);
  });

  it("does not show after the hint has already been shown", () => {
    expect(shouldShowSafariPwaHint({ ...base, hasBeenShown: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test:unit tests/unit/pwa-install-hint.test.ts`

Expected: FAIL because `@/lib/pwa-install-hint` does not exist yet.

- [ ] **Step 3: Implement the minimal pure helper**

Create `src/lib/pwa-install-hint.ts` with explicit iOS/iPadOS and Safari classification. Treat `MacIntel` + `maxTouchPoints > 1` as iPadOS. Treat a browser as Safari only when its user agent contains `Safari` and does not contain `CriOS`, `FxiOS`, `EdgiOS`, or `OPiOS`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test:unit tests/unit/pwa-install-hint.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pwa-install-hint.ts tests/unit/pwa-install-hint.test.ts
git commit -m "feat: add Safari PWA hint eligibility logic"
```

### Task 2: Add localized client toast and mount it in the root layout

**Files:**

- Create: `src/components/layout/pwa-install-hint.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`

**Interfaces:**

- Consumes: `shouldShowSafariPwaHint(...)` from Task 1.
- Produces: `PwaInstallHint` client component with no props.

- [ ] **Step 1: Add localized strings**

Add a top-level `pwaInstallHint` namespace to both locale files.

English:

```json
"pwaInstallHint": {
  "title": "Use Assets Tracker like an app",
  "description": "Open this site in Safari, then tap Share → Add to Home Screen for a more app-like experience."
}
```

Traditional Chinese:

```json
"pwaInstallHint": {
  "title": "像 App 一樣使用 Assets Tracker",
  "description": "使用 Safari 開啟後，點選分享 → 加入主畫面，即可獲得更接近原生 App 的體驗。"
}
```

- [ ] **Step 2: Implement the client component**

Create `src/components/layout/pwa-install-hint.tsx` as a `"use client"` component. In a single `useEffect`:

1. Read `navigator.userAgent`, `navigator.platform`, and `navigator.maxTouchPoints`.
2. Determine standalone mode using both `window.matchMedia("(display-mode: standalone)").matches` and legacy `(navigator as Navigator & { standalone?: boolean }).standalone === true`.
3. Read `assets-tracker:pwa-safari-hint-shown` from localStorage in a guarded `try/catch`.
4. Call `shouldShowSafariPwaHint`.
5. When eligible, call `toast.info(t("title"), { description: t("description") })`.
6. Persist the key to `"1"` after the toast is triggered, also in guarded storage handling.
7. Return `null`.

Use `useTranslations("pwaInstallHint")`; do not hard-code localized copy in the component.

- [ ] **Step 3: Mount inside the locale provider**

In `src/app/layout.tsx`:

1. Import `PwaInstallHint`.
2. Add `"pwaInstallHint"` to the `pickMessages` namespace list.
3. Render `<PwaInstallHint />` inside `LocaleProviders`, after `<HtmlLangSync />`, so it has access to localized messages.
4. Leave `<LazyToaster />` in its current root position and do not modify `src/components/ui/sonner.tsx`.

- [ ] **Step 4: Run static verification**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit tests/unit/pwa-install-hint.test.ts
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/pwa-install-hint.tsx src/app/layout.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat: suggest Safari PWA install on iOS"
```

### Task 3: Final verification

**Files:** No new files.

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm test:unit`

Expected: PASS.

- [ ] **Step 2: Run project checks**

Run: `pnpm lint && pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Review the branch diff**

Confirm the branch changes are limited to the spec/plan, the pure helper + tests, the small client component, root-layout wiring, and two locale files. Confirm no service-worker, manifest, Android install, or shared Sonner changes are present.
