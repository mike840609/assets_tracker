# Assets Tracker — Bundle Analysis

## Overview

We leveraged `@next/bundle-analyzer` to inspect the client, server, and edge bundles produced by the Next.js Turbopack/Webpack build. Below is a breakdown of actionable suggestions designed to reduce initial bundle delivery size and improve load performance (specifically aiming to improve LCP, FCP, and TTFB).

| #   | Suggestion                                                                      | Category    | Impact    | Effort | Status      |
| --- | ------------------------------------------------------------------------------- | ----------- | --------- | ------ | ----------- |
| B1  | Ensure `@prisma/client` and `@neondatabase/serverless` are strictly server-only | Bundle Size | 🔴 High   | 15 min | ❌ Not Done |
| B2  | Dynamic Import `AllocationChart` & `CurrencyExposureChart`                      | Bundle Size | 🔴 High   | 30 min | ❌ Not Done |
| B3  | Inspect `date-fns` usage for tree-shaking                                       | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B4  | Audit `lucide-react` usage                                                      | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B5  | Monitor `recharts` library payload                                              | Bundle Size | 🟡 Medium | 45 min | ❌ Not Done |
| B6  | Lazy-load `sonner` Toaster                                                      | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B7  | Restrict `zod` to Server Actions/API routes                                     | Bundle Size | 🔴 High   | 1 hr   | ❌ Not Done |
| B8  | Opt-out `yahoo-finance2` from client bundle via `server-only`                   | Bundle Size | 🔴 High   | 15 min | ❌ Not Done |
| B9  | Evaluate `next-intl` dictionary loading per route                               | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B10 | Migrate `swr` fetching to RSCs (Server Components)                              | Bundle Size | 🟡 Medium | 1 hr   | ❌ Not Done |
| B11 | Lazy-load `cmdk` (Command Palette)                                              | Bundle Size | 🟡 Medium | 15 min | ❌ Not Done |
| B12 | Audit `@base-ui/react` tree-shaking                                             | Bundle Size | 🟡 Medium | 30 min | ❌ Not Done |
| B13 | Profile `tw-animate-css` payload                                                | Bundle Size | 🟢 Low    | 15 min | ❌ Not Done |
| B14 | Optimize Root Layout Font preloading                                            | Performance | 🟡 Medium | 15 min | ❌ Not Done |
| B15 | Defer Vercel Analytics/Speed Insights                                           | Performance | 🟢 Low    | 10 min | ❌ Not Done |

## Methodology

Findings sourced from running `@next/bundle-analyzer` against the project locally on **2026-04-20**:

- Client bundle (`.next/analyze/client.html`) ~609 KB compiled.
- NodeJS bundle (`.next/analyze/nodejs.html`) ~866 KB compiled.
- Edge bundle (`.next/analyze/edge.html`) ~290 KB compiled.

## Detailed Enhancement Write-ups

### B1 — Strict Server-Only Boundaries

**Observation.** Huge packages such as `@prisma/client` and other database-related dependencies (e.g., `@neondatabase/serverless` or authentication adapters) take up a massive amount of space when bundled. Wait for client payloads to include them inadvertently if they leak into `use client` components.

**Recommendation.** Use the `server-only` package to explicitly reject imports of `prisma` utilities from client components. Create a hard barrier to ensure these never slip into the `.next/analyze/client.html` bundle.

**Critical files:**

- `src/lib/prisma.ts`
- Missing `npm i server-only`

---

### B2 — Dynamic-import Sibling Dashboard Charts

**Observation.** While `TrendChart` is dynamically imported in `src/components/dashboard/lazy-charts.tsx`, the `AllocationChart` and `CurrencyExposureChart` widgets might be eagerly loaded into the initial dashboard payload. This drags down FCP / LCP for the dashboard.

**Recommendation.**
Convert static imports to `next/dynamic` ones with suspense fallbacks, avoiding loading `recharts` overhead before it's needed or while off-screen.

**Critical files:**

- `src/components/dashboard/dashboard-content.tsx`
- `src/components/dashboard/lazy-charts.tsx`

---

### B3 — Inspect `date-fns` Usage

**Observation.** Currently `date-fns` is optimized via `optimizePackageImports` in `next.config.ts`, but it's important to verify inside the analyzer HTML trace whether it's compiling precisely only the utilized functions (`format`, `subDays`, etc.) and not bundling unused locales.

**Recommendation.** Review all date manipulations. Next.js 16 should resolve this out of the box with `optimizePackageImports`, but verifying the emitted node limits is recommended. Replace with lighter alternatives like `Intl.DateTimeFormat` natively if the load remains significant.

**Critical files:**

- Files under `src/components/**` importing `date-fns`.

---

### B4 — Audit `lucide-react` Usage

**Observation.** Like `date-fns` and `recharts`, `lucide-react` is placed in `next.config.ts`'s experimental `optimizePackageImports`. The bundle analyzer can verify if only the specific SVG icons used are injected into the client bundle payload instead of the full library index.

**Recommendation.** Double check the `.next/analyze/client.html` bundle tree visually to confirm `lucide-react` leaf nodes are the only things being compiled into the Webpack chunks.

**Critical files:**

- `next.config.ts`

---

### B5 — Recharts Payload Overhead

