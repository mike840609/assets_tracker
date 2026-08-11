# PWA Copy-Link Toast Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localized Copy link action to the persistent iOS Safari guidance toast so users can copy the exact current page URL before switching browsers.

**Architecture:** Keep browser eligibility in `src/lib/pwa-install-hint.ts` and add a small injected clipboard helper there so success and failure can be unit tested without browser mocks. Keep toast rendering in `src/components/layout/pwa-install-hint.tsx`; use a stable Sonner toast id so a successful copy updates the existing toast action label to `Copied` / `已複製` without creating or dismissing another toast.

**Tech Stack:** TypeScript, React 19, next-intl locale selection, Sonner 2.0.7, Vitest.

## Global Constraints

- Copy `window.location.href` exactly, including path, query string, and hash.
- The toast remains visible with `duration: Number.POSITIVE_INFINITY` until the user explicitly closes it.
- Copying must never dismiss the toast.
- Clipboard failure must be silent and leave the Copy link action usable.
- No redirect, Safari deep link, Android changes, service-worker changes, or manifest changes.

---

### Task 1: Clipboard helper and regression tests

**Files:**

- Modify: `src/lib/pwa-install-hint.ts`
- Modify: `tests/unit/pwa-install-hint.test.ts`

**Interfaces:**

- Produces: `copyPageUrl(writeText: ((text: string) => Promise<void>) | undefined, href: string): Promise<boolean>`
- Returns `true` only when the clipboard write resolves; returns `false` when the API is missing or rejects.

- [x] **Step 1: Write failing tests**

Add tests that verify the helper passes the exact supplied URL to the clipboard writer, returns `true` on success, returns `false` when no writer is available, and returns `false` when the writer rejects.

- [x] **Step 2: Run tests to verify RED**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Observed: FAIL because `copyPageUrl` did not exist yet.

- [x] **Step 3: Implement the minimal helper**

```ts
export async function copyPageUrl(
  writeText: ((text: string) => Promise<void>) | undefined,
  href: string,
): Promise<boolean> {
  if (!writeText) return false;

  try {
    await writeText(href);
    return true;
  } catch {
    return false;
  }
}
```

- [x] **Step 4: Run focused tests to verify GREEN**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Observed: Clipboard helper cases PASS after implementation.

### Task 2: Localized persistent Copy link action

**Files:**

- Modify: `src/components/layout/pwa-install-hint.tsx`
- Modify: `tests/unit/pwa-install-hint.test.ts`

**Interfaces:**

- Consumes: `copyPageUrl(...)`
- Uses a stable toast id `pwa-safari-install-hint` so success updates the same toast.

- [x] **Step 1: Write failing toast-contract tests**

Assert the component source includes localized `Copy link` / `複製連結` and `Copied` / `已複製` copy, an `action` object, `window.location.href`, the stable toast id, synchronous `event.preventDefault()` to suppress Sonner's default action dismissal, and no `toast.dismiss` call from the copy path.

- [x] **Step 2: Run focused tests to verify RED**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Observed: FAIL only on the missing Copy link toast action after the clipboard helper tests were green.

- [x] **Step 3: Implement the minimal action**

Add `copyLink` and `copied` strings to both locales. Render the toast through a local `showToast(actionLabel)` function with the existing infinite duration and close button. The action synchronously calls `event.preventDefault()`, copies the current `window.location.href`, updates the same toast to `Copied` / `已複製` on success, and resets the label after two seconds without dismissing the toast.

- [x] **Step 4: Run focused tests to verify GREEN**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Observed: PASS as part of the full unit suite on the final implementation head.

### Task 3: Repository verification

**Files:** No new files.

- [x] **Step 1: Run repository checks**

The PR CI-equivalent checks completed successfully on implementation head `9030907bea723931f3f203510ed9ce01d40ceebd`: format, lint, typecheck, unit tests, PostgreSQL integration tests, production build / bundle-size, and Playwright authenticated/public Demo smoke tests.

- [x] **Step 2: Verify PR status**

PR #680 remained open and mergeable on implementation head `9030907bea723931f3f203510ed9ce01d40ceebd` with both CI and E2E workflows successful.
