# Portfolio Return % KPI Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Portfolio Return %" metric to the `/analysis` KPI card — the selected range's investment return over BROKERAGE + CRYPTO_WALLET accounts, using a Modified-Dietz half-weight approximation.

**Architecture:** One new pure function in `src/lib/services/analysis-service.ts` that mirrors `computePerformanceAttribution`'s inputs (already loaded by the analysis payload — no new DB reads). `analysis-view.tsx` computes it in a `useMemo` and passes it as a new prop to `KpiTiles`, which renders it as a new percent-formatted `MetricRow`.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-portfolio-return-kpi-design.md`

## Global Constraints

- Package manager is **pnpm** (`pnpm test:unit`, `pnpm typecheck`, …) — never npm/npx.
- Investment scope is exactly `category ∈ {"BROKERAGE", "CRYPTO_WALLET"}`.
- Return is the range's period return, **not annualized**; formatted `+X.X%` / `−X.X%` (one decimal).
- Tile renders `—` when the return is `null`; respects privacy mode (`***`) like every other tile.
- i18n strings go in both `messages/en-US.json` and `messages/zh-TW.json` under the `analysis` namespace.
- Pre-push hook runs `format:check + lint + typecheck`; run `pnpm format` if Prettier complains.

---

### Task 1: `computeInvestmentReturn` in analysis-service

**Files:**

- Modify: `src/lib/services/analysis-service.ts` (append after `computePerformanceAttribution`, ~line 391)
- Test: `tests/unit/analysis-service.test.ts` (append a new `describe` block at end of file)

**Interfaces:**

- Consumes: existing types from `src/lib/services/history-service.ts` — `SnapshotBreakdown` (`{ date: string; accountValues: Record<string, number> }`), `AccountMeta` (`{ id: string; name: string; category: string }`), `AccountMonthlyContribution` (`{ accountId: string; monthKey: string; contributions: number }`). All are already imported at the top of both files.
- Produces: `computeInvestmentReturn(snapshots: SnapshotBreakdown[], accounts: AccountMeta[], accountCashFlows: AccountMonthlyContribution[], rangeStartMonthKey: string): number | null` — returns the period return as a **fraction** (0.072 = +7.2%), or `null` when it can't be computed. Task 2 imports this exact name from `@/lib/services/analysis-service`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/analysis-service.test.ts` (the imports at the top of the file already include everything except `computeInvestmentReturn` — add it to the existing import list from `@/lib/services/analysis-service`):