**Observation.** Recharts generally adds a large (~120-150KB) chunk size to whatever client-side boundary involves it. By making it dynamically imported (B2), this chunk should sit separately (`chunk-...`). However, its presence still affects TTI (Time to Interactive).

**Recommendation.** Verify whether the charts are strictly necessary on mobile breakpoints or if they can be conditionally loaded/rendered based on viewport.

**Critical files:**

- `src/components/dashboard/lazy-charts.tsx`

---

### B6 — Lazy-load `sonner` Toaster

**Observation.** Global toast libraries like `sonner` are often loaded at the root `<html />` layout level, pushing its bundle size unconditionally to all pages even if no toast is triggered on the initial load.

**Recommendation.** Use Next.js `next/dynamic` to dynamically import the `<Toaster />` component so it does not block the main thread and is only fetched when the client-side app eventually needs to use it.

**Critical files:**

- `src/app/layout.tsx`

---

### B7 — Restrict `zod` to Server boundaries

**Observation.** `zod` is a fantastic schema validation library, but its bundle size is around ~15KB (min+gzip). Having it ship to the client for form validations introduces noticeable overhead.

**Recommendation.** Shift all form validation and schema parsing to Next.js Server Actions using `zod`, completely dropping the library from the client-side chunk. If client validation is absolutely required to prevent network trips, consider evaluating leaner libraries (e.g. `valibot`).

**Critical files:**

- `src/components/**/holding-form.tsx` (and other forms)
- `package.json`

---

### B8 — Opt-out `yahoo-finance2` via `server-only`

**Observation.** Similar to the `@prisma/client` issue, `yahoo-finance2` handles financial requests heavily and has dependencies. It is meant to be Server-Only.

**Recommendation.** Verify that the `price-service.ts` or components leveraging `yahoo-finance2` are strictly marked with `'server-only'` to guarantee that no Next.js boundary leaks this entire SDK and its node-fetch fallbacks into the client chunk.

**Critical files:**

- `src/lib/services/price-service.ts`

---

### B9 — Evaluate `next-intl` dictionary loading

**Observation.** `next-intl` can bloat the client payload if the whole `en-US.json` or other active locales are loaded en-masse into the page props, regardless of how much text is actually needed by the rendered view.

**Recommendation.** Ensure the setup uses Server Components to parse and pass only the needed translation chunks to Client Components, rather than wrapping the entire app in `NextIntlClientProvider` with the complete JSON object loaded in the namespace.

**Critical files:**

- `src/app/layout.tsx`
- `src/i18n/request.ts`

---

### B10 — Migrate `swr` to RSC

**Observation.** The `swr` library provides client-side data fetching but requires bundling the fetching logic, state management, and the `swr` engine itself.

**Recommendation.** Take advantage of Next.js 16 Server Components and `use cache`. Moving data-fetching from the client (`useSWR`) to a server `await fetch(...)` natively eliminates the client-side library chunk completely while providing faster TTFB and SEO tracking natively.

**Critical files:**

- Client components currently using SWR Hooks

---

### B11 — Lazy-load `cmdk` (Command Palette)

**Observation.** Command menus (`cmdk`) are extremely useful but often include a significant chunk of logic and styles that are only needed when the user explicitly triggers the shortcut (e.g., `Cmd+K`).

**Recommendation.** Use a dynamic import for the Command Palette component. Only load the `cmdk` library when the user performs the trigger or hovers over a search UI element.

**Critical files:**

- Search or Shortcut handler components.

---

### B12 — Audit `@base-ui/react` Tree-shaking

**Observation.** The project uses `@base-ui/react` (the successor to Radix/headless UI). While it is designed to be tree-shakeable, certain patterns of exporting components in a shared `ui` folder can occasionally pull in more primitives than necessary.

**Recommendation.** Inspect the client bundle to ensure only the primitives actually used (Select, Dialog, Popover) appear in the output. If a single `index.ts` in a UI folder is re-exporting everything, it may defeat tree-shaking in some build configurations.

**Critical files:**

- `src/components/ui/*`

---

### B13 — Profile `tw-animate-css` Payload

**Observation.** Animation libraries can sometimes inject a large block of global CSS or JS-based animation logic.

**Recommendation.** Verify if `tw-animate-css` is strictly generating Tailwind utility classes at build time or if it's shipping a runtime animation engine. If it's the latter, evaluate if native Tailwind/CSS transitions are sufficient for the desired "rich aesthetics".

---

### B14 — Optimize Root Layout Font Preloading

**Observation.** Next.js Font optimization is present, but if the bundle analyzer shows the font files being fetched with high priority before the main JS chunks, it could compete for bandwidth during the critical FCP window.

**Recommendation.** Ensure Geist or other custom fonts are subsetted to only the characters needed for the initial render and that only the `400/700` weights are preloaded.

**Critical files:**

- `src/app/layout.tsx`

---

### B15 — Defer Vercel Analytics/Speed Insights

**Observation.** While tiny, these scripts still execute on every page load.

**Recommendation.** While the Vercel components handle this well, verify that they aren't executing before the main application logic becomes interactive. Using `next/script` with `strategy="afterInteractive"` or `lazyOnload` for non-critical telemetry can help clear the thread for the initial render.

**Critical files:**

- `src/app/layout.tsx`
