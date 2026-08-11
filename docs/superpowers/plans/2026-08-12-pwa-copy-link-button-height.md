# PWA Copy-Link Button Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase only the Safari PWA hint Copy link / Copied action button height from Sonner's 24px default to exactly 36px without changing the toast size or other Sonner buttons.

**Architecture:** Keep the change local to `PwaInstallHint` by using Sonner's per-toast `actionButtonStyle` option. Lock the contract with the existing source-based toast behavior unit tests so a future refactor cannot accidentally remove the 36px height or move it into the shared toaster.

**Tech Stack:** React 19, TypeScript, Sonner 2.0.7, Vitest.

## Global Constraints

- The PWA hint action button height must be exactly 36px.
- Do not change the shared `src/components/ui/sonner.tsx` component.
- Do not change global Sonner CSS or default button sizing.
- Keep existing action width behavior, horizontal padding, color, border radius, toast dimensions, Copy/Copied behavior, and persistent-toast behavior unchanged.

---

### Task 1: Add a PWA-specific 36px action-button contract

**Files:**

- Modify: `tests/unit/pwa-install-hint.test.ts`
- Modify: `src/components/layout/pwa-install-hint.tsx`

**Interfaces:**

- Consumes: Sonner per-toast `actionButtonStyle` option.
- Produces: the existing PWA hint action rendered with `height: 36` only for this toast.

- [ ] **Step 1: Write the failing regression test**

Extend the `PwaInstallHint toast behavior` suite:

```ts
it("uses a 36px action button without changing the shared toaster", () => {
  const source = readFileSync("src/components/layout/pwa-install-hint.tsx", "utf8");
  const sharedToaster = readFileSync("src/components/ui/sonner.tsx", "utf8");

  expect(source).toContain("actionButtonStyle: { height: 36 }");
  expect(sharedToaster).not.toContain("actionButtonStyle");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Expected: FAIL because `PwaInstallHint` does not yet set `actionButtonStyle: { height: 36 }`.

- [ ] **Step 3: Implement the minimal local style override**

Inside the existing `toast.info(copy.title, { ... })` options in `showToast`, add:

```ts
actionButtonStyle: { height: 36 },
```

Place it next to the existing `action` configuration. Do not modify `src/components/ui/sonner.tsx`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/unit/pwa-install-hint.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/pwa-install-hint.test.ts src/components/layout/pwa-install-hint.tsx
git commit -m "style: increase PWA copy-link button height"
```

### Task 2: Repository verification

**Files:** no new production files.

- [ ] **Step 1: Run the PR CI-equivalent checks**

Verify format, lint, typecheck, unit tests, PostgreSQL integration, production build / bundle-size, and Playwright smoke tests on the final head SHA.

- [ ] **Step 2: Verify PR status**

Confirm PR #680 remains open and mergeable and that the final head SHA is the SHA whose CI and E2E workflows succeeded.
