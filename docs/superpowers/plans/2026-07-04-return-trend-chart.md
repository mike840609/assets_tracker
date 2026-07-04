# Return Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a combo chart (monthly Dietz return bars + chained cumulative return line) for investment accounts to the `/analysis` movement section.

**Architecture:** One new pure function `computeInvestmentReturnSeries` in `src/lib/services/analysis-service.ts` (same inputs as the existing `computeInvestmentReturn`, plus the month-key axis and locale). A new client component `return-trend-chart.tsx` modeled on `cumulative-growth-chart.tsx`, lazy-loaded and rendered full-width in the movement grid of `analysis-view.tsx`. No new DB reads or cache entries.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Recharts 3, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-return-trend-chart-design.md`

## Global Constraints

- Package manager is **pnpm** — never npm/npx.
- Investment scope is exactly `category ∈ {"BROKERAGE", "CRYPTO_WALLET"}` (reuse the existing `INVESTMENT_CATEGORIES` set in `analysis-service.ts`).
- Returns are fractions (0.021 = +2.1%), **not annualized**; displayed as `+X.X%` / `-X.X%` (one decimal) in tooltips, whole percents on the Y axis.
- `monthlyReturn` is `null` when the month has no snapshots (`isEmpty: true`) or its Dietz base ≤ 0; the cumulative index skips null months and carries its value forward.
- Privacy mode follows the chart-level pattern from `cumulative-growth-chart.tsx`: whole chart gets `blur-sm` + `aria-hidden`, Y ticks render empty, tooltip values render `***`.
- i18n strings go in both `messages/en-US.json` and `messages/zh-TW.json` under the `analysis` namespace.
- Pre-push hook runs `format:check + lint + typecheck`; run `pnpm format` to auto-fix formatting.

---

### Task 1: `computeInvestmentReturnSeries` in analysis-service

**Files:**

- Modify: `src/lib/services/analysis-service.ts` (append after `computeInvestmentReturn`, which is the last function in the file; the `INVESTMENT_CATEGORIES` set and `formatMonthLabel` already exist in this file)
- Test: `tests/unit/analysis-service.test.ts` (append a new `describe` block at end of file)

**Interfaces:**

- Consumes: existing types from `src/lib/services/history-service.ts` — `SnapshotBreakdown` (`{ date: string; accountValues: Record<string, number> }`), `AccountMeta` (`{ id: string; name: string; category: string }`), `AccountMonthlyContribution` (`{ accountId: string; monthKey: string; contributions: number }`); the module-level `const INVESTMENT_CATEGORIES = new Set(["BROKERAGE", "CRYPTO_WALLET"])` and `formatMonthLabel(monthKey, locale)` already defined in `analysis-service.ts`.
- Produces (Task 2 imports these exact names from `@/lib/services/analysis-service`):

```ts
export interface ReturnTrendPoint {
  monthKey: string; // "YYYY-MM"
  label: string; // locale-formatted month label
  monthlyReturn: number | null; // fraction; null when isEmpty or base ≤ 0
  cumulativeReturn: number | null; // fraction; null until first computable month
  isEmpty?: boolean; // no snapshot data this month
}

