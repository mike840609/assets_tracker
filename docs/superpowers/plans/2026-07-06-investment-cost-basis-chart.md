# Investment Cost Basis Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Analysis tab chart that compares current investment market value with remaining cost basis.

**Architecture:** Keep the math in `src/lib/services/analysis-service.ts` as pure helpers, then add one cached server payload read in `analysis-payload-service.ts`. Pass the summary into `AnalysisView` and render it with a small lazy Recharts bar chart that follows the existing Analysis chart pattern.

**Tech Stack:** Next.js 16 App Router, Cache Components (`"use cache"` / `unstable_cache` already in use), Prisma, Vitest, Recharts, next-intl.

---

## File Structure

- Modify `src/lib/services/analysis-service.ts`: add cost-basis reducer types, summary type, and pure functions.
- Create `src/lib/services/investment-cost-basis-service.ts`: read Prisma, prices, and FX rates on the server.
- Modify `tests/unit/analysis-service.test.ts`: add reducer tests beside the existing analysis-service tests.
- Modify `src/lib/services/analysis-payload-service.ts`: fetch the current investment cost-basis summary in the existing Analysis payload.
- Modify `src/app/(main)/analysis/page.tsx`: pass the summary to `AnalysisView`.
- Modify `src/components/analysis/analysis-view.tsx`: accept the summary and add one Movement card.
- Modify `src/components/analysis/lazy-analysis-charts.tsx`: lazy-load the new chart.
- Create `src/components/analysis/investment-cost-basis-chart.tsx`: render the two-bar comparison.
- Modify `messages/en-US.json` and `messages/zh-TW.json`: add chart labels and note text.

---

### Task 1: Next 16 Preflight

**Files:**

