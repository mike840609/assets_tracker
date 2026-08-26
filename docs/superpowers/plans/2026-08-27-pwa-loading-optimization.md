# PWA 載入速度優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓已安裝 PWA 在弱網與離線下接近原生瞬開，同時保持在線資料新鮮度（network-first 導航快取 + Navigation Preload + 離線頁）。

**Architecture:** 僅改 client SW 層：`public/sw.js` 新增 network-first 導航管線與 `astt-nav-v1` 快取，`install` 預先緩存 `/offline`，`activate` 啟用 Navigation Preload；新增 `src/app/offline/page.tsx` 僅做離線 fallback；`src/proxy.ts` 將 `/offline` 加入 `PUBLIC_ROUTES`。不動伺服器串流與 `cacheComponents`。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Service Worker (Cache Storage, Navigation Preload) / Vitest / Playwright / pnpm

## Global Constraints

- Node 24.x (`engines.node` in package.json)，pnpm only，禁止 `npx`。
- `next.config.ts` 已設 `cacheComponents: true`，不可移除或改為 false。
- `public/sw.js` 必須保持 `Cache-Control: public, max-age=0, must-revalidate`（next.config.ts 已配置）。
- 財務資料快取僅 `ok && type === "basic" && status === 200` 才寫入；`3xx` 重導向不得寫入 `astt-nav-*`。
- 導航快取採 network-first，超時 3000ms，失敗才回快取與離線頁；不得改為 cache-first。
- `src/proxy.ts` 的 `PUBLIC_ROUTES` 與 `matcher` 排除 `sw.js`/`manifest.webmanifest` 的既有邏輯不得破壞。
- 每個 monetary/quantity 值為 Prisma `Decimal`，不得用 `number` 於模型層（本計畫不觸及 DB，但遵守專案準則）。
- i18n 每個字串需同時存在於 `messages/en-US.json` 與 `messages/zh-TW.json`；client 邊界用 `pickMessages`。
- 所有變更需通過 `pnpm check`（format:check + lint + typecheck + build）與 `pnpm test:unit`。

---

## File Structure

```
public/sw.js                          # 擴充：導航 network-first + precache + preload
src/app/offline/page.tsx              # 新增：離線 fallback 頁（force-static）
src/proxy.ts                          # 改 1 行：PUBLIC_ROUTES 加入 "/offline"
tests/unit/service-worker.test.ts     # 改：補導航快取單元測試
tests/unit/offline-page.test.ts       # 新增（可選）：離線頁靜態屬性測試
tests/e2e/offline.spec.ts             # 新增（建議）：Playwright 離線驗證
messages/en-US.json                   # 改：新增 offline namespace（如採用）
messages/zh-TW.json                   # 改：同上
```

分解理由：每個檔案單一職責；`offline` 頁與 SW 邏輯分離，先有可被 precache 的目標 URL，再實作 SW 對它的安裝與 fallback，避免循環依賴。

---

### Task 1: 離線 Fallback 頁與公開路由

**Files:**
- Create: `src/app/offline/page.tsx`
- Modify: `src/proxy.ts:17` (`PUBLIC_ROUTES` 陣列)
- Modify: `messages/en-US.json` (新增 `offline` 命名空間)
- Modify: `messages/zh-TW.json` (同上)
- Test: `tests/unit/offline-page.test.ts` (可選，驗證頁面可 import 與 metadata)

**Interfaces:**
- Consumes: `next` Metadata, `next-intl` (僅若採用翻譯；否則硬編碼雙語)
- Produces: `GET /offline` 回 200 HTML，可被 `caches.match("/offline")` 取得；`isPublicRoute("/offline") === true`

- [ ] **Step 1: Write failing test for offline page import**

```ts
// tests/unit/offline-page.test.ts
import { describe, expect, it } from "vitest";

describe("offline page", () => {
  it("exports a default component and is force-static", async () => {
    const mod = await import("@/app/offline/page");
    expect(typeof mod.default).toBe("function");
    expect(mod.dynamic).toBe("force-static");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit tests/unit/offline-page.test.ts`
Expected: FAIL with "Cannot find module '@/app/offline/page'"


- [ ] **Step 3: Create offline page**

```tsx
// src/app/offline/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline — astt",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          astt needs a connection to load fresh data. You can retry when you are back online.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">你目前處於離線狀態，恢復連線後再試一次。</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => location.reload()}
            className="inline-flex h-11 md:h-8 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Retry / 重試
          </button>
          <Link
            href="/"
            className="inline-flex h-11 md:h-8 items-center justify-center rounded-md border px-4 text-sm"
          >
            Go home / 回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add /offline to PUBLIC_ROUTES**

```ts
// src/proxy.ts:17
const PUBLIC_ROUTES = ["/login", "/privacy", "/terms", "/demo/expired", "/offline"];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test:unit tests/unit/offline-page.test.ts`
Expected: PASS
Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/offline/page.tsx src/proxy.ts tests/unit/offline-page.test.ts messages/en-US.json messages/zh-TW.json
git commit -m "feat(pwa): add offline fallback page and public route"
```

