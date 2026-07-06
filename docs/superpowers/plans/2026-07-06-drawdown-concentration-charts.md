# Drawdown + Concentration Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a range-aware net-worth drawdown ("underwater") chart to the Analysis tab and a point-in-time portfolio concentration card to the Dashboard.

**Architecture:** Both features are pure transforms of data the pages already load — no new DB reads, queries, or services. Drawdown transforms the `NormalizedSnapshot[]` series `AnalysisView` already holds; concentration transforms the `NetWorthSummary` the dashboard already loads. Two pure functions land in `analysis-service.ts` (co-located with the existing transforms + its unit-test file); two client components render them following the existing chart/card idioms.

**Tech Stack:** Next.js 16 (RSC + client components), TypeScript strict, Recharts 3, next-intl, Tailwind 4 / shadcn, Vitest.

## Global Constraints

- Package manager is **pnpm** — run `pnpm <script>` / `pnpm exec <bin>`, never npm/npx.
- Monetary/quantity math stays in `number` here (these functions operate on already-serialized `NetWorthSummary` / `NormalizedSnapshot`, which are plain numbers — no Prisma `Decimal`).
- i18n strings must be authored in **both** `messages/en-US.json` and `messages/zh-TW.json`.
- Pure functions live in `src/lib/services/analysis-service.ts`; their tests in `tests/unit/analysis-service.test.ts`. No DB/env in unit tests.
- Drawdown percentages are stored in **percent units** (e.g. `-12.5` means −12.5%), so chart/tooltip formatters stay trivial.
- Release on ship: prepend a `0.13.0` entry (minor bump — new feature) to `src/lib/changelog.ts` and set `package.json` `version` to `0.13.0`.
- Before committing UI tasks run: `pnpm format:check && pnpm lint && pnpm typecheck` (the pre-push hook enforces these anyway).

---

### Task 1: `computeDrawdownSeries` pure function

**Files:**

- Modify: `src/lib/services/analysis-service.ts` (append new interface + function)
- Test: `tests/unit/analysis-service.test.ts` (append import + describe block)

**Interfaces:**

- Consumes: `NormalizedSnapshot` (from `@/lib/services/history-service`) — has `date: string` ("YYYY-MM-DD"), `netWorth: number`; snapshots arrive ascending by date.
- Produces:

  ```ts
  export interface DrawdownPoint {
    date: string; // snapshot date, ISO "YYYY-MM-DD"
    label: string; // same as date (X-axis / tooltip label)
    drawdownPct: number; // <= 0, in percent units
  }
  export function computeDrawdownSeries(
    snapshots: NormalizedSnapshot[], // full history, ascending
    rangeStartIso: string, // inclusive lower bound for returned slice
  ): DrawdownPoint[];
  ```

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/analysis-service.test.ts`. Add `computeDrawdownSeries` to the existing top import from `@/lib/services/analysis-service`, then add:

```ts
describe("computeDrawdownSeries", () => {
  it("returns [] for no snapshots", () => {
    expect(computeDrawdownSeries([], "2020-01-01")).toEqual([]);
  });

  it("is all zeros for a strictly rising series", () => {
    const s = [snap("2024-01-01", 100), snap("2024-02-01", 120), snap("2024-03-01", 150)];
    expect(computeDrawdownSeries(s, "2024-01-01").map((p) => p.drawdownPct)).toEqual([0, 0, 0]);
  });

  it("computes the trough and recovery back to 0", () => {
    const s = [snap("2024-01-01", 100), snap("2024-02-01", 80), snap("2024-03-01", 100)];
    const r = computeDrawdownSeries(s, "2024-01-01");
    expect(r[0].drawdownPct).toBe(0);
    expect(r[1].drawdownPct).toBeCloseTo(-20);
    expect(r[2].drawdownPct).toBe(0);
  });

  it("uses the all-time peak even when it precedes the range window", () => {
    const s = [snap("2024-01-01", 200), snap("2024-02-01", 150), snap("2024-03-01", 150)];
    const r = computeDrawdownSeries(s, "2024-02-01");
    expect(r).toHaveLength(2);
    expect(r[0].date).toBe("2024-02-01");
    expect(r[0].drawdownPct).toBeCloseTo(-25); // 150 measured against all-time peak 200
  });

  it("guards divide-by-zero when the running peak is non-positive", () => {
    const s = [snap("2024-01-01", -50), snap("2024-02-01", -80)];
    expect(computeDrawdownSeries(s, "2024-01-01").every((p) => p.drawdownPct === 0)).toBe(true);
  });
});
```

(`snap(...)` is the existing helper already defined at the top of this test file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit -- analysis-service`
Expected: FAIL — `computeDrawdownSeries is not exported` / not a function.

