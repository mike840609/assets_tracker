# Dashboard Portfolio Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the height-coupled dashboard portfolio row with a content-sized 8/4 overview row and a separate full-width horizontal Concentration summary.

**Architecture:** Keep `DashboardContent` as the server-side streaming orchestrator and preserve each existing Suspense boundary. Change the dashboard grid topology, keep dashboard `fillHeight` scoped to the Portfolio Composition card's internal chart/list row, update matching skeletons, and adjust the responsive internal layout of `ConcentrationCard`; all calculations and client interactions stay in their current components.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server and Client Components, TypeScript 5, Tailwind CSS 4, Recharts 3, Vitest 4, Playwright 1.52.

## Global Constraints

- Read relevant guidance in `node_modules/next/dist/docs/` before modifying Next.js code; the applicable Server and Client Component guide has already been identified at `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
- Preserve the current mobile-first source order: Asset Allocation, Currency Exposure, Portfolio Composition, Concentration.
- Preserve the existing 12-column desktop proportions: Portfolio Composition spans 8 columns and the allocation/currency rail spans 4 columns.
- Do not change financial calculations, translations, navigation, privacy behavior, chart colors, account colors, typography, or global spacing tokens.
- Keep `DashboardContent` as a Server Component and `PortfolioHeatmap` and `ConcentrationCard` as focused Client Components.
- Preserve independent Suspense boundaries and existing empty-state behavior.
- Maintain 44px mobile touch targets, visible focus states, compact density, localization, dark/light themes, and reduced-motion behavior.
- Use existing 4pt spacing values through Tailwind utilities: 12px (`gap-3`), 16px (`gap-4`), and 24px (`gap-6`).

---

## File Map

- Modify `src/components/dashboard/dashboard-content.tsx`: retain dashboard `fillHeight` for internal card filling, remove the parent stretch coupling, restructure Tier 3 into two rows, and consume the shared concentration skeleton.
- Modify `src/components/dashboard/dashboard-skeleton.tsx`: export the concentration skeleton and mirror the final two-row topology.
- Modify `src/components/dashboard/concentration-card.tsx`: make the full-width card horizontal at `lg` while retaining the current stacked mobile layout.
- Create `tests/unit/dashboard-portfolio-layout.test.ts`: guard the dashboard-only height fix, the two-row topology, skeleton parity, and horizontal concentration layout using the repository's existing source-inspection test pattern.

---

### Task 1: Decouple Portfolio Composition from the right rail

**Files:**

- Create: `tests/unit/dashboard-portfolio-layout.test.ts`
- Modify: `src/components/dashboard/dashboard-content.tsx:27,376-390,448-472`
- Modify: `src/components/dashboard/dashboard-skeleton.tsx:116-139,167-179`

**Interfaces:**

- Consumes: `PortfolioHeatmap({ summary, fillHeight? })`, existing dashboard section components, `Card`, `CardContent`, `CardHeader`, and `Skeleton`.
- Produces: exported `ConcentrationCardSkeleton`, `data-testid="portfolio-overview-row"`, and `data-testid="portfolio-concentration-row"` for structural and visual verification.

- [ ] **Step 1: Write the failing dashboard topology tests**

Create `tests/unit/dashboard-portfolio-layout.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync("src/components/dashboard/dashboard-content.tsx", "utf8");
const skeletonSource = readFileSync("src/components/dashboard/dashboard-skeleton.tsx", "utf8");