- Read: `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`
- Read: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`

- [ ] **Step 1: Read the relevant local Next.js docs**

Run:

```bash
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
```

Expected: docs explain current App Router caching and lazy-loading conventions. Use those docs plus existing code; do not rely on older Next.js assumptions.

- [ ] **Step 2: Confirm no code changed**

Run:

```bash
git status --short
```

Expected: the plan file is modified before implementation starts. The existing untracked `.claude/settings.json` may also appear and must remain untouched.

---

### Task 2: Pure Cost-Basis Math

**Files:**

- Modify: `src/lib/services/analysis-service.ts`
- Test: `tests/unit/analysis-service.test.ts`

- [ ] **Step 1: Write failing tests for cost-basis reduction**

In `tests/unit/analysis-service.test.ts`, add `computeRemainingCostBasis` to the import list:

```ts
import {
  aggregateMonthlyChange,
  fillMonthRange,
  computeKpis,
  formatMonthLabel,
  buildCashFlowBuckets,
  buildCumulativeGrowth,
  aggregateCategoryHistory,
  computePerformanceAttribution,
  computeInvestmentReturn,
  computeInvestmentReturnSeries,
  computeRemainingCostBasis,
} from "@/lib/services/analysis-service";
```

Append this block near the other investment-return tests:

```ts
describe("computeRemainingCostBasis", () => {
  it("uses average cost when sells reduce a costed position", () => {
    const result = computeRemainingCostBasis([
      { type: "BUY", quantity: 10, unitPrice: 100 },
      { type: "BUY", quantity: 10, unitPrice: 200 },
      { type: "SELL", quantity: 5, unitPrice: null },
    ]);

    expect(result.quantity).toBeCloseTo(15, 10);
    expect(result.costBasis).toBeCloseTo(2250, 10);
    expect(result.hasCostBasis).toBe(true);
  });

  it("leaves quantity without cost when unit prices are missing", () => {
    const result = computeRemainingCostBasis([
      { type: "BUY", quantity: 10, unitPrice: null },
      { type: "BUY", quantity: 5, unitPrice: undefined },
    ]);

    expect(result.quantity).toBeCloseTo(15, 10);
    expect(result.costBasis).toBe(0);
    expect(result.hasCostBasis).toBe(false);
  });

  it("does not produce negative cost basis when selling more than tracked costed quantity", () => {
    const result = computeRemainingCostBasis([
      { type: "BUY", quantity: 2, unitPrice: 100 },
      { type: "SELL", quantity: 5, unitPrice: null },
    ]);

    expect(result.quantity).toBe(0);
    expect(result.costBasis).toBe(0);
    expect(result.hasCostBasis).toBe(false);
  });

  it("resets an edited position to edited quantity and edited unit price", () => {
    const result = computeRemainingCostBasis([
      { type: "BUY", quantity: 10, unitPrice: 100 },
      { type: "EDIT", quantity: 3, unitPrice: 80 },
    ]);

    expect(result.quantity).toBeCloseTo(3, 10);
    expect(result.costBasis).toBeCloseTo(240, 10);
    expect(result.hasCostBasis).toBe(true);
  });

  it("clears cost basis on an edit without unit price", () => {
    const result = computeRemainingCostBasis([
      { type: "BUY", quantity: 10, unitPrice: 100 },
      { type: "EDIT", quantity: 3, unitPrice: null },
    ]);

    expect(result.quantity).toBeCloseTo(3, 10);
    expect(result.costBasis).toBe(0);
    expect(result.hasCostBasis).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm test:unit -- tests/unit/analysis-service.test.ts
```

Expected: FAIL because `computeRemainingCostBasis` is not exported.

- [ ] **Step 3: Add the minimal pure implementation**

In `src/lib/services/analysis-service.ts`, add this below `const INVESTMENT_CATEGORIES`:

```ts
export type CostBasisTransactionType = "BUY" | "SELL" | "EDIT";

export interface CostBasisTransaction {
  type: CostBasisTransactionType;
  quantity: number;
  unitPrice?: number | null;
}

export interface CostBasisPosition {
  quantity: number;
  costBasis: number;
  hasCostBasis: boolean;
}

export function computeRemainingCostBasis(transactions: CostBasisTransaction[]): CostBasisPosition {
  let quantity = 0;
  let costBasis = 0;

  for (const tx of transactions) {
    const qty = Math.max(0, tx.quantity);
    if (qty === 0) continue;

    if (tx.type === "BUY") {
      quantity += qty;
      if (tx.unitPrice != null) costBasis += qty * tx.unitPrice;
      continue;
    }

    if (tx.type === "SELL") {
      if (quantity <= 0) continue;
      const sold = Math.min(qty, quantity);
      const avgCost = quantity > 0 ? costBasis / quantity : 0;
      quantity = Math.max(0, quantity - sold);
      costBasis = Math.max(0, costBasis - sold * avgCost);
      if (quantity === 0) costBasis = 0;
      continue;
    }

    quantity = qty;
    costBasis = tx.unitPrice != null ? qty * tx.unitPrice : 0;
  }

  return {
    quantity,
    costBasis,
    hasCostBasis: costBasis > 0,
  };
}
```

- [ ] **Step 4: Run the unit test again**

Run:

```bash
pnpm test:unit -- tests/unit/analysis-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/lib/services/analysis-service.ts tests/unit/analysis-service.test.ts
git commit -m "feat: add investment cost basis reducer"
```

Expected: commit succeeds.

---

### Task 3: Server Summary Payload

**Files:**

- Modify: `src/lib/services/analysis-service.ts`
- Create: `src/lib/services/investment-cost-basis-service.ts`
- Modify: `src/lib/services/analysis-payload-service.ts`
- Modify: `src/app/(main)/analysis/page.tsx`

- [ ] **Step 1: Add the summary type**

In `src/lib/services/analysis-service.ts`, add this below `CostBasisPosition`:

```ts
export interface InvestmentCostBasisSummary {
  marketValue: number;
  costBasis: number;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
  pricedHoldingCount: number;
  costedHoldingCount: number;
}
```

- [ ] **Step 2: Create the server helper**

Create `src/lib/services/investment-cost-basis-service.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getAllExchangeRates, resolveRate } from "./exchange-rate-service";
import {
  computeRemainingCostBasis,
  type InvestmentCostBasisSummary,
} from "@/lib/services/analysis-service";

export async function getInvestmentCostBasisSummary(
  userId: string,
  baseCurrency: string,
): Promise<InvestmentCostBasisSummary> {
  const [accounts, allRatesMap] = await Promise.all([
    prisma.account.findMany({
      where: {
        userId,
        isActive: true,
        category: { in: ["BROKERAGE", "CRYPTO_WALLET"] },
      },
      select: {
        currency: true,
        holdings: {
          where: { quantity: { gt: 0 } },
          select: {
            symbol: true,
            quantity: true,
            currency: true,
            assetType: true,
            contractMultiplier: true,
            transactions: {
              select: { type: true, quantity: true, unitPrice: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    getAllExchangeRates(),
  ]);

  const symbols = accounts.flatMap((account) => account.holdings.map((holding) => holding.symbol));
  const prices =
    symbols.length > 0
      ? await prisma.priceCache.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, price: true, currency: true },
        })
      : [];
  const priceMap = new Map(
    prices.map((price) => [price.symbol, { price: Number(price.price), currency: price.currency }]),
  );

  let marketValue = 0;
  let costBasis = 0;
  let pricedHoldingCount = 0;
  let costedHoldingCount = 0;

  for (const account of accounts) {
    for (const holding of account.holdings) {
      const cached = priceMap.get(holding.symbol);
      if (!cached) continue;

      const multiplier = holding.assetType === "OPTION" ? (holding.contractMultiplier ?? 100) : 1;
      const holdingCurrency = holding.currency || cached.currency || account.currency;
      const rate = resolveRate(allRatesMap, holdingCurrency, baseCurrency) ?? 1;
      const quantity = Number(holding.quantity);
      const holdingMarketValue = Number(cached.price) * quantity * multiplier * rate;
      marketValue += holdingMarketValue;
      pricedHoldingCount += 1;

      const position = computeRemainingCostBasis(
        holding.transactions.map((tx) => ({
          type: tx.type,
          quantity: Number(tx.quantity),
          unitPrice: tx.unitPrice == null ? null : Number(tx.unitPrice) * multiplier,
        })),
      );
      if (position.hasCostBasis) {
        costBasis += position.costBasis * rate;
        costedHoldingCount += 1;
      }
    }
  }

  const unrealizedGain = costBasis > 0 ? marketValue - costBasis : null;
  return {
    marketValue,
    costBasis,
    unrealizedGain,
    unrealizedGainPct: unrealizedGain == null ? null : unrealizedGain / costBasis,
    pricedHoldingCount,
    costedHoldingCount,
  };
}
```

- [ ] **Step 3: Add summary to the cached analysis payload**

In `src/lib/services/analysis-payload-service.ts`, import the helper:

```ts
import { getInvestmentCostBasisSummary } from "@/lib/services/investment-cost-basis-service";
```

Update the `AnalysisPayload` interface:

```ts
export interface AnalysisPayload {
  snapshots: Awaited<ReturnType<typeof getFullNormalizedHistory>>;
  cashFlowData: Awaited<ReturnType<typeof getMonthlyCashFlow>>;
  rawHistory: Awaited<ReturnType<typeof getRawHistoryWithBreakdown>>;
  accountCashFlow: Awaited<ReturnType<typeof getAccountMonthlyCashFlow>>;
  investmentCostBasis: Awaited<ReturnType<typeof getInvestmentCostBasisSummary>>;
}
```

Update the `Promise.all` and return object:

```ts
const [snapshots, cashFlowData, rawHistory, accountCashFlow, investmentCostBasis] =
  await Promise.all([
    getFullNormalizedHistory(userId, baseCurrency),
    getMonthlyCashFlow(userId, baseCurrency),
    getRawHistoryWithBreakdown(userId, baseCurrency),
    getAccountMonthlyCashFlow(userId, baseCurrency),
    getInvestmentCostBasisSummary(userId, baseCurrency),
  ]);

return {
  snapshots,
  cashFlowData,
  rawHistory,
  accountCashFlow,
  investmentCostBasis,
};
```

Update cache tags to include prices:

```ts
tags: [
  "net-worth",
  "snapshots",
  "exchange-rates",
  "prices",
  `history:${userId}`,
  `accounts:${userId}`,
],
```

- [ ] **Step 4: Pass the summary from the page**

In `src/app/(main)/analysis/page.tsx`, update the destructuring:

```ts
{ snapshots, cashFlowData, rawHistory, accountCashFlow, investmentCostBasis },
```

Add the prop:

```tsx
<AnalysisView
  snapshots={snapshots}
  cashFlowData={cashFlowData}
  rawHistory={rawHistory}
  accountCashFlow={accountCashFlow}
  investmentCostBasis={investmentCostBasis}
  baseCurrency={settings.baseCurrency}
  locale={locale}
  hasAccounts={accountCount > 0}
/>
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: FAIL because `AnalysisView` does not accept `investmentCostBasis` yet.

- [ ] **Step 6: Commit Task 3 after type failure is observed**

Do not commit the failing state. Continue to Task 4 before committing.

---

### Task 4: Chart UI and i18n

**Files:**

- Create: `src/components/analysis/investment-cost-basis-chart.tsx`
- Modify: `src/components/analysis/lazy-analysis-charts.tsx`
- Modify: `src/components/analysis/analysis-view.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`

- [ ] **Step 1: Add i18n messages**

In `messages/en-US.json`, inside `"analysis"`, add:

```json
"investmentCostBasis": "Investment Cost Basis",
"investmentCostBasisSubtitle": "Current investment market value compared with remaining cost basis.",
"seriesMarketValue": "Market value",
"seriesCostBasis": "Cost basis",
"unrealizedGain": "Unrealized gain/loss",
"unrealizedGainPct": "Unrealized %",
"costBasisNoData": "No priced investment holdings yet.",
"costBasisPartialNote": "Cost basis only includes holdings with buy unit prices."
```

In `messages/zh-TW.json`, inside `"analysis"`, add:

```json
"investmentCostBasis": "投資成本基準",
"investmentCostBasisSubtitle": "比較目前投資市值與剩餘成本基準。",
"seriesMarketValue": "市值",
"seriesCostBasis": "成本基準",
"unrealizedGain": "未實現損益",
"unrealizedGainPct": "未實現 %",
"costBasisNoData": "目前沒有可定價的投資持倉。",
"costBasisPartialNote": "成本基準僅包含有買入單價的持倉。"
```

- [ ] **Step 2: Create the chart component**

Create `src/components/analysis/investment-cost-basis-chart.tsx`:

```tsx
"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ChartTooltipContainer, ChartTooltipRow } from "@/components/ui/chart-tooltip";
import { useDensity } from "@/components/layout/density-context";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { formatChartTick } from "@/lib/chart-formatters";
import { formatCurrency } from "@/lib/currencies";
import type { InvestmentCostBasisSummary } from "@/lib/services/analysis-service";

interface Props {
  summary: InvestmentCostBasisSummary;
  baseCurrency: string;
}

interface CostBasisBar {
  key: "marketValue" | "costBasis";
  label: string;
  value: number;
  color: string;
}

interface TooltipPayload {
  payload: CostBasisBar;
}

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function CostBasisTooltip({
  active,
  payload,
  summary,
  baseCurrency,
  privacyMode,
  t,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  summary: InvestmentCostBasisSummary;
  baseCurrency: string;
  privacyMode?: boolean;
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const gainClass =
    summary.unrealizedGain == null || summary.unrealizedGain >= 0
      ? "text-[var(--gain-ink)]"
      : "text-[var(--loss-ink)]";

  return (
    <ChartTooltipContainer title={t("investmentCostBasis")}>
      <ChartTooltipRow
        label={t("seriesMarketValue")}
        value={privacyMode ? "***" : formatCurrency(summary.marketValue, baseCurrency)}
        indicatorColor="var(--primary)"
      />
      <ChartTooltipRow
        label={t("seriesCostBasis")}
        value={privacyMode ? "***" : formatCurrency(summary.costBasis, baseCurrency)}
        indicatorColor="var(--chart-3)"
      />
      {summary.unrealizedGain !== null && (
        <div className="pt-1.5 mt-1.5 border-t border-border/40">
          <ChartTooltipRow
            label={t("unrealizedGain")}
            value={
              privacyMode
                ? "***"
                : `${summary.unrealizedGain >= 0 ? "+" : ""}${formatCurrency(summary.unrealizedGain, baseCurrency)}`
            }
            valueClassName={gainClass}
          />
          {summary.unrealizedGainPct !== null && (
            <ChartTooltipRow
              label={t("unrealizedGainPct")}
              value={privacyMode ? "***" : formatPct(summary.unrealizedGainPct)}
              valueClassName={gainClass}
            />
          )}
        </div>
      )}
    </ChartTooltipContainer>
  );
}

const costBasisConfig = {} satisfies ChartConfig;

export const InvestmentCostBasisChart = memo(function InvestmentCostBasisChart({
  summary,
  baseCurrency,
}: Props) {
  const t = useTranslations("analysis");
  const { density } = useDensity();
  const { privacyMode } = usePrivacyMode();
  const { isAnimationActive, onAnimationEnd } = useChartAnimation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => startTransition(() => setMounted(true)), []);

  const chartHeight = density === "compact" ? 180 : 200;
  const points: CostBasisBar[] = [
    {
      key: "marketValue",
      label: t("seriesMarketValue"),
      value: summary.marketValue,
      color: "var(--primary)",
    },
    {
      key: "costBasis",
      label: t("seriesCostBasis"),
      value: summary.costBasis,
      color: "var(--chart-3)",
    },
  ];

  return (
    <>
      <CardHeader className="pb-2 px-2 sm:px-4">
        <CardTitle className="text-base font-medium text-foreground">
          {t("investmentCostBasis")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("investmentCostBasisSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pb-4 sm:px-4">
        {summary.pricedHoldingCount === 0 ? (
          <ChartEmptyState message={t("costBasisNoData")} hint={t("emptyHint")} />
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
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary" />
                {t("seriesMarketValue")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--chart-3)" }}
                />
                {t("seriesCostBasis")}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${t("investmentCostBasis")}, ${t("investmentCostBasisSubtitle")}`}
              className="min-h-0 flex-1"
            >
              <ChartContainer
                config={costBasisConfig}
                className="w-full"
                style={{ height: "100%" }}
                initialDimension={{ width: 1, height: chartHeight }}
              >
                <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} height={32} />
                  <YAxis
                    width={50}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (privacyMode ? "" : formatChartTick(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <CostBasisTooltip
                        summary={summary}
                        baseCurrency={baseCurrency}
                        privacyMode={privacyMode}
                        t={t}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={isAnimationActive}
                    onAnimationEnd={onAnimationEnd}
                  >
                    {points.map((point) => (
                      <Cell key={point.key} fill={point.color} fillOpacity={0.82} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            {summary.costedHoldingCount < summary.pricedHoldingCount && (
              <p className="mt-2 text-[11px] text-muted-foreground">{t("costBasisPartialNote")}</p>
            )}
          </div>
        )}
      </CardContent>
    </>
  );
});
```

- [ ] **Step 3: Lazy-load the chart**

In `src/components/analysis/lazy-analysis-charts.tsx`, add:

```tsx
export const LazyInvestmentCostBasisChart = dynamic(
  () => import("./investment-cost-basis-chart").then((m) => m.InvestmentCostBasisChart),
  { loading: () => <ChartSkeleton /> },
);
```

- [ ] **Step 4: Wire the chart into `AnalysisView`**

In `src/components/analysis/analysis-view.tsx`, import the type:

```ts
import type { InvestmentCostBasisSummary } from "@/lib/services/analysis-service";
```

Add `LazyInvestmentCostBasisChart` to the lazy chart import:

```ts
  LazyInvestmentCostBasisChart,
```

Add the prop:

```ts
interface Props {
  snapshots: NormalizedSnapshot[];
  cashFlowData: MonthlyContribution[];
  rawHistory: RawHistoryData;
  accountCashFlow: AccountMonthlyContribution[];
  investmentCostBasis: InvestmentCostBasisSummary;
  baseCurrency: string;
  locale: string;
  hasAccounts: boolean;
}
```

Destructure it:

```ts
  investmentCostBasis,
```

In the Movement grid, place this card after `LazyCumulativeGrowthChart` and before `LazyReturnTrendChart`:

```tsx
<Card size="sm" className="h-full">
  <LazyInvestmentCostBasisChart summary={investmentCostBasis} baseCurrency={baseCurrency} />
</Card>
```

Change the Return Trend card class from full-width to standard half-width:

```tsx
<Card size="sm" className="h-full">
  <LazyReturnTrendChart points={returnTrend} />
</Card>
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm test:unit -- tests/unit/analysis-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 3 and 4 together**

Run:

```bash
git add src/lib/services/analysis-service.ts src/lib/services/investment-cost-basis-service.ts src/lib/services/analysis-payload-service.ts src/app/(main)/analysis/page.tsx src/components/analysis/analysis-view.tsx src/components/analysis/lazy-analysis-charts.tsx src/components/analysis/investment-cost-basis-chart.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat: add investment cost basis analysis chart"
```

Expected: commit succeeds.

---

### Task 5: Final Verification

**Files:**

- Read: `package.json`
- Verify: all files changed by Tasks 2-4

- [ ] **Step 1: Run the focused unit test**

Run:

```bash
pnpm test:unit -- tests/unit/analysis-service.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS or auto-fix suggestions that can be applied with `pnpm lint --fix` if the repo supports it. If lint reports a real error, fix the exact file and rerun `pnpm lint`.

- [ ] **Step 4: Run format check**

Run:

```bash
pnpm format:check
```

Expected: PASS. If it fails only on formatting, run `pnpm format`, then rerun `pnpm format:check`.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git log --oneline -3
git status --short
```

Expected: the feature commits are visible in recent history, and no unstaged implementation changes remain. The unrelated `.claude/settings.json` may remain untracked and must not be staged.