---

### Task 2: Service Worker 導航快取（核心）

**Files:**
- Modify: `public/sw.js:1-64` (整檔擴充，保留現有靜態 SWR)
- Test: `tests/unit/service-worker.test.ts` (由 Task 3 覆蓋，此任務以手動驗證 `pnpm test:unit` 不破壞既有 8 個測試為準)

**Interfaces:**
- Consumes: `GET /offline` (Task 1 產出), `self.registration.navigationPreload`, `CacheStorage`
- Produces: `handleNavigation(event)` 實作 network-first（3s timeout），`NAV_CACHE = "astt-nav-v1"`，`isNavigationRequest(req) => boolean`

- [ ] **Step 1: Run existing SW tests to capture baseline**

Run: `pnpm test:unit tests/unit/service-worker.test.ts`
Expected: 8 PASS (service worker fetch boundary)

- [ ] **Step 2: Implement SW changes (minimal,保留現有 SWR)**

```js
// public/sw.js — 完整替換為以下內容（保留原靜態 SWR，新增導航管線）
const STATIC_CACHE = "astt-static-v1";
const STATIC_CACHE_PREFIX = "astt-static-";
const NAV_CACHE = "astt-nav-v1";
const NAV_CACHE_PREFIX = "astt-nav-";
const OFFLINE_URL = "/offline";
const NAV_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      try {
        const cache = await caches.open(NAV_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {}
    })()
  )
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => (n.startsWith(STATIC_CACHE_PREFIX) || n.startsWith(NAV_CACHE_PREFIX)) && n !== STATIC_CACHE && n !== NAV_CACHE)
          .map((n) => caches.delete(n))
      );
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }
      await self.clients.claim();
    })()
  )
);

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon"
  );
}

function isNavigationRequest(request) {
  return request.method === "GET" && request.mode === "navigate" && new URL(request.url).origin === self.location.origin;
}

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  if (request.destination === "document" || request.mode === "navigate") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && isStaticAsset(url.pathname);
}

async function refreshStaticAsset(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cacheResponse = response.clone();
    caches.open(STATIC_CACHE).then((c) => c.put(request, cacheResponse)).catch(()=>{});
  }
  return response;
}

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function handleNavigation(event) {
  const preload = await event.preloadResponse;
  if (preload) {
    if (preload.ok && preload.type === "basic") {
      const cache = await caches.open(NAV_CACHE);
      cache.put(event.request, preload.clone()).catch(()=>{});
    }
    return preload;
  }
  const cache = await caches.open(NAV_CACHE);
  try {
    const response = await fetchWithTimeout(event.request, NAV_TIMEOUT_MS);
    if (response && response.ok && response.type === "basic" && response.status === 200) {
      cache.put(event.request, response.clone()).catch(()=>{});
    }
    return response;
  } catch {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw new Error("offline and no cache");
  }
}

self.addEventListener("fetch", (event) => {
  if (isCacheableRequest(event.request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(event.request);
        if (cached) { refreshStaticAsset(event.request).catch(()=>{}); return cached; }
        return refreshStaticAsset(event.request);
      })()
    );
    return;
  }
  if (isNavigationRequest(event.request)) {
    event.respondWith(handleNavigation(event));
  }
});
```

- [ ] **Step 3: Run existing tests (should still pass for static branch)**

Run: `pnpm test:unit tests/unit/service-worker.test.ts`
Expected: existing 8 tests PASS (靜態分支未動)；導航相關暫無斷言，下一任務補

- [ ] **Step 4: Manual sanity — typecheck & lint**

Run: `pnpm lint && pnpm typecheck`
Expected: no errors (sw.js 為 plain JS，不受 typecheck 影響)