```ts
describe("computeInvestmentReturn", () => {
  const accounts: AccountMeta[] = [
    { id: "a1", name: "Brokerage", category: "BROKERAGE" },
    { id: "a2", name: "Checking", category: "BANK" },
    { id: "a3", name: "Cold Wallet", category: "CRYPTO_WALLET" },
  ];

  it("computes Modified-Dietz return over investment accounts only", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000, a2: 5000, a3: 0 } },
      { date: "2026-03-01", accountValues: { a1: 1500, a2: 9000, a3: 0 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2025-12", contributions: 999 }, // before range — excluded
      { accountId: "a1", monthKey: "2026-02", contributions: 200 },
      { accountId: "a2", monthKey: "2026-02", contributions: 4000 }, // BANK — excluded
    ];
    // gain = 1500 − 1000 − 200 = 300; base = 1000 + 200/2 = 1100
    const result = computeInvestmentReturn(snapshots, accounts, cashFlows, "2026-01");
    expect(result).toBeCloseTo(300 / 1100, 10);
  });

  it("handles a withdrawal-heavy period (negative contributions)", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000 } },
      { date: "2026-03-01", accountValues: { a1: 650 } },
    ];
    const cashFlows: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: -400 },
    ];
    // gain = 650 − 1000 − (−400) = 50; base = 1000 + (−400)/2 = 800
    const result = computeInvestmentReturn(snapshots, accounts, cashFlows, "2026-01");
    expect(result).toBeCloseTo(50 / 800, 10);
  });

  it("returns null when the base is zero or negative", () => {
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 0 } },
      { date: "2026-03-01", accountValues: { a1: 0 } },
    ];
    expect(computeInvestmentReturn(snapshots, accounts, [], "2026-01")).toBeNull();
    const withdrawnPast: AccountMonthlyContribution[] = [
      { accountId: "a1", monthKey: "2026-02", contributions: -3000 },
    ];
    const bigSnapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a1: 1000 } },
      { date: "2026-03-01", accountValues: { a1: 0 } },
    ];
    // base = 1000 + (−3000)/2 = −500 → null
    expect(computeInvestmentReturn(bigSnapshots, accounts, withdrawnPast, "2026-01")).toBeNull();
  });

  it("returns null with fewer than two snapshots", () => {
    expect(computeInvestmentReturn([], accounts, [], "2026-01")).toBeNull();
    expect(
      computeInvestmentReturn(
        [{ date: "2026-01-01", accountValues: { a1: 1000 } }],
        accounts,
        [],
        "2026-01",
      ),
    ).toBeNull();
  });

  it("returns null when the user has no investment accounts", () => {
    const bankOnly: AccountMeta[] = [{ id: "a2", name: "Checking", category: "BANK" }];
    const snapshots: SnapshotBreakdown[] = [
      { date: "2026-01-01", accountValues: { a2: 5000 } },
      { date: "2026-03-01", accountValues: { a2: 6000 } },
    ];
    expect(computeInvestmentReturn(snapshots, bankOnly, [], "2026-01")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit`
Expected: FAIL — `computeInvestmentReturn` is not exported (`SyntaxError` / `TypeError: computeInvestmentReturn is not a function`).

- [ ] **Step 3: Write the implementation**

Append to `src/lib/services/analysis-service.ts` after `computeTopMovers`:

```ts
/** Account categories that count as "investments" for the portfolio return KPI. */
const INVESTMENT_CATEGORIES = new Set(["BROKERAGE", "CRYPTO_WALLET"]);

/**
 * Period return of the user's investment accounts (BROKERAGE + CRYPTO_WALLET)
 * over the selected range, as a fraction (0.072 = +7.2%).
 *
 * Simple Modified-Dietz approximation: contributions are assumed to arrive
 * mid-period, so they carry half weight in the denominator.
 * // ponytail: half-weight Dietz, upgrade to dated-flow Dietz/XIRR if it ever feels wrong
 *
 *   gain = Σ (endValue − startValue − cashContribution)
 *   base = Σ startValue + (Σ cashContribution) / 2
 *
 * Returns null when: fewer than 2 snapshots, no investment accounts, or base ≤ 0.
 *
 * @param snapshots          Breakdown snapshots filtered to the selected range.
 * @param accounts           All user accounts (from getRawHistoryWithBreakdown).
 * @param accountCashFlows   Per-account monthly cash flows (from getAccountMonthlyCashFlow).
 * @param rangeStartMonthKey "YYYY-MM" — cash flows before this month are excluded.
 */
export function computeInvestmentReturn(
  snapshots: SnapshotBreakdown[],
  accounts: AccountMeta[],
  accountCashFlows: AccountMonthlyContribution[],
  rangeStartMonthKey: string,
): number | null {
  if (snapshots.length < 2) return null;

  const investmentIds = new Set(
    accounts.filter((a) => INVESTMENT_CATEGORIES.has(a.category)).map((a) => a.id),
  );
  if (investmentIds.size === 0) return null;

  const startSnap = snapshots[0];
  const endSnap = snapshots[snapshots.length - 1];

  const cashByAccount = new Map<string, number>();
  for (const c of accountCashFlows) {
    if (c.monthKey >= rangeStartMonthKey && investmentIds.has(c.accountId)) {
      cashByAccount.set(c.accountId, (cashByAccount.get(c.accountId) ?? 0) + c.contributions);
    }
  }

  let gain = 0;
  let base = 0;
  for (const id of investmentIds) {
    const startValue = startSnap.accountValues[id] ?? 0;
    const endValue = endSnap.accountValues[id] ?? 0;
    const cash = cashByAccount.get(id) ?? 0;
    gain += endValue - startValue - cash;
    base += startValue + cash / 2;
  }

  return base > 0 ? gain / base : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS — all suites green, including the 5 new `computeInvestmentReturn` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/analysis-service.ts tests/unit/analysis-service.test.ts
git commit -m "feat(analysis): add computeInvestmentReturn (Modified-Dietz period return)"
```