export function computeInvestmentReturnSeries(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  monthKeys: string[],
  locale?: string,
): ReturnTrendPoint[];
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/analysis-service.test.ts`. Add `computeInvestmentReturnSeries` and `type ReturnTrendPoint` to the existing import list from `@/lib/services/analysis-service` (which already imports `computeInvestmentReturn` etc.).

```ts
describe("computeInvestmentReturnSeries", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "BROKERAGE" },
    { id: "a2", name: "Checking", category: "BANK" },
  ];

  it("computes monthly Dietz returns and a chained cumulative index", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-05", accountValues: { a1: 1000, a2: 500 } },
      { date: "2026-01-31", accountValues: { a1: 1100, a2: 500 } },
      { date: "2026-02-28", accountValues: { a1: 1265, a2: 9999 } },
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      [],
      ["2026-01", "2026-02", "2026-03"],
      "en-US",
    );
    expect(points).toHaveLength(3);
    // Jan: first-month baseline = first snapshot within the month (1000), end 1100
    expect(points[0].monthlyReturn).toBeCloseTo(0.1, 10);
    expect(points[0].cumulativeReturn).toBeCloseTo(0.1, 10);
    // Feb: start = Jan month-end (1100), end 1265 → r = 0.15; index = 1.1*1.15 − 1
    expect(points[1].monthlyReturn).toBeCloseTo(0.15, 10);
    expect(points[1].cumulativeReturn).toBeCloseTo(0.265, 10);
    // Mar: no snapshots → empty gap, index carries forward
    expect(points[2]).toMatchObject({
      monthKey: "2026-03",
      monthlyReturn: null,
      isEmpty: true,
    });
    expect(points[2].cumulativeReturn).toBeCloseTo(0.265, 10);
    // BANK account movement (a2: 500 → 9999) must not affect any return
  });

  it("applies half-weight cash flows in the month they occur", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-31", accountValues: { a1: 1000 } },
      { date: "2026-02-28", accountValues: { a1: 1500 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: 200 },
      { accountId: "a2", monthKey: "2026-02", contributions: 4000 }, // BANK — excluded
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02"],
      "en-US",
    );
    // Feb: gain = 1500 − 1000 − 200 = 300; base = 1000 + 100 = 1100
    expect(points[1].monthlyReturn).toBeCloseTo(300 / 1100, 10);
  });

  it("skips base ≤ 0 months and carries the index through them", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-05", accountValues: { a1: 0 } },
      { date: "2026-01-31", accountValues: { a1: 0 } },
      { date: "2026-02-28", accountValues: { a1: 1000 } }, // funded by 1000 deposit
      { date: "2026-03-31", accountValues: { a1: 1100 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: 1000 },
    ];
    const points = computeInvestmentReturnSeries(
      snapshots,
      accounts,
      cashFlows,
      ["2026-01", "2026-02", "2026-03"],
      "en-US",
    );
    // Jan: base = 0 → null return, index still null
    expect(points[0].monthlyReturn).toBeNull();
    expect(points[0].cumulativeReturn).toBeNull();
    expect(points[0].isEmpty).toBeUndefined();
    // Feb: start 0 + 1000/2 = 500 base, gain = 1000 − 0 − 1000 = 0 → r = 0
    expect(points[1].monthlyReturn).toBeCloseTo(0, 10);
    expect(points[1].cumulativeReturn).toBeCloseTo(0, 10);
    // Mar: r = 100/1000 = 0.1; index = 1.0*1.1 − 1
    expect(points[2].monthlyReturn).toBeCloseTo(0.1, 10);
    expect(points[2].cumulativeReturn).toBeCloseTo(0.1, 10);
  });

  it("returns [] with fewer than two snapshots or no investment accounts", () => {
    expect(
      computeInvestmentReturnSeries(
        [{ date: "2026-01-31", accountValues: { a1: 1000 } }],
        accounts,
        [],
        ["2026-01"],
        "en-US",
      ),
    ).toEqual([]);
    const bankOnly: AccountMeta[] = [{ id: "a2", name: "Checking", category: "BANK" }];
    const snaps: SnapshotBreakdown[] = [
      { date: "2026-01-31", accountValues: { a2: 500 } },
      { date: "2026-02-28", accountValues: { a2: 600 } },
    ];
    expect(
      computeInvestmentReturnSeries(snaps, bankOnly, [], ["2026-01", "2026-02"], "en-US"),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit`
Expected: FAIL — `computeInvestmentReturnSeries` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/services/analysis-service.ts` after `computeInvestmentReturn`:

```ts
/** One month of the investment return trend (bars = monthly, line = chained index). */
export interface ReturnTrendPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** Locale-formatted month label for the X axis. */
  label: string;
  /** Half-weight Dietz return for the month as a fraction; null when the month is empty or its base ≤ 0. */
  monthlyReturn: number | null;
  /** Π(1 + rᵢ) − 1 over non-null months so far; null until the first computable month, carried forward through gaps. */
  cumulativeReturn: number | null;
  /** True when the month has no snapshot data (synthesized to align the X axis). */
  isEmpty?: boolean;
}

/**
 * Monthly investment-return series over the selected range, one point per
 * entry in `monthKeys` (the shared month axis from the range's buckets).
 *
 * Same scope and math as computeInvestmentReturn, applied per month:
 * start = previous month-end investment value (first month: first snapshot
 * within that month), end = this month-end, cash at half weight.
 * // ponytail: chained monthly Dietz ≠ single-period KPI Dietz — expected, not reconciled
 *
 * @param snapshots        Breakdown snapshots filtered to the selected range, sorted ascending.
 * @param accounts         All user accounts (from getRawHistoryWithBreakdown).
 * @param accountCashFlows Per-account monthly cash flows (from getAccountMonthlyCashFlow).
 * @param monthKeys        Ordered "YYYY-MM" keys defining the X axis (from the range's buckets).
 */
export function computeInvestmentReturnSeries(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  monthKeys: string[],
  locale = "en-US",
): ReturnTrendPoint[] {
  if (snapshots.length < 2) return [];

  const investmentIds = new Set(
    accounts.filter((a) => INVESTMENT_CATEGORIES.has(a.category)).map((a) => a.id),
  );
  if (investmentIds.size === 0) return [];

  const investmentValue = (s: SnapshotBreakdown) => {
    let total = 0;
    for (const id of investmentIds) total += s.accountValues[id] ?? 0;
    return total;
  };

  const cashByMonth = new Map<string, number>();
  for (const c of accountCashFlows) {
    if (investmentIds.has(c.accountId)) {
      cashByMonth.set(c.monthKey, (cashByMonth.get(c.monthKey) ?? 0) + c.contributions);
    }
  }

  // Input is sorted ascending by date, so `last` set wins per month.
  const monthFirst = new Map<string, SnapshotBreakdown>();
  const monthLast = new Map<string, SnapshotBreakdown>();
  for (const s of snapshots) {
    const key = s.date.slice(0, 7);
    if (!monthFirst.has(key)) monthFirst.set(key, s);
    monthLast.set(key, s);
  }

  let prevEnd: number | null = null;
  let index: number | null = null;
  return monthKeys.map((monthKey) => {
    const label = formatMonthLabel(monthKey, locale);
    const endSnap = monthLast.get(monthKey);
    if (!endSnap) {
      return { monthKey, label, monthlyReturn: null, cumulativeReturn: index, isEmpty: true };
    }
    const start = prevEnd ?? investmentValue(monthFirst.get(monthKey)!);
    const end = investmentValue(endSnap);
    const cash = cashByMonth.get(monthKey) ?? 0;
    prevEnd = end;
    const base = start + cash / 2;
    if (base <= 0) {
      return { monthKey, label, monthlyReturn: null, cumulativeReturn: index };
    }
    const r = (end - start - cash) / base;
    index = index === null ? r : (1 + index) * (1 + r) - 1;
    return { monthKey, label, monthlyReturn: r, cumulativeReturn: index };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS — all suites green, including the 4 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/analysis-service.ts tests/unit/analysis-service.test.ts
git commit -m "feat(analysis): add computeInvestmentReturnSeries (monthly Dietz + chained index)"
```

---

### Task 2: Return trend chart component + wiring + i18n

**Files:**

- Create: `src/components/analysis/return-trend-chart.tsx`
- Modify: `src/components/analysis/lazy-analysis-charts.tsx` (append one lazy export)
- Modify: `src/components/analysis/analysis-view.tsx` (import, memo after the `investmentReturnPct` memo ~line 216-224, third card in the movement grid ~line 349-359, section aria-label ~line 338)
- Modify: `messages/en-US.json`, `messages/zh-TW.json` (`analysis` namespace)

**Interfaces:**

- Consumes: `computeInvestmentReturnSeries` and `ReturnTrendPoint` from `@/lib/services/analysis-service` (Task 1). Existing hooks/components visible in `cumulative-growth-chart.tsx`: `usePrivacyMode`, `useDensity`, `useChartAnimation`, `useChartCrosshair`, `ChartContainer`, `ChartTooltip`, `ChartTooltipContainer`, `ChartTooltipRow`, `ChartEmptyState`, `getMonthTickInterval`.
- Produces: `ReturnTrendChart` (memo component, props `{ points: ReturnTrendPoint[] }`) and `LazyReturnTrendChart`.

There is no component-test harness in this repo (unit suite is service-layer only); verification is `pnpm typecheck && pnpm lint && pnpm test:unit`. Do not add a test framework.

- [ ] **Step 1: Create `src/components/analysis/return-trend-chart.tsx`**

```tsx
"use client";

import { memo, useEffect, useState, startTransition } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { getMonthTickInterval } from "@/lib/chart-formatters";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import type { ReturnTrendPoint } from "@/lib/services/analysis-service";
import { useChartCrosshair } from "@/hooks/use-chart-crosshair";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";

interface Props {
  points: ReturnTrendPoint[];
}

interface TooltipPayload {
  payload: ReturnTrendPoint;
}

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function ReturnTooltip({
  active,
  payload,
  t,
  privacyMode,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  t: (key: string) => string;
  privacyMode?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  if (p.monthlyReturn === null) {
    return (
      <ChartTooltipContainer title={p.label}>
        <div className="text-[11px] text-muted-foreground">{t("noDataMonth")}</div>
      </ChartTooltipContainer>
    );
  }

  return (
    <ChartTooltipContainer title={p.label}>
      <ChartTooltipRow
        label={t("seriesMonthlyReturn")}
        value={privacyMode ? "***" : formatPct(p.monthlyReturn)}
        indicatorColor={p.monthlyReturn >= 0 ? "var(--gain)" : "var(--loss)"}
        valueClassName={p.monthlyReturn >= 0 ? "text-[var(--gain-ink)]" : "text-[var(--loss-ink)]"}
      />
      {p.cumulativeReturn !== null && (
        <ChartTooltipRow
          label={t("seriesCumulativeReturn")}
          value={privacyMode ? "***" : formatPct(p.cumulativeReturn)}
          indicatorColor="var(--primary)"
        />
      )}
    </ChartTooltipContainer>
  );
}

const returnConfig = {} satisfies ChartConfig;

export const ReturnTrendChart = memo(function ReturnTrendChart({ points }: Props) {
  const t = useTranslations("analysis");
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const chartHeight = density === "compact" ? 180 : 200;
  const [mounted, setMounted] = useState(false);
  const { handlers: crosshairHandlers } = useChartCrosshair();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  useEffect(() => startTransition(() => setMounted(true)), []);
  const xAxisInterval = getMonthTickInterval(points.length, density === "compact" ? 5 : 6);

  const hasData = points.some((p) => p.monthlyReturn !== null);

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">{t("returnTrend")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("returnTrendSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {!hasData ? (
          <ChartEmptyState message={t("noData")} hint={t("emptyHint")} />
        ) : !mounted ? (
          <div className="min-h-0 flex-1" style={{ minHeight: chartHeight }} />
        ) : (
          <div
            aria-hidden={privacyMode || undefined}
            className={`relative flex min-h-0 flex-1 flex-col transition-[filter] duration-300 ${privacyMode ? "blur-sm pointer-events-none select-none" : ""}`}
            style={{ minHeight: chartHeight }}
          >
            <div className="mb-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--gain)" }}
                />
                {t("seriesMonthlyReturn")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                {t("seriesCumulativeReturn")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("returnTrend")}, ${t("returnTrendSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={returnConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <ComposedChart
                  data={points}
                  margin={{ top: 8, right: 4, left: 0, bottom: 12 }}
                  {...crosshairHandlers}
                >
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
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => (privacyMode ? "" : `${Math.round(v * 100)}%`)}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                    content={<ReturnTooltip t={t} privacyMode={privacyMode} />}
                  />
                  <Bar
                    dataKey="monthlyReturn"
                    name={t("seriesMonthlyReturn")}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {points.map((p) => (
                      <Cell
                        key={p.monthKey}
                        fill={
                          p.monthlyReturn !== null && p.monthlyReturn < 0
                            ? "var(--loss)"
                            : "var(--gain)"
                        }
                        fillOpacity={0.75}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="cumulativeReturn"
                    name={t("seriesCumulativeReturn")}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={isAnimationActive}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("returnTrendNote")}</p>
          </div>
        )}
      </CardContent>
    </>
  );
});
```

- [ ] **Step 2: Add the lazy export**

Append to `src/components/analysis/lazy-analysis-charts.tsx`:

```tsx
export const LazyReturnTrendChart = dynamic(
  () => import("./return-trend-chart").then((m) => m.ReturnTrendChart),
  { loading: () => <ChartSkeleton /> },
);
```

- [ ] **Step 3: Wire into `analysis-view.tsx`**

3a. Add `computeInvestmentReturnSeries` to the existing value-import block from `@/lib/services/analysis-service` (the block that already imports `computeInvestmentReturn`), and `LazyReturnTrendChart` to the import from `./lazy-analysis-charts`.

3b. After the `investmentReturnPct` memo (~line 216-224), add:

```tsx
const returnTrend = useMemo(
  () =>
    computeInvestmentReturnSeries(
      filteredRawSnapshots,
      rawHistory.accounts,
      accountCashFlow,
      buckets.map((b) => b.monthKey),
      locale,
    ),
  [filteredRawSnapshots, rawHistory.accounts, accountCashFlow, buckets, locale],
);
```

3c. In the movement section grid (`<div className={cn("grid", gridGapClass, "xl:grid-cols-2")}>` containing the cash-flow and cumulative-growth cards, ~line 349-359), add a third full-width card after the cumulative-growth card:

```tsx
<Card size="sm" className="h-full xl:col-span-2">
  <LazyReturnTrendChart points={returnTrend} />
</Card>
```

3d. Extend the section's aria-label (~line 338) from
`` `${t("cashFlow")} / ${t("cumulativeGrowth")}` `` to
`` `${t("cashFlow")} / ${t("cumulativeGrowth")} / ${t("returnTrend")}` ``.

- [ ] **Step 4: Add i18n strings**

In `messages/en-US.json`, `"analysis"` namespace (next to `"cumulativeGrowth"`):

```json
"returnTrend": "Return Trend",
"returnTrendSubtitle": "Monthly investment return and cumulative index, brokerage and crypto accounts only.",
"returnTrendNote": "Monthly returns use the Modified Dietz approximation (deposits at half weight); the line chains them geometrically. Not annualized.",
"seriesMonthlyReturn": "Monthly return",
"seriesCumulativeReturn": "Cumulative return",
```

In `messages/zh-TW.json`, same namespace:

```json
"returnTrend": "投資報酬走勢",
"returnTrendSubtitle": "每月投資報酬率與累積報酬指數，僅計入券商與加密貨幣帳戶。",
"returnTrendNote": "每月報酬採 Modified Dietz 近似法（存入資金以半權重計入），折線為幾何鏈接的累積值，未年化。",
"seriesMonthlyReturn": "每月報酬",
"seriesCumulativeReturn": "累積報酬",
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/return-trend-chart.tsx src/components/analysis/lazy-analysis-charts.tsx src/components/analysis/analysis-view.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat(analysis): add return trend chart (monthly Dietz bars + cumulative index line)"
```

---

### Task 3: Release entry + final checks

**Files:**

- Modify: `src/lib/changelog.ts` (prepend to `CHANGELOG`)
- Modify: `package.json` (`"version"` field)

**Interfaces:**

- Consumes: nothing from earlier tasks (release bookkeeping).
- Produces: `APP_VERSION` becomes `0.12.0`.

New user-visible feature ⇒ `added` ⇒ minor bump per docs/VERSIONING.md: `0.11.0` → `0.12.0`. (If the top entry is no longer `0.11.0` because master moved again, bump minor from whatever the current top entry is and note it in your report.)

- [ ] **Step 1: Prepend the release to `src/lib/changelog.ts`**

Insert as the first element of the `CHANGELOG` array:

```ts
{
  version: "0.12.0",
  date: "2026-07-04",
  summary: {
    "en-US": "New Return Trend chart on the Analysis tab.",
    "zh-TW": "分析頁面新增投資報酬走勢圖。",
  },
  changes: [
    {
      type: "added",
      text: {
        "en-US":
          "The Analysis tab now charts your monthly investment return alongside a cumulative return index, so you can see how your brokerage and crypto performance evolved over the selected range.",
        "zh-TW":
          "分析頁面現在會以圖表呈現每月投資報酬率與累積報酬指數，讓你看到券商與加密貨幣帳戶在所選期間的績效演變。",
      },
    },
  ],
},
```

- [ ] **Step 2: Bump `package.json`**

Change `"version": "0.11.0"` to `"version": "0.12.0"`.

- [ ] **Step 3: Run the full pre-PR suite**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit`
Expected: all pass. If `format:check` fails, run `pnpm format` and re-check.

- [ ] **Step 4: Commit**

```bash
git add src/lib/changelog.ts package.json
git commit -m "chore(release): v0.12.0 — return trend chart"
```