- [ ] **Step 3: Implement the function**

Append to `src/lib/services/analysis-service.ts` (after the other Phase-2 pure functions):

```ts
/** One point in the drawdown ("underwater") series. */
export interface DrawdownPoint {
  /** Snapshot date, ISO "YYYY-MM-DD". */
  date: string;
  /** Same as date — X-axis / tooltip label. */
  label: string;
  /** Percent below the running all-time peak (<= 0). */
  drawdownPct: number;
}

/**
 * Net-worth drawdown series: how far below the prior all-time peak each snapshot
 * sits, as a non-positive percentage.
 *
 * The running peak accumulates across the FULL input history, then only points on
 * or after `rangeStartIso` are returned — so a drawdown that began before the
 * visible window still renders truthfully (all-time peak, not window-local).
 *
 * @param snapshots  Full history, ascending by date.
 * @param rangeStartIso  Inclusive lower bound ("YYYY-MM-DD") for the returned slice.
 */
export function computeDrawdownSeries(
  snapshots: NormalizedSnapshot[],
  rangeStartIso: string,
): DrawdownPoint[] {
  let peak = 0;
  const out: DrawdownPoint[] = [];
  for (const s of snapshots) {
    if (s.netWorth > peak) peak = s.netWorth;
    if (s.date < rangeStartIso) continue;
    // ponytail: peak <= 0 (all-negative net worth) can't yield a meaningful ratio;
    // emit 0 rather than dividing by zero. Upgrade only if negative-net-worth
    // users ever need a signed drawdown.
    const drawdownPct = peak > 0 ? ((s.netWorth - peak) / peak) * 100 : 0;
    out.push({ date: s.date, label: s.date, drawdownPct });
  }
  return out;
}
```

