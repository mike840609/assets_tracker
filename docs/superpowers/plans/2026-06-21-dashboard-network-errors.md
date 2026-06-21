# Dashboard Network Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve browser Sentry telemetry behind privacy filters and restore Google avatar loading without weakening the application's Content Security Policy.

**Architecture:** Enable the Sentry Next.js SDK's randomized same-origin tunnel so browser envelopes are rewritten to Sentry without exposing the ingest host to Brave. Restrict the network-only service worker to same-origin GET interception so cross-origin images bypass `fetch()` and remain governed by `img-src`.

**Tech Stack:** Next.js 16.2.2, `@sentry/nextjs` 10.57.0, browser Service Worker API, TypeScript 5, Vitest 4, pnpm 11.

**Design:** `docs/superpowers/specs/2026-06-21-dashboard-network-errors-design.md`

## Global Constraints

- Use pnpm; do not use npm or npx.
- Keep the current Sentry DSNs, sampling, sanitization, environment, release, and server/edge initialization unchanged.
- Do not broaden `connect-src`; `https://lh3.googleusercontent.com` remains allowed only by the existing `img-src` directive.
- Keep the service worker network-only: no cache, offline mode, retry loop, or custom response fallback.
- Do not change dashboard components, the avatar component, authentication rules, or Sentry event payloads.
- Keep `src/lib/changelog.ts` and `package.json` in lockstep at version `0.8.4` because the repository requires a patch release for user-facing bug fixes.
- Before claiming completion, run formatting, linting, type checking, unit tests, a production build, manifest inspection, and focused browser verification.

## File Map

- `public/sw.js` — owns the service worker lifecycle and the same-origin GET interception boundary.
- `tests/unit/service-worker.test.ts` — executes `public/sw.js` in an isolated VM and verifies request interception decisions.
- `next.config.ts` — owns the Sentry build integration and randomized tunnel rewrite.
- `tests/unit/next-config.test.ts` — verifies that the wrapped Next.js config contains a randomized regional Sentry tunnel rewrite.
- `src/lib/changelog.ts` — publishes bilingual `0.8.4` release notes.
- `package.json` — keeps package metadata synchronized with the application release.

---

### Task 1: Restrict the service worker to same-origin GET requests

**Files:**

- Create: `tests/unit/service-worker.test.ts`
- Modify: `public/sw.js:1-10`

**Interfaces:**

- Consumes: `FetchEvent.request.method`, `FetchEvent.request.url`, `ServiceWorkerGlobalScope.location.origin`, and `FetchEvent.respondWith()`.
- Produces: a fetch listener that intercepts same-origin `GET` requests only; it exports no module API.

- [ ] **Step 1: Write the failing service-worker boundary tests**

Create `tests/unit/service-worker.test.ts` with this complete content:

```ts
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface FetchEventStub {
  request: { method: string; url: string };
  respondWith: (response: unknown) => void;
}

type FetchListener = (event: FetchEventStub) => void;

function loadFetchListener() {
  let fetchListener: FetchListener | undefined;
  const networkResponse = Promise.resolve({ ok: true });
  const networkFetch = vi.fn(() => networkResponse);
  const serviceWorker = {
    location: { origin: "https://astt.app" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener(type: string, listener: unknown) {
      if (type === "fetch") fetchListener = listener as FetchListener;
    },
  };

  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(source, { self: serviceWorker, fetch: networkFetch, URL });

  if (!fetchListener) throw new Error("public/sw.js did not register a fetch listener");
  return { fetchListener, networkFetch, networkResponse };
}

describe("service worker fetch boundary", () => {
  it("passes same-origin GET requests through the network", () => {
    const { fetchListener, networkFetch, networkResponse } = loadFetchListener();
    const respondWith = vi.fn();
    const request = { method: "GET", url: "https://astt.app/dashboard" };

    fetchListener({ request, respondWith });

    expect(networkFetch).toHaveBeenCalledWith(request);
    expect(respondWith).toHaveBeenCalledWith(networkResponse);
  });

  it("does not intercept cross-origin GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const respondWith = vi.fn();

    fetchListener({
      request: { method: "GET", url: "https://lh3.googleusercontent.com/avatar.png" },
      respondWith,
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(respondWith).not.toHaveBeenCalled();
  });

  it("does not intercept non-GET requests", () => {
    const { fetchListener, networkFetch } = loadFetchListener();
    const respondWith = vi.fn();

    fetchListener({
      request: { method: "POST", url: "https://astt.app/api/accounts" },
      respondWith,
    });

    expect(networkFetch).not.toHaveBeenCalled();
    expect(respondWith).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the cross-origin case fails**

Run:

```bash
pnpm exec vitest run tests/unit/service-worker.test.ts
```

Expected: `1 failed, 2 passed`; the failure says `networkFetch` was called for `https://lh3.googleusercontent.com/avatar.png`.

- [ ] **Step 3: Implement the same-origin boundary**

Replace `public/sw.js` with:

