# PWA 載入速度優化設計 — 已安裝啟動路徑

- **日期**: 2026-08-27
- **狀態**: Draft → 待審查
- **作者**: Sisyphus（與 Mike Tsai 共創）
- **方案**: B — Network-first 導航快取 + Navigation Preload + 離線頁
- **範圍**: 僅 client SW 層 + 1 離線頁，不動伺服器資料流與 PPR 架構

## 1. 背景與問題

astt 已是完整 PWA（`public/sw.js`、`src/app/manifest.ts`、icons、安裝提示），但 `sw.js:33` 明確排除所有 `destination === "document" || mode === "navigate"` 的導航請求：

```js
if (request.destination === "document" || request.mode === "navigate") return false;
```

後果：已安裝 PWA 每次啟動都要走完整網路鏈路（DNS → TLS → `proxy.ts` 驗證 → 伺服器渲染 → RSC payload），弱網下體感慢；離線時直接白屏。其他載入路徑已相當優秀（`cacheComponents: true` + 多層 Suspense、`"use cache"`、`dynamic()` 圖表、字型預載、middleware 快速路徑），唯獨「PWA 啟動」這一環缺口最大。

## 2. 目標與非目標

**目標**
- 已安裝 PWA 在弱網與離線下接近原生 app 的瞬開體驗（Lighthouse PWA 滿分）。
- 在線時資料永遠新鮮（network-first），不以舊資料換速度。

**非目標**
- 不改伺服器端 `cacheComponents` / `"use cache"` / `dashboard-content.tsx` 串流架構。
- 不做 cache-first App Shell + IndexedDB 持久化（成本過高，財務資料舊值風險）。
- 不引入 Workbox / `next-pwa` 等新依賴。
- 不做首次訪客 cold-load 的 bundle 減肥（可另案 Phase 2 處理 framer-motion LazyMotion）。

## 3. 現況分析摘要

| 已優化 | 證據 |
|---|---|
| PPR 串流殼 | `cacheComponents: true`，cookie 讀取包在 `Suspense`（`src/app/layout.tsx`） |
| 分層串流儀表板 | `dashboard-content.tsx` 四層 `Suspense`，首屏只等 settings + account count |
| 伺服器資料快取 | `"use cache"` + `cacheLife("hours")`（`net-worth-service.ts`） |
| 圖表延遲載入 | `lazy-charts.tsx` / `lazy-analysis-charts.tsx` 的 `dynamic()` |
| 套件 tree-shaking | `optimizePackageImports` 涵蓋 recharts、lucide 等（`next.config.ts`） |
| SW 靜態資源 | stale-while-revalidate（`public/sw.js`） |

缺口：導航 HTML 完全不經 SW，無 precache、無 navigationPreload、無離線頁。

## 4. 架構決策

- 導航請求採 **network-first**（非 cache-first）：有網路永遠拿新的，超時或失敗才回快取。
- 啟用 **Navigation Preload** 以消除 SW 啟動延遲（`activate` 時 `registration.navigationPreload.enable()`，`fetch` 時優先用 `event.preloadResponse`）。
- Cache 分層：保留 `astt-static-v1`（SWR），新增 `astt-nav-v1` 專放導航 HTML；兩者版本獨立，互不干擾。
- PWA 啟動超時閾值 3 秒（`Promise.race` / `AbortController`），兼顧體驗與避免誤判慢網路為離線。
- 改動邊界：僅 `public/sw.js` + 1 個離線頁 + `proxy.ts` 1 行 + 測試。

## 5. 元件與檔案清單

| 檔案 | 動作 | 說明 |
|---|---|---|
| `public/sw.js` | 改 | 新增導航管線、precache、navigationPreload、超時競賽；清理邏輯擴充至 `astt-nav-*` |
| `src/app/offline/page.tsx` | 新增 | 離線 fallback 頁，`export const dynamic = "force-static"` 以便 `install` 時可 precache；雙語、無需登入 |
| `src/proxy.ts` | 改 1 行 | `PUBLIC_ROUTES` 加入 `"/offline"`，否則離線頁被導向 `/login` |
| `src/app/manifest.ts` | 不動 | 已正確 |
| `next.config.ts` | 不動 | `sw.js` 的 `Cache-Control: public, max-age=0, must-revalidate` 已正確 |
| `tests/unit/service-worker.test.ts` | 改 | 補導航快取、precache、timeout、3xx 不快取、離線 fallback 單元測試 |
| `tests/e2e/offline.spec.ts` | 新增（建議） | Playwright `context.setOffline(true)` 驗證快取→離線→離線頁 |

## 6. 詳細設計 — SW 事件與快取策略

### 6.1 常數與判定

```js
const NAV_CACHE = "astt-nav-v1";
const NAV_CACHE_PREFIX = "astt-nav-";
const OFFLINE_URL = "/offline";
const NAV_TIMEOUT_MS = 3000;

function isNavigationRequest(req) {
  return req.method === "GET"
    && req.mode === "navigate"
    && new URL(req.url).origin === self.location.origin;
}
// isStaticAsset() 保留現有實作，不動
```

僅攔 `mode === "navigate"` 的同源 GET 整頁導航；RSC 局部更新（`fetch` + `Sec-Fetch-Mode: cors`）不攔，直通網路，避免把 fragment 誤當整頁快取。

### 6.2 install — precache 離線頁

```js
self.addEventListener("install", (event) =>
  event.waitUntil((async () => {
    self.skipWaiting(); // 保留
    const cache = await caches.open(NAV_CACHE);
    try { await cache.add(new Request(OFFLINE_URL, { cache: "reload" })); } catch {}
  })())
);
```