Confirm `NormalizedSnapshot` is already imported at the top of the file (it is — the existing transforms use it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit -- analysis-service`
Expected: PASS (all `computeDrawdownSeries` cases green, existing cases still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/analysis-service.ts tests/unit/analysis-service.test.ts
git commit -m "feat(analysis): computeDrawdownSeries pure function"
```

---

### Task 2: DrawdownChart component + Analysis tab wiring

**Files:**

- Create: `src/components/analysis/drawdown-chart.tsx`
- Modify: `src/components/analysis/lazy-analysis-charts.tsx` (add `LazyDrawdownChart`)
- Modify: `src/components/analysis/analysis-view.tsx` (import, memo, render)
- Modify: `messages/en-US.json` + `messages/zh-TW.json` (4 keys in the `analysis` namespace)

**Interfaces:**

- Consumes: `DrawdownPoint[]` + `computeDrawdownSeries` from Task 1.
- Produces: `LazyDrawdownChart` (props `{ points: DrawdownPoint[] }`), rendered in the Analysis "movement" section.

- [ ] **Step 1: Add the i18n keys**

In `messages/en-US.json`, inside the `"analysis"` object (near `"cumulativeGrowth"`), add:

```json
    "drawdown": "Drawdown",
    "drawdownSubtitle": "How far net worth sits below its prior peak.",
    "drawdownNote": "0% means at an all-time high; dips show peak-to-trough declines.",
    "maxDrawdown": "Max drawdown",
```

In `messages/zh-TW.json`, inside the `"analysis"` object, add:

```json
    "drawdown": "回撤",
    "drawdownSubtitle": "淨資產距離前高的跌幅。",
    "drawdownNote": "0% 代表創新高；下探處為波段高點到低點的跌幅。",
    "maxDrawdown": "最大回撤",
```

- [ ] **Step 2: Create the chart component**

Create `src/components/analysis/drawdown-chart.tsx`:

```tsx
"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import type { DrawdownPoint } from "@/lib/services/analysis-service";

interface Props {
  points: DrawdownPoint[];
}

interface TooltipPayload {
  payload: DrawdownPoint;
}

function DrawdownTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipContainer title={p.label}>
      <ChartTooltipRow
        label={t("drawdown")}
        value={`${p.drawdownPct.toFixed(1)}%`}
        indicatorColor="var(--loss)"
        valueClassName={p.drawdownPct < 0 ? "text-[var(--loss-ink)]" : undefined}
      />
    </ChartTooltipContainer>
  );
}

const drawdownConfig = {} satisfies ChartConfig;

export const DrawdownChart = memo(function DrawdownChart({ points }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(points.length, density === "compact" ? 5 : 6);
  const maxDrawdown = points.length ? Math.min(...points.map((p) => p.drawdownPct)) : 0;

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium text-foreground">{t("drawdown")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("drawdownSubtitle")}</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">{t("maxDrawdown")}</div>
            <div className="text-sm font-semibold tabular-nums text-[var(--loss-ink)]">
              {privacyMode ? "***" : `${maxDrawdown.toFixed(1)}%`}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {points.length === 0 ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            role="img"
            aria-label={`${t("drawdown")}, ${t("drawdownSubtitle")}`}
            className={`relative flex min-h-0 flex-1 flex-col transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <ChartContainer
              config={drawdownConfig}
              className="w-full"
              style={{ height: "100%" }}
              initialDimension={{ width: 1, height: chartHeight }}
            >
              <AreaChart
                data={points}
                margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                {...crosshairHandlers}
              >
                <defs>
                  <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                <XAxis
                  dataKey="label"
                  interval={xAxisInterval}
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  width={44}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (privacyMode ? "" : `${Math.round(v)}%`)}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                  content={<DrawdownTooltip t={t} />}
                />
                <Area
                  type="monotone"
                  dataKey="drawdownPct"
                  name={t("drawdown")}
                  stroke="var(--loss)"
                  strokeWidth={1.5}
                  fill="url(#dd-fill)"
                  isAnimationActive={isAnimationActive}
                  onAnimationEnd={onAnimationEnd}
                />
              </AreaChart>
            </ChartContainer>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("drawdownNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
```

- [ ] **Step 3: Add the lazy wrapper**

In `src/components/analysis/lazy-analysis-charts.tsx`, append after `LazyReturnTrendChart`:

```tsx
export const LazyDrawdownChart = dynamic(
  () => import("./drawdown-chart").then((m) => m.DrawdownChart),
  { loading: () => <ChartSkeleton /> },
);
```

- [ ] **Step 4: Wire it into AnalysisView**

In `src/components/analysis/analysis-view.tsx`:

a) Add `computeDrawdownSeries` to the existing import from `@/lib/services/analysis-service`:

```ts
import {
  aggregateMonthlyChange,
  computeKpis,
  fillMonthRange,
  buildCashFlowBuckets,
  buildCumulativeGrowth,
  aggregateCategoryHistory,
  computePerformanceAttribution,
  computeInvestmentReturn,
  computeInvestmentReturnSeries,
  computeDrawdownSeries,
} from "@/lib/services/analysis-service";
```

b) Add `LazyDrawdownChart` to the existing import from `./lazy-analysis-charts`:

```ts
import {
  LazyAssetsLiabilitiesChart,
  LazyCashFlowChart,
  LazyCumulativeGrowthChart,
  LazyCategoryTrendChart,
  LazyAttributionChart,
  LazyReturnTrendChart,
  LazyDrawdownChart,
} from "./lazy-analysis-charts";
```

c) Add a memo near the other series memos (e.g. right after the `returnTrend` memo, ~line 249):

```ts
const drawdownSeries = useMemo(
  () => computeDrawdownSeries(snapshots, rangeStartIso),
  [snapshots, rangeStartIso],
);
```

d) In the "movement" section grid (the `<div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>` that contains cash-flow / cumulative-growth / return-trend), add a fourth card after the return-trend card:

```tsx
<Card size="sm" className="h-full xl:col-span-2">
  <LazyDrawdownChart points={drawdownSeries} />
</Card>
```

- [ ] **Step 5: Verify**

Run: `pnpm format:check && pnpm lint && pnpm typecheck`
Expected: all pass.

Then manually (see local-dashboard-preview notes): start `pnpm dev`, open `/analysis`, confirm the Drawdown card renders in the movement section, tracks the range selector, shows a max-drawdown headline, and shows the empty state when there is no history.

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/drawdown-chart.tsx src/components/analysis/lazy-analysis-charts.tsx src/components/analysis/analysis-view.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat(analysis): drawdown (underwater) chart"
```

---

### Task 3: `computeConcentration` pure function

**Files:**

- Modify: `src/lib/services/analysis-service.ts` (append interfaces + function; add `NetWorthSummary` import)
- Test: `tests/unit/analysis-service.test.ts` (append import + describe block + local helper)

**Interfaces:**

- Consumes: `NetWorthSummary` (from `@/lib/types`) — `totalAssets: number`, `accounts: AccountWithValue[]` where each account has `type` ("ASSET"/"LIABILITY") and `holdings: HoldingWithPrice[]` with `name`, `symbol`, `marketValueInBaseCurrency: number | null`.
- Produces:

  ```ts
  export interface ConcentrationPosition {
    label: string;
    pct: number;
  } // pct 0..100 of total assets
  export interface ConcentrationResult {
    top: ConcentrationPosition[]; // up to 5, descending
    topHoldingPct: number; // 0 when empty
    hhi: number; // sum of squared weights (0..1), holdings only
  }
  export function computeConcentration(summary: NetWorthSummary): ConcentrationResult;
  ```

- [ ] **Step 1: Write the failing tests**

Add `computeConcentration` to the top import from `@/lib/services/analysis-service`, add `import type { NetWorthSummary } from "@/lib/types";` near the other type imports, then append:

```ts
function assetSummary(
  totalAssets: number,
  holdings: { name: string; symbol: string; marketValueInBaseCurrency: number | null }[],
): NetWorthSummary {
  return {
    totalAssets,
    totalLiabilities: 0,
    netWorth: totalAssets,
    baseCurrency: "USD",
    currencyExposure: [],
    accounts: [
      {
        type: "ASSET",
        holdings,
      },
    ],
  } as unknown as NetWorthSummary; // test double: only the fields computeConcentration reads
}

describe("computeConcentration", () => {
  it("returns zeros and no positions for an empty portfolio", () => {
    const r = computeConcentration(assetSummary(0, []));
    expect(r.top).toEqual([]);
    expect(r.topHoldingPct).toBe(0);
    expect(r.hhi).toBe(0);
  });

  it("reports 100% and hhi 1 for a single holding", () => {
    const r = computeConcentration(
      assetSummary(1000, [{ name: "Apple", symbol: "AAPL", marketValueInBaseCurrency: 1000 }]),
    );
    expect(r.topHoldingPct).toBeCloseTo(100);
    expect(r.top[0].label).toBe("Apple");
    expect(r.hhi).toBeCloseTo(1);
  });

  it("sorts descending, caps at 5, and skips non-positive/null holdings", () => {
    const r = computeConcentration(
      assetSummary(1000, [
        { name: "A", symbol: "A", marketValueInBaseCurrency: 100 },
        { name: "B", symbol: "B", marketValueInBaseCurrency: 400 },
        { name: "C", symbol: "C", marketValueInBaseCurrency: 200 },
        { name: "D", symbol: "D", marketValueInBaseCurrency: 50 },
        { name: "E", symbol: "E", marketValueInBaseCurrency: 150 },
        { name: "F", symbol: "F", marketValueInBaseCurrency: 100 },
        { name: "Z", symbol: "Z", marketValueInBaseCurrency: null },
        { name: "Y", symbol: "Y", marketValueInBaseCurrency: -10 },
      ]),
    );
    expect(r.top.map((p) => p.label)).toEqual(["B", "C", "E", "A", "F"]);
    expect(r.top[0].pct).toBeCloseTo(40);
  });

  it("falls back to symbol when a holding has no name", () => {
    const r = computeConcentration(
      assetSummary(500, [{ name: "", symbol: "BTC", marketValueInBaseCurrency: 500 }]),
    );
    expect(r.top[0].label).toBe("BTC");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit -- analysis-service`
Expected: FAIL — `computeConcentration is not exported`.

- [ ] **Step 3: Implement the function**

At the top of `src/lib/services/analysis-service.ts`, add the type import (next to the existing imports):

```ts
import type { NetWorthSummary } from "@/lib/types";
```

Append the function at the end of the file:

```ts
/** One position in the concentration breakdown (share of total assets). */
export interface ConcentrationPosition {
  label: string;
  /** 0..100 — this holding's percent of total assets. */
  pct: number;
}

/** Point-in-time portfolio concentration. */
export interface ConcentrationResult {
  /** Up to 5 largest positions, descending by pct. */
  top: ConcentrationPosition[];
  /** Largest single position as a percent of total assets (0 when empty). */
  topHoldingPct: number;
  /** Herfindahl index — sum of squared holding weights (0..1). */
  hhi: number;
}

/**
 * Portfolio concentration from the current net-worth summary: each priced holding
 * across ASSET accounts as a share of total assets. Cash and liabilities are not
 * positions, so they never appear (but total assets remains the denominator).
 * Pure — no DB access.
 */
export function computeConcentration(summary: NetWorthSummary): ConcentrationResult {
  const totalAssets = summary.totalAssets;
  const positions: ConcentrationPosition[] = [];
  let hhi = 0;

  if (totalAssets > 0) {
    for (const account of summary.accounts) {
      if (account.type !== "ASSET") continue;
      for (const h of account.holdings) {
        const value = h.marketValueInBaseCurrency ?? 0;
        if (value <= 0) continue;
        const weight = value / totalAssets;
        hhi += weight * weight;
        positions.push({ label: h.name || h.symbol, pct: weight * 100 });
      }
    }
  }

  positions.sort((a, b) => b.pct - a.pct);
  return {
    top: positions.slice(0, 5),
    topHoldingPct: positions[0]?.pct ?? 0,
    hhi,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit -- analysis-service`
Expected: PASS (all `computeConcentration` cases green, prior cases still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/analysis-service.ts tests/unit/analysis-service.test.ts
git commit -m "feat(analysis): computeConcentration pure function"
```

---

### Task 4: ConcentrationCard component + Dashboard wiring

**Files:**

- Create: `src/components/dashboard/concentration-card.tsx`
- Modify: `src/components/dashboard/dashboard-content.tsx` (import, `ConcentrationSection`, render in Tier 3 column)
- Modify: `src/app/(main)/page.tsx` (add `"concentration"` to `CLIENT_NAMESPACES`)
- Modify: `messages/en-US.json` + `messages/zh-TW.json` (new `concentration` namespace)

**Interfaces:**

- Consumes: `computeConcentration` + `NetWorthSummary` from Task 3; `getCachedNetWorthSummary` (already imported in `dashboard-content.tsx`).
- Produces: `ConcentrationCard` (client, props `{ summary: NetWorthSummary }`).

- [ ] **Step 1: Add the i18n namespace**

In `messages/en-US.json`, add a new top-level namespace (alongside `"currencyExposure"`):

```json
  "concentration": {
    "title": "Concentration",
    "subtitle": "Largest positions as a share of total assets.",
    "largestPosition": "Largest position",
    "level_low": "Well diversified",
    "level_moderate": "Moderately concentrated",
    "level_high": "Highly concentrated"
  },
```

In `messages/zh-TW.json`, add:

```json
  "concentration": {
    "title": "集中度",
    "subtitle": "最大持倉佔總資產的比重。",
    "largestPosition": "最大持倉",
    "level_low": "分散良好",
    "level_moderate": "中度集中",
    "level_high": "高度集中"
  },
```

- [ ] **Step 2: Register the namespace on the dashboard**

In `src/app/(main)/page.tsx`, add `"concentration"` to the `CLIENT_NAMESPACES` array (the one starting with `"dashboard"`, `"dashboardActions"`, …):

```ts
const CLIENT_NAMESPACES = [
  "dashboard",
  "dashboardActions",
  "freshness",
  "history",
  "trendChart",
  "allocationChart",
  "currencyExposure",
  "concentration",
  "accountsSummary",
  // …keep any remaining existing entries…
];
```

- [ ] **Step 3: Create the card component**

Create `src/components/dashboard/concentration-card.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { computeConcentration } from "@/lib/services/analysis-service";
import type { NetWorthSummary } from "@/lib/types";

export function ConcentrationCard({ summary }: { summary: NetWorthSummary }) {
  const t = useTranslations("concentration");
  const { privacyMode } = usePrivacyMode();
  const { top, topHoldingPct, hhi } = useMemo(() => computeConcentration(summary), [summary]);

  if (top.length === 0) return null;

  const level = hhi >= 0.25 ? "high" : hhi >= 0.15 ? "moderate" : "low";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="mb-3 flex items-baseline justify-between gap-2">
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
        <ul className="space-y-2">
          {top.map((p) => (
            <li key={p.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{p.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {privacyMode ? "***" : `${p.pct.toFixed(1)}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, p.pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Wire the section into the dashboard**

In `src/components/dashboard/dashboard-content.tsx`:

a) Add the import near the other dashboard component imports:

```ts
import { ConcentrationCard } from "./concentration-card";
```

b) Add a section server component next to `CurrencySection` / `PortfolioHeatmapSection`:

```tsx
/**
 * Concentration card — largest positions as a share of total assets. Point-in-time
 * (no per-holding history exists in snapshots). Shares the cached summary.
 */
async function ConcentrationSection({
  userId,
  baseCurrency,
}: {
  userId: string;
  baseCurrency: string;
}) {
  const summary = await getCachedNetWorthSummary(userId, baseCurrency);
  if (summary.totalAssets <= 0) return null;
  return <ConcentrationCard summary={summary} />;
}
```

c) In the Tier-3 grid, add it to the stacked right-hand column (the `<div className="flex min-w-0 flex-col gap-3 sm:gap-6 lg:col-span-4 …">` that holds `AllocationSection` + `CurrencySection`), after the currency `Suspense`:

```tsx
<Suspense fallback={<ChartCardSkeleton />}>
  <ConcentrationSection userId={userId} baseCurrency={baseCurrency} />
</Suspense>
```

- [ ] **Step 5: Verify**

Run: `pnpm format:check && pnpm lint && pnpm typecheck`
Expected: all pass.

Then manually: open `/` (dashboard), confirm the Concentration card renders in the Tier-3 donut column below currency exposure, shows the largest-position headline + top-5 bars + a diversification label, respects privacy mode (`***`), and disappears cleanly for an all-cash / no-assets user.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/concentration-card.tsx src/components/dashboard/dashboard-content.tsx "src/app/(main)/page.tsx" messages/en-US.json messages/zh-TW.json
git commit -m "feat(dashboard): portfolio concentration card"
```

---

### Task 5: Changelog entry + version bump

**Files:**

- Modify: `src/lib/changelog.ts` (prepend `0.13.0` release)
- Modify: `package.json` (`version` → `0.13.0`)

**Interfaces:**

- Consumes: nothing new. `APP_VERSION` derives from `CHANGELOG[0]`.

- [ ] **Step 1: Prepend the release**

In `src/lib/changelog.ts`, insert a new object as the **first** element of the `CHANGELOG` array (before the `0.12.1` entry):

```ts
  {
    version: "0.13.0",
    date: "2026-07-06",
    summary: {
      "en-US": "New drawdown chart and portfolio concentration card.",
      "zh-TW": "新增回撤圖表與投資組合集中度卡片。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US": "Analysis: a drawdown (underwater) chart showing how far net worth sits below its prior peak, with a max-drawdown readout.",
          "zh-TW": "分析頁：新增回撤圖表，顯示淨資產距離前高的跌幅，並標示最大回撤。",
        },
      },
      {
        type: "added",
        text: {
          "en-US": "Dashboard: a concentration card showing your largest positions as a share of total assets.",
          "zh-TW": "儀表板：新增集中度卡片，顯示最大持倉佔總資產的比重。",
        },
      },
    ],
  },
```

- [ ] **Step 2: Bump the package version**

In `package.json`, set:

```json
  "version": "0.13.0",
```

- [ ] **Step 3: Verify**

Run: `pnpm format:check && pnpm lint && pnpm typecheck`
Expected: all pass. (`APP_VERSION` now reads `0.13.0`; the sidebar footer, Settings version card, and `/changelog` all move in lockstep.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/changelog.ts package.json
git commit -m "chore(release): 0.13.0 — drawdown chart + concentration card"
```

---

## Final verification

- [ ] Run the full unit suite: `pnpm test:unit` — all green.
- [ ] Run `pnpm format:check && pnpm lint && pnpm typecheck` — all green.
- [ ] Manual smoke: `/analysis` drawdown card (range-reactive, empty state) and `/` concentration card (privacy mode, no-assets fallback) both behave as described.