```js
// Minimal network-only service worker.
// Satisfies Chrome's PWA installability requirement (needs a fetch listener)
// without adding caching — same-origin GET requests pass through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method === "GET" && new URL(e.request.url).origin === self.location.origin) {
    e.respondWith(fetch(e.request));
  }
});
```

- [ ] **Step 4: Run the focused test and confirm all cases pass**

Run:

```bash
pnpm exec vitest run tests/unit/service-worker.test.ts
```

Expected: `3 passed` and exit code `0`.

- [ ] **Step 5: Commit the service-worker fix**

```bash
git add public/sw.js tests/unit/service-worker.test.ts
git commit -m "fix(pwa): bypass cross-origin service worker requests"
```

---

### Task 2: Enable and verify the randomized Sentry tunnel

**Files:**

- Create: `tests/unit/next-config.test.ts`
- Modify: `next.config.ts:128-145`

**Interfaces:**

- Consumes: `withSentryConfig()` from `@sentry/nextjs` and the existing browser DSN in `src/instrumentation-client.ts`.
- Produces: `NextConfig.rewrites()` containing randomized same-origin regional and non-regional Sentry envelope rewrites; the SDK injects the same route into the browser client.

- [ ] **Step 1: Write the failing Sentry rewrite test**

Create `tests/unit/next-config.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Sentry tunnel configuration", () => {
  it("adds a randomized same-origin regional envelope rewrite", async () => {
    expect(nextConfig.rewrites).toBeTypeOf("function");

    const rewrites = await nextConfig.rewrites?.();
    expect(Array.isArray(rewrites)).toBe(true);
    if (!Array.isArray(rewrites)) {
      throw new Error("Sentry tunnel rewrites are not configured as an array");
    }

    const regionalTunnel = rewrites.find(
      (rewrite) =>
        rewrite.destination ===
        "https://o:orgid.ingest.:region.sentry.io/api/:projectid/envelope/?hsts=0",
    );

    expect(regionalTunnel).toMatchObject({
      has: [
        { type: "query", key: "o", value: "(?<orgid>\\d*)" },
        { type: "query", key: "p", value: "(?<projectid>\\d*)" },
        { type: "query", key: "r", value: "(?<region>[a-z]{2})" },
      ],
    });
    expect(regionalTunnel?.source).toMatch(/^\/[a-z0-9]{8}\(\/\?\)$/);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the tunnel is absent**

Run:

```bash
pnpm exec vitest run tests/unit/next-config.test.ts
```

Expected: FAIL at `expect(nextConfig.rewrites).toBeTypeOf("function")` because the current config has no rewrite function.

- [ ] **Step 3: Enable the SDK-managed randomized tunnel**

Update the Sentry options at the end of `next.config.ts` to this exact block:

```ts
export default withSentryConfig(withBundleAnalyzer(wrappedConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Only upload source maps when an auth token is present; otherwise skip the
  // release/upload step entirely so token-less builds succeed.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Route browser telemetry through a randomized same-origin path so privacy
  // filters do not block direct requests to Sentry's ingest host.
  tunnelRoute: true,
  // Reduce bundle size by stripping Sentry SDK logger statements from prod.
  disableLogger: true,
  // Upload a broader set of source maps for readable browser stack traces.
  widenClientFileUpload: true,
});
```

Do not remove Sentry hosts from `connect-src`; keeping the current CSP byte-for-byte avoids expanding this task into a policy migration for previously cached clients.

- [ ] **Step 4: Run the focused test and confirm the rewrite is generated**

Run:

```bash
pnpm exec vitest run tests/unit/next-config.test.ts
```

Expected: `1 passed` and exit code `0`. A Sentry `disableLogger` deprecation warning may appear; changing that existing option is outside this fix.

- [ ] **Step 5: Commit the Sentry tunnel**

```bash
git add next.config.ts tests/unit/next-config.test.ts
git commit -m "fix(observability): tunnel browser events through app"
```

---

### Task 3: Publish the patch release metadata

**Files:**

- Modify: `src/lib/changelog.ts:39`
- Modify: `package.json:3`

**Interfaces:**

- Consumes: the repository's `Release` shape and `APP_VERSION = CHANGELOG[0].version` convention.
- Produces: bilingual version `0.8.4` release notes and matching package metadata.

- [ ] **Step 1: Prepend the `0.8.4` release entry**

Insert this object at the beginning of `CHANGELOG`, before version `0.8.3`:

```ts
  {
    version: "0.8.4",
    date: "2026-06-21",
    summary: {
      "en-US": "Reliable browser error reporting and Google avatar loading.",
      "zh-TW": "修正瀏覽器錯誤回報與 Google 頭像載入。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Browser error reports now use a first-party tunnel so privacy tools such as Brave Shields no longer block them.",
          "zh-TW":
            "瀏覽器錯誤回報現在透過第一方通道傳送，不再被 Brave Shields 等隱私防護工具阻擋。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Google profile avatars now load when the PWA service worker is active, without triggering Content Security Policy errors.",
          "zh-TW":
            "PWA 服務工作者啟用時，Google 個人頭像現在可正常載入，不再觸發內容安全政策錯誤。",
        },
      },
    ],
  },