describe("dashboard portfolio layout", () => {
  it("fills the composition card internally without stretching the overview column", () => {
    expect(dashboardSource).toContain("<PortfolioHeatmap summary={summary} fillHeight />");
    expect(dashboardSource).not.toContain("[&>*]:min-h-0");
    expect(dashboardSource).not.toContain("[&>*]:flex-1");
  });

  it("separates concentration from the 8/4 portfolio overview row", () => {
    const overviewStart = dashboardSource.indexOf('data-testid="portfolio-overview-row"');
    const concentrationStart = dashboardSource.indexOf('data-testid="portfolio-concentration-row"');

    expect(overviewStart).toBeGreaterThan(-1);
    expect(concentrationStart).toBeGreaterThan(overviewStart);

    const overviewSource = dashboardSource.slice(overviewStart, concentrationStart);
    expect(overviewSource).toContain("lg:col-span-8");
    expect(overviewSource).toContain("lg:col-span-4");
    expect(overviewSource).not.toContain("<ConcentrationSection");
  });

  it("keeps the loading skeleton topology aligned with the dashboard", () => {
    expect(skeletonSource).toContain('data-testid="portfolio-overview-skeleton"');
    expect(skeletonSource).toContain('data-testid="portfolio-concentration-skeleton"');
    expect(skeletonSource).toContain("export function ConcentrationCardSkeleton()");
  });
});
```

- [ ] **Step 2: Run the topology tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/dashboard-portfolio-layout.test.ts
```

Expected: FAIL because the two data test IDs do not exist and `ConcentrationCardSkeleton` is not exported.

- [ ] **Step 3: Add and export the full-width concentration skeleton**

In `src/components/dashboard/dashboard-skeleton.tsx`, add this function immediately after `PortfolioHeatmapSkeleton`:

```tsx
export function ConcentrationCardSkeleton() {
  return (
    <Card data-testid="portfolio-concentration-skeleton">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-start lg:justify-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3 w-32 max-w-[70%]" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Mirror the new topology in `DashboardSkeleton`**

Replace the existing Tier 3 skeleton block in `src/components/dashboard/dashboard-skeleton.tsx` with:

```text
{/* Tier 3 — content-sized portfolio overview, then full-width concentration. */}
<div className="space-y-3 sm:space-y-6">
  <div
    data-testid="portfolio-overview-skeleton"
    className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12"
  >
    <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>
    <div className="min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-1">
      <PortfolioHeatmapSkeleton />
    </div>
  </div>
  <ConcentrationCardSkeleton />
</div>
```

- [ ] **Step 5: Keep height fill scoped to the dashboard heatmap's internal row**

In `PortfolioHeatmapSection` inside `src/components/dashboard/dashboard-content.tsx`, keep:

```tsx
return <PortfolioHeatmap summary={summary} fillHeight />;
```

Do not restore the removed parent flex/stretch utilities. `fillHeight` may fill the card's internal treemap/list row, but the Portfolio Composition card must continue sizing independently from the external allocation/currency rail.

- [ ] **Step 6: Import the shared concentration skeleton**

Replace the current dashboard-skeleton import in `src/components/dashboard/dashboard-content.tsx` with:

```tsx
import {
  ConcentrationCardSkeleton,
  WatchlistCardSkeleton,
} from "@/components/dashboard/dashboard-skeleton";
```

- [ ] **Step 7: Replace the Tier 3 dashboard block**

Replace the existing Tier 3 block in `src/components/dashboard/dashboard-content.tsx` with:

```text
{/* Tier 3 — "what it's made of": a content-sized 8/4 overview row followed
    by a full-width concentration summary. Source order stays allocation →
    currency → portfolio → concentration for mobile and assistive technology. */}
<div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-10 motion-slow fill-mode-both delay-100">
  <div
    data-testid="portfolio-overview-row"
    className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-12"
  >
    <div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-1">
      <Suspense fallback={<ChartCardSkeleton />}>
        <AllocationSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>
      <Suspense fallback={<ChartCardSkeleton />}>
        <CurrencySection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>
    </div>
    <div className="min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-1">
      <Suspense fallback={<PortfolioHeatmapSkeleton />}>
        <PortfolioHeatmapSection userId={userId} baseCurrency={baseCurrency} />
      </Suspense>
    </div>
  </div>
  <div data-testid="portfolio-concentration-row">
    <Suspense fallback={<ConcentrationCardSkeleton />}>
      <ConcentrationSection userId={userId} baseCurrency={baseCurrency} />
    </Suspense>
  </div>