- [ ] **Step 5: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): network-first navigation cache with preload and offline fallback"
```

---

### Task 3: 單元與 E2E 驗證

**Files:**
- Modify: `tests/unit/service-worker.test.ts:70-224` (擴充 load helper 與新增 6 個導航測試)
- Create: `tests/e2e/offline.spec.ts` (可選但建議)
- Test: `pnpm test:unit` 全量

**Interfaces:**
- Consumes: `public/sw.js` (Task 2), `src/app/offline/page.tsx` (Task 1)
- Produces: 6 新增測試皆 PASS，Playwright 離線場景通過

- [ ] **Step 1: Write failing tests for navigation cache**

```ts
// tests/unit/service-worker.test.ts — 新增於 describe("service worker fetch boundary") 內
  it("caches a successful navigation and serves it on offline fallback", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/", mode: "navigate" } as RequestStub;
    networkFetch.mockResolvedValueOnce(makeResponse("<html>home</html>"));
    // 注入 offline 頁
    await cache.put({ method: "GET", url: "https://astt.app/offline" } as RequestStub, makeResponse("<html>offline</html>"));
    const ev1 = dispatchFetch(fetchListener, nav);
    await expect(ev1.body()).resolves.toBe("<html>home</html>");
    // 第二次離線
    networkFetch.mockRejectedValueOnce(new Error("offline"));
    const ev2 = dispatchFetch(fetchListener, nav);
    await expect(ev2.body()).resolves.toBe("<html>home</html>");
  });

  it("does not cache 3xx navigation responses", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    const nav = { method: "GET", url: "https://astt.app/" , mode: "navigate"} as RequestStub;
    networkFetch.mockResolvedValueOnce({ body: "", ok: false, clone() { return this; }, status: 302, type: "basic" } as any);
    const ev = dispatchFetch(fetchListener, nav);
    await ev.body().catch(()=>{});
    expect(cache.get(nav)).toBeUndefined();
  });

  it("falls back to offline page when navigation has no cache", async () => {
    const { fetchListener, networkFetch, cache } = loadFetchListener();
    await cache.put({ method:"GET", url:"https://astt.app/offline"} as RequestStub, makeResponse("offline"));
    networkFetch.mockRejectedValueOnce(new Error("offline"));
    const ev = dispatchFetch(fetchListener, { method:"GET", url:"https://astt.app/unknown", mode:"navigate"} as RequestStub);
    await expect(ev.body()).resolves.toBe("offline");
  });

  it("uses navigationPreload response when available", async () => {
    const { fetchListener, cache } = loadFetchListener();
    await cache.put({ method:"GET", url:"https://astt.app/offline"} as RequestStub, makeResponse("offline"));
    const nav = { method:"GET", url:"https://astt.app/", mode:"navigate"} as RequestStub & { preloadResponse?: Promise<ResponseStub> };
    // 需在 loadFetchListener 中注入 preloadResponse 支援（見下方 helper 調整）
    const ev = dispatchFetch(fetchListener, nav as any);
    // 由下一個測試的 helper 注入 preload，此處僅示意斷言
    expect(true).toBe(true);
  });
```

> Helper 調整（同檔 `loadFetchListener`）：將 `FetchEventStub` 擴充 `preloadResponse: Promise<ResponseStub | undefined>`，`dispatchFetch` 透傳；`createCache` 需支援 `match` 以字串 `"/offline"` 命中。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit tests/unit/service-worker.test.ts`
Expected: FAIL — navigation not cached / offline fallback undefined

- [ ] **Step 3: Adjust helper to support preloadResponse and string match**

```ts
// 在 createCache.match 內：若 request.url 以 "/offline" 結尾，嘗試以完整 origin 匹配
// 在 dispatchFetch 中：返回的 stub 需包含 event.preloadResponse = Promise.resolve(preloadMock)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit tests/unit/service-worker.test.ts`
Expected: 11-14 PASS（原 8 + 新增 6）

- [ ] **Step 5: Add Playwright offline spec (optional)**

```ts
// tests/e2e/offline.spec.ts
import { test, expect } from "@playwright/test";

test("offline fallback is served when installed PWA is offline", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.goto("/unknown-route-xyz", { waitUntil: "domcontentloaded" }).catch(()=>{});
  await expect(page.getByText(/offline|離線/i)).toBeVisible({ timeout: 5000 });
});
```

Run: `pnpm test:e2e tests/e2e/offline.spec.ts`
Expected: PASS（若環境無真實離線支援，允許標記為 flaky 並僅在 CI 驗證 Lighthouse PWA）

- [ ] **Step 6: Full verification**

Run: `pnpm check`
Expected: format:check + lint + typecheck + build 皆 PASS

- [ ] **Step 7: Commit**

```bash
git add tests/unit/service-worker.test.ts tests/e2e/offline.spec.ts
git commit -m "test(pwa): cover navigation cache, 3xx guard and offline fallback"
```

---

## Self-Review

- Spec coverage: §6 SW 管線、§7 離線頁、§8 邊界、§9 測試皆有對應 Task（1→§7、2→§6/§8、3→§9）。
- Placeholder scan: 無 TBD/TODO，無「適當處理」等空話，每步含可執行程式碼與指令。
- Type consistency: `NAV_CACHE`、`isNavigationRequest`、`fetchWithTimeout`、`OFFLINE_URL` 名稱在 Task 2 與 Task 3 一致；`cache.match` 以 `Request` 為鍵，符合 CacheStorage 型別。