```

- [ ] **Step 2: Synchronize the package version**

Change the version field in `package.json`:

```json
"version": "0.8.4"
```

- [ ] **Step 3: Format and type-check the release metadata**

Run:

```bash
pnpm exec prettier --write src/lib/changelog.ts package.json
pnpm typecheck
```

Expected: Prettier changes no unrelated files; TypeScript exits with code `0`.

- [ ] **Step 4: Commit the patch release metadata**

```bash
git add src/lib/changelog.ts package.json
git commit -m "chore(release): bump version to 0.8.4"
```

---

### Task 4: Verify the complete production behavior

**Files:** None.

**Interfaces:**

- Consumes: the two focused tests, Next.js build output, generated route manifest, service worker, and browser network panel.
- Produces: verification evidence only; no source changes.

- [ ] **Step 1: Run the full repository quality suite**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
```

Expected: every command exits with code `0`; the unit suite includes the three service-worker cases and the Sentry rewrite case.

- [ ] **Step 2: Build the production application**

Run:

```bash
pnpm build
```

Expected: Next.js completes the production build with exit code `0`. Existing deprecation warnings do not count as failures.

- [ ] **Step 3: Inspect the generated tunnel rewrite**

Run:

```bash
node <<'NODE'
const manifest = require("./.next/routes-manifest.json");
const groups = manifest.rewrites ?? {};
const rewrites = [
  ...(groups.beforeFiles ?? []),
  ...(groups.afterFiles ?? []),
  ...(groups.fallback ?? []),
];
const tunnel = rewrites.find((rewrite) =>
  rewrite.destination?.includes("ingest.:region.sentry.io/api/:projectid/envelope/"),
);
if (!tunnel) throw new Error("Generated Sentry tunnel rewrite was not found");
if (!/^\/[a-z0-9]{8}\(\/\?\)$/.test(tunnel.source)) {
  throw new Error(`Unexpected tunnel source: ${tunnel.source}`);
}
console.log(`${tunnel.source} -> ${tunnel.destination}`);
NODE
```

Expected: one randomized eight-character same-origin source is printed with the regional Sentry envelope destination.

- [ ] **Step 4: Verify the browser transport and service-worker boundary**

Start the built app:

```bash
pnpm start
```

Open `http://localhost:3000/login` in a Chromium browser with DevTools open, wait until `/sw.js` is activated, and reload once so the service worker controls the page. Confirm all of the following:

- Sentry session envelopes are `POST`ed to `http://localhost:3000/<eight-character-path>?o=...&p=...&r=us`, not directly to `*.ingest.us.sentry.io`.
- The tunnel request is not redirected to `/login` and does not show `(blocked:other)` or `ERR_BLOCKED_BY_CLIENT`.
- In the DevTools Console, run the following probe:

  ```js
  const probe = document.createElement("img");
  probe.alt = "Cross-origin service-worker boundary probe";
  probe.src = "https://lh3.googleusercontent.com/";
  document.body.append(probe);
  ```

  Confirm the resulting Google request is not marked as served or initiated by `sw.js` and creates no `connect-src` violation. Its remote HTTP/image result is irrelevant to this boundary check.

- The console contains no service-worker `Failed to fetch` rejection caused by the Google host.

Stop the server after collecting the results. If any check fails, return to the task that owns that behavior instead of changing CSP, authentication, or dashboard code.

- [ ] **Step 5: Confirm the worktree is clean**

Run:

```bash
git status --short
```

Expected: no output.

---

### Approved Amendment — Task 4a: Bypass auth for the exact Sentry tunnel path

**Approval:** The user added `src/proxy.ts` to scope on 2026-06-21 after live Chromium verification showed the randomized tunnel `POST` requests returning `302 Location: /login`.

**Files:**

- Create: `tests/unit/proxy.test.ts`
- Modify: `src/proxy.ts`
- Modify: `docs/superpowers/specs/2026-06-21-dashboard-network-errors-design.md`
- Modify: `docs/superpowers/plans/2026-06-21-dashboard-network-errors.md`

- [ ] **Test the exact boundary first:** Execute the real exported proxy function, mocking only NextAuth and auth config for module initialization. Set `_sentryRewritesTunnelPath`, require the exact anonymous pathname to return `x-middleware-next: 1` with no `Location`, and require a different anonymous protected pathname to redirect to `/login`. Run `pnpm exec vitest run tests/unit/proxy.test.ts` and observe RED before changing production code.
- [ ] **Add the minimal early guard:** Before auth rate limiting, session-cookie checks, or JWT work, return `NextResponse.next()` only when the configured tunnel path is non-empty and `req.nextUrl.pathname === process.env._sentryRewritesTunnelPath`. Do not add wildcard, prefix, query-only, matcher, or public-route bypasses.
- [ ] **Verify the amendment:** Run the focused proxy test GREEN, `pnpm exec vitest run tests/unit/next-config.test.ts`, and `pnpm test:unit`. Commit the source, test, and documentation changes as `fix(observability): bypass auth for Sentry tunnel`.