---

### Task 2: Wire the return into the KPI card (UI + i18n)

**Files:**

- Modify: `src/components/analysis/analysis-view.tsx` (import list ~line 22-28; memos ~line 209-218; `<KpiTiles>` render ~line 304-309)
- Modify: `src/components/analysis/kpi-tiles.tsx` (Props ~line 14-19; `MoneyValue` ~line 56-104; `MetricRow` ~line 172-215; `metricRows` ~line 243-272; `methodologyBox` ~line 274-282)
- Modify: `messages/en-US.json`, `messages/zh-TW.json` (`analysis` namespace)

**Interfaces:**

- Consumes: `computeInvestmentReturn(snapshots, accounts, accountCashFlows, rangeStartMonthKey): number | null` from `@/lib/services/analysis-service` (Task 1).
- Produces: `KpiTiles` gains a required prop `investmentReturnPct: number | null` (fraction or null). No other component consumes it.

There is no unit-test harness for client components in this repo (Vitest suite targets pure service logic), so this task verifies via typecheck + lint + manual formatting of the value in Task 1's tested function. Do not add a component test framework.

- [ ] **Step 1: Compute and pass the prop in `analysis-view.tsx`**

Add `computeInvestmentReturn` to the existing import block from `@/lib/services/analysis-service` (the block at lines 21-30 that already imports `computeKpis` and `computePerformanceAttribution`).

After the `attributionItems` memo (line 209-218), add:

```tsx
const investmentReturnPct = useMemo(
  () =>
    computeInvestmentReturn(
      filteredRawSnapshots,
      rawHistory.accounts,
      accountCashFlow,
      rangeStartIso.slice(0, 7),
    ),
  [filteredRawSnapshots, rawHistory.accounts, accountCashFlow, rangeStartIso],
);
```

Update the `<KpiTiles>` render (line 304):

```tsx
<KpiTiles
  kpis={kpis}
  baseCurrency={baseCurrency}
  locale={locale}
  rangeLabel={activeRangeLabel}
  investmentReturnPct={investmentReturnPct}
/>
```

- [ ] **Step 2: Render the new row in `kpi-tiles.tsx`**

2a. Add the prop to `Props`:

```tsx
interface Props {
  kpis: AnalysisKpis;
  baseCurrency: string;
  locale: string;
  rangeLabel: string;
  /** Range's investment return as a fraction (0.072 = +7.2%); null = not computable. */
  investmentReturnPct: number | null;
}
```

2b. Extend `MoneyValue` with an optional `display` override (a pre-formatted string that replaces the currency count-up; privacy mode and null still win). Add `display?: string;` to its props type, and change the render branch to:

```tsx
{
  privacyMode ? (
    "***"
  ) : amount === null ? (
    "—"
  ) : display !== undefined ? (
    display
  ) : (
    <CountUpMoney amount={amount} currency={currency} />
  );
}
```

2c. Extend `MetricRow` the same way — add `display?: string;` to its props type and pass it through to `MoneyValue`:

```tsx
<MoneyValue
  amount={amount}
  currency={currency}
  privacyMode={privacyMode}
  tone={tone}
  isCompact={isCompact}
  align="right"
  display={display}
/>
```

2d. Destructure the new prop in the component signature and format it (after the `ytdPct` const, ~line 241):