### 6.3 activate — 清理 + 啟用 preload

```js
self.addEventListener("activate", (event) =>
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => (n.startsWith(STATIC_CACHE_PREFIX) || n.startsWith(NAV_CACHE_PREFIX)) && n !== STATIC_CACHE && n !== NAV_CACHE)
      .map(n => caches.delete(n)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })())
);
```

### 6.4 fetch — 分流

```
fetch(event):
  if isCacheableRequest(event.request)  // 靜態資源既有邏輯
    → 現有 stale-while-revalidate（不動）
  else if isNavigationRequest(event.request)
    → network-first 管線（見 6.5）
  else
    → return（不攔截：API / RSC / 跨域）
```

### 6.5 導航 network-first 管線

```js
async function handleNavigation(event) {
  const preload = await event.preloadResponse;
  if (preload) {
    if (preload.ok && preload.type === "basic") {
      const c = await caches.open(NAV_CACHE);
      c.put(event.request, preload.clone()).catch(()=>{});
    }
    return preload;
  }

  const cache = await caches.open(NAV_CACHE);
  try {
    const response = await fetchWithTimeout(event.request, NAV_TIMEOUT_MS);
    if (response && response.ok && response.type === "basic" && response.status === 200) {
      // 不快取 3xx 重導向，避免把 /login 快取成儀表板
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

function fetchWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}
```

### 6.6 快取寫入規則

- 僅寫入 `ok && type === "basic" && status === 200`；`3xx`、`4xx/5xx`、`opaque` 不寫入。
- `PUBLIC_ROUTES` 外的重導向（例如未登入導向 `/login`）因此不會污染導航快取。

## 7. 離線頁設計

- 檔案：`src/app/offline/page.tsx`
- 屬性：`export const dynamic = "force-static"`；`export const metadata = { title: "Offline — astt" }`
- 內容：置中 `Card`、離線圖示（lucide `WifiOff`）、中英文說明、重試按鈕（`onClick={() => location.reload()}`）、回首頁 `Link`；樣式沿用 `globals.css` tokens 與現有 `Button` / `Card`
- i18n：新增 `messages/*/offline.json` 或復用 `common` + `errors` namespace，避免為單頁新增過重 bundle
- 可及性：按鈕 `h-11 md:h-8`（觸控 44px 規則）

## 8. 錯誤處理與邊界

| 情境 | 行為 |
|---|---|
| 非 GET / 跨域 | 不攔截 |
| 導航 3xx | 直接回傳，不寫快取 |
| 導航 4xx/5xx | 直接回傳，不寫快取 |
| 網路超時 3s | 回快取的 HTML；無快取則回離線頁 |
| 完全離線 | 同上 |
| 換用戶（同裝置登出再登入他人） | 有網路時永遠拿新頁；僅離線時可能短暫見舊快取，風險可接受 |
| iOS Safari | `navigationPreload` 需特性偵測，缺失時降級為普通 fetch；iOS 16.4+ 才有完整 SW PWA |
| SW 版本更新 | bump `NAV_CACHE` 版本號即觸發 `activate` 清理舊快取 |

## 9. 測試計畫

**單元**（`tests/unit/service-worker.test.ts`）
- precache：`install` 後 `caches.match("/offline")` 命中
- network-first 成功：`fetch` 200 → 寫入 `NAV_CACHE` → 回傳原 response
- 3xx 不快取：`fetch` 302 → 不寫入
- 超時 fallback：`fetch` 延遲 >3s → 回 `cache.match(request)`
- 離線 fallback：`fetch` 拋錯且無導航快取 → 回 `cache.match("/offline")`
- navigationPreload：`preloadResponse` 有值時優先使用並寫快取

**E2E**（`tests/e2e/offline.spec.ts`，建議）
- 在線訪問 `/` → `page.waitForResponse("**/offline")` 至少一次（precache 驗證可選）
- `context.setOffline(true)` 後重新導航 → 應見離線頁或快取頁，而非瀏覽器恐龍頁
- Lighthouse CI：`pwa` 類別含 `offline-start-url` 應通過

**手測**
- 安裝 PWA → 飛航模式 → 啟動 → 見離線頁
- 弱網（DevTools throttling Slow 3G）→ 3s 內應見快取頁而非長時間白屏

## 10. 風險與 Rollout

- 風險低：改動隔離在 SW + 1 靜態頁，不動伺服器串流；最壞刪除 SW 快取即回退。
- 上線：bump `NAV_CACHE` → 部署 → 已安裝 PWA 下次啟動自動更新 SW（`skipWaiting` + `claim`）。
- 無新依賴，無 `serverExternalPackages` 異動，無 CSP 異動（`offline` 同源）。

## 11. 後續可選（YAGNI，不在本設計範圍）

- Phase 2：`framer-motion` → `motion` + `LazyMotion` + `m`（14 檔直接 import → 省 30–50KB gzip）
- `public/icons/*` 長 Cache-Control（目前 SW 已覆蓋，效益小）

## 12. 參考

- 現有 SW：`public/sw.js`（64 行，SWR 僅靜態資源）
- Manifest：`src/app/manifest.ts`
- 儀表板串流：`src/components/dashboard/dashboard-content.tsx`（四層 Suspense）、`src/lib/services/net-worth-service.ts`（`"use cache"`）
- 中介層：`src/proxy.ts`（`PUBLIC_ROUTES`、`matcher` 排除 `sw.js`/`manifest.webmanifest`）
- 佈局與字型：`src/app/layout.tsx`（Geist woff2 預載、SW 註冊 `afterInteractive`）
- 舊 PWA 設計：`docs/superpowers/specs/2026-08-10-pwa-*.md`