</div>
```

- [ ] **Step 8: Run the focused tests**

Run:

```bash
pnpm vitest run tests/unit/dashboard-portfolio-layout.test.ts
```

Expected: all three tests PASS.

- [ ] **Step 9: Run format and lint for Task 1 files**

Run:

```bash
pnpm prettier --check src/components/dashboard/dashboard-content.tsx src/components/dashboard/dashboard-skeleton.tsx tests/unit/dashboard-portfolio-layout.test.ts
pnpm eslint src/components/dashboard/dashboard-content.tsx src/components/dashboard/dashboard-skeleton.tsx tests/unit/dashboard-portfolio-layout.test.ts
```

Expected: both commands exit 0. If Prettier reports differences, run `pnpm prettier --write` on the same three files, then repeat both checks.

- [ ] **Step 10: Commit the topology change**

```bash
git add src/components/dashboard/dashboard-content.tsx src/components/dashboard/dashboard-skeleton.tsx tests/unit/dashboard-portfolio-layout.test.ts
git commit -m "fix: decouple dashboard portfolio layout"
```

Expected: one commit containing the new two-row topology, skeleton parity, and the regression test.

---

### Task 2: Make Concentration a horizontal desktop summary

**Files:**

- Modify: `src/components/dashboard/concentration-card.tsx:19-57`
- Test: `tests/unit/dashboard-portfolio-layout.test.ts`

**Interfaces:**

- Consumes: unchanged `NetWorthSummary`, `computeConcentration(summary)`, `usePrivacyMode()`, and existing `concentration` translation keys.
- Produces: the same `ConcentrationCard({ summary }: { summary: NetWorthSummary })` public component with a stacked mobile layout and a two-region desktop grid.

- [ ] **Step 1: Add the failing horizontal Concentration test**

In `tests/unit/dashboard-portfolio-layout.test.ts`, add this source constant below the existing `skeletonSource` constant:

```ts
const concentrationSource = readFileSync("src/components/dashboard/concentration-card.tsx", "utf8");
```

Then add this test before the closing `});` of the existing `describe` block:

```ts
it("lays concentration out horizontally on desktop", () => {
  expect(concentrationSource).toContain("lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)]");
  expect(concentrationSource).toContain("sm:grid-cols-2 xl:grid-cols-3");
});
```

- [ ] **Step 2: Confirm the new test fails for the intended reason**

Run:

```bash
pnpm vitest run tests/unit/dashboard-portfolio-layout.test.ts -t "lays concentration out horizontally on desktop"
```

Expected: FAIL because `concentration-card.tsx` does not contain the `lg` summary/positions grid or the responsive positions grid.

- [ ] **Step 3: Replace the Concentration card return block**

Keep the current imports, memoized calculation, empty return, and `level` calculation. Replace only the `return` block in `src/components/dashboard/concentration-card.tsx` with:

```tsx
return (
  <Card className="flex flex-col">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
      <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
    </CardHeader>
    <CardContent className="grid flex-1 gap-4 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)] lg:gap-6">
      <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {privacyMode ? "***" : `${topHoldingPct.toFixed(1)}%`}
          </div>
          <div className="text-[11px] text-muted-foreground">{t("largestPosition")}</div>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          {t(`level_${level}` as "level_low" | "level_moderate" | "level_high")}
        </span>
      </div>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {top.map((position) => (
          <li key={position.label} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">{position.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {privacyMode ? "***" : `${position.pct.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, position.pct)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
```

- [ ] **Step 4: Run the complete layout regression test**

Run:

```bash
pnpm vitest run tests/unit/dashboard-portfolio-layout.test.ts
```

Expected: all four tests PASS.

- [ ] **Step 5: Run static verification**

Run:

```bash
pnpm prettier --check src/components/dashboard/concentration-card.tsx tests/unit/dashboard-portfolio-layout.test.ts
pnpm eslint src/components/dashboard/concentration-card.tsx tests/unit/dashboard-portfolio-layout.test.ts
pnpm typecheck
```

Expected: all three commands exit 0. If Prettier reports differences, run `pnpm prettier --write src/components/dashboard/concentration-card.tsx tests/unit/dashboard-portfolio-layout.test.ts`, then repeat the checks.

- [ ] **Step 6: Commit the responsive Concentration layout**

```bash
git add src/components/dashboard/concentration-card.tsx tests/unit/dashboard-portfolio-layout.test.ts
git commit -m "refactor: widen dashboard concentration summary"
```

Expected: one focused commit containing only the responsive Concentration presentation change.

---

### Task 3: Verify the complete dashboard flow and visual result

**Files:**

- Verify: `src/components/dashboard/dashboard-content.tsx`
- Verify: `src/components/dashboard/dashboard-skeleton.tsx`
- Verify: `src/components/dashboard/concentration-card.tsx`
- Verify: `src/components/analysis/portfolio-heatmap.tsx`

**Interfaces:**

- Consumes: the complete two-row dashboard implementation from Tasks 1 and 2.
- Produces: verified behavior at desktop and mobile widths with no further interface changes.

- [ ] **Step 1: Run the focused and existing unit suites**

Run:

```bash
pnpm vitest run tests/unit/dashboard-portfolio-layout.test.ts tests/unit/analysis-service.test.ts
```

Expected: all tests PASS, including the existing concentration calculation coverage.

- [ ] **Step 2: Run the project static checks**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
```

Expected: all commands exit 0 with no new errors.

- [ ] **Step 3: Run the desktop dashboard smoke test**

Run:

```bash
pnpm playwright test tests/e2e/smoke.spec.ts --project=chromium
```

Expected: the authenticated dashboard test passes and the dashboard continues to render Net Worth and Net Worth Trend. If the local environment cannot provide the configured preview credentials or database, record that environment limitation and continue with local browser verification against the running app.

- [ ] **Step 4: Verify the live dashboard visually**

At a desktop viewport around 1440×900, confirm:

- `portfolio-overview-row` renders Portfolio Composition on the left and only Asset Allocation plus Currency Exposure on the right.
- The Portfolio Composition card ends after its own responsive chart and legend content; it does not stretch to the former three-card rail height. On desktop, the responsive calculation supplies the treemap's minimum height and `fillHeight` grows it only to match the card's internal detail/account-list column. On mobile, the existing phone width rules remain authoritative.
- `portfolio-concentration-row` starts below both first-row columns and spans the available dashboard width.
- Concentration shows its headline/status region on the left and a two- or three-column position grid on the right.
- All Accounts follows the Concentration row without overlap or excessive gap.

At a mobile viewport around 412×915, confirm:

- The source and visual order is Asset Allocation, Currency Exposure, Portfolio Composition, Concentration.
- Portfolio account buttons remain at least 44px tall and treemap selection/back behavior still works.
- Concentration returns to a single-column card with its metric/status row above the positions grid.
- No horizontal document overflow appears.

Repeat one desktop check in compact density and one in dark mode. Confirm the chart height follows the same measured chart-column branches in compact density; expect 220px only when the inner chart column is at least 760px. Confirm all text, bars, borders, and focus states remain legible.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git status --short
git diff HEAD~2 --check
git diff HEAD~2 -- src/components/dashboard/dashboard-content.tsx src/components/dashboard/dashboard-skeleton.tsx src/components/dashboard/concentration-card.tsx tests/unit/dashboard-portfolio-layout.test.ts
```

Expected: no whitespace errors, no unrelated files, no parent flex/stretch coupling, dashboard `fillHeight` present only at the Portfolio Composition call site, and no financial or translation changes.