```tsx
export function KpiTiles({ kpis, baseCurrency, locale, rangeLabel, investmentReturnPct }: Props) {
```

```tsx
const returnDisplay =
  investmentReturnPct === null
    ? undefined
    : `${investmentReturnPct >= 0 ? "+" : ""}${(investmentReturnPct * 100).toFixed(1)}%`;
```

2e. Add the row as the **first** entry inside the `metricRows` div (before the `avgMonthly` row — it renders in both the mobile `<details>` and the desktop section automatically since `metricRows` is shared):

```tsx
<MetricRow
  title={t("portfolioReturn")}
  amount={investmentReturnPct}
  display={returnDisplay}
  currency={baseCurrency}
  privacyMode={privacyMode}
  subtitle={t("portfolioReturnHint")}
  tone={privacyMode || investmentReturnPct === null ? "neutral" : toneFor(investmentReturnPct)}
  isCompact={isCompact}
/>
```

2f. Add the methodology line — in `methodologyBox`, after the existing `<p className="mt-0.5">{t("kpiMethodology", { range: rangeLabel })}</p>`, add:

```tsx
<p className="mt-0.5">{t("portfolioReturnMethodology")}</p>
```

- [ ] **Step 3: Add i18n strings**

In `messages/en-US.json`, inside the `"analysis"` object (next to `"avgMonthly"`):

```json
"portfolioReturn": "Portfolio Return",
"portfolioReturnHint": "Investment accounts",
"portfolioReturnMethodology": "Portfolio Return covers brokerage and crypto accounts only; deposits count at half weight (Modified Dietz approximation). Not annualized.",
```

In `messages/zh-TW.json`, same namespace:

```json
"portfolioReturn": "投資報酬率",
"portfolioReturnHint": "投資帳戶",
"portfolioReturnMethodology": "投資報酬率僅涵蓋券商與加密貨幣帳戶；期間存入資金以半權重計入（Modified Dietz 近似法），未年化。",
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass with no errors.

Run: `pnpm test:unit`
Expected: PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/analysis-view.tsx src/components/analysis/kpi-tiles.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat(analysis): show portfolio return % KPI tile"
```

---

### Task 3: Release entry + final checks

**Files:**

- Modify: `src/lib/changelog.ts` (prepend to `CHANGELOG`, line 39)
- Modify: `package.json` (`"version"` field)

**Interfaces:**

- Consumes: nothing from earlier tasks (pure release bookkeeping).
- Produces: `APP_VERSION` becomes `0.9.0` (derived from `CHANGELOG[0]`).

New user-visible feature ⇒ `added` ⇒ minor bump per docs/VERSIONING.md ("highest change type wins"): `0.8.8` → `0.9.0`.

- [ ] **Step 1: Prepend the release to `src/lib/changelog.ts`**

Insert as the first element of the `CHANGELOG` array (line 40, before the `0.8.8` entry):

```ts
{
  version: "0.9.0",
  date: "2026-07-04",
  summary: {
    "en-US": "New Portfolio Return metric on the Analysis tab.",
    "zh-TW": "分析頁面新增投資報酬率指標。",
  },
  changes: [
    {
      type: "added",
      text: {
        "en-US":
          "The Analysis summary now shows your Portfolio Return for the selected range — how much your brokerage and crypto accounts earned beyond what you deposited.",
        "zh-TW":
          "分析摘要現在會顯示所選期間的投資報酬率——券商與加密貨幣帳戶在扣除存入資金後的實際收益。",
      },
    },
  ],
},
```

- [ ] **Step 2: Bump `package.json`**

Change `"version": "0.8.8"` to `"version": "0.9.0"`.

- [ ] **Step 3: Run the full pre-PR suite**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit`
Expected: all pass. If `format:check` fails, run `pnpm format` and re-check.

- [ ] **Step 4: Commit**

```bash
git add src/lib/changelog.ts package.json
git commit -m "chore(release): v0.9.0 — portfolio return KPI"
```
