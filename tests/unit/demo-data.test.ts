import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { dataImportSchema } from "@/lib/validators";

const demo = JSON.parse(
  readFileSync(new URL("../../demo-data.json", import.meta.url), "utf8"),
) as import("zod").z.infer<typeof dataImportSchema>;

describe("demo-data.json", () => {
  it("passes the import schema it is meant to round-trip through", () => {
    const result = dataImportSchema.safeParse(demo);
    expect(result.success, JSON.stringify(result.error?.format?.() ?? "")).toBe(true);
  });

  it("has holding quantities that equal the net of their transactions", () => {
    for (const account of demo.accounts) {
      for (const holding of account.holdings ?? []) {
        const net = (holding.transactions ?? []).reduce(
          (sum, t) => sum + (t.type === "SELL" ? -Number(t.quantity) : Number(t.quantity)),
          0,
        );
        expect(net, `${account.name} ${holding.symbol}`).toBeCloseTo(Number(holding.quantity));
      }
    }
  });

  it("keeps each asset account's ledger consistent with its cash balance", () => {
    for (const account of demo.accounts) {
      if (account.type !== "ASSET") continue;
      let cash = 0;
      for (const t of account.cashTransactions ?? []) {
        cash += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount);
      }
      for (const holding of account.holdings ?? []) {
        for (const t of holding.transactions ?? []) {
          const cost = Number(t.quantity) * Number(t.unitPrice ?? 0);
          cash += t.type === "SELL" ? cost : -cost;
        }
      }
      expect(cash, account.name).toBeCloseTo(Number(account.cashBalance), 1);
    }
  });

  it("has strictly increasing snapshots whose latest lands near the ~$60k (NT$2M) target", () => {
    const dates = (demo.snapshots ?? []).map((s) => Date.parse(s.date));
    for (let i = 1; i < dates.length; i++) expect(dates[i]).toBeGreaterThan(dates[i - 1]);

    const last = demo.snapshots?.at(-1);
    expect(last).toBeDefined();
    expect(Number(last!.totalAssets)).toBeGreaterThan(45_000);
    expect(Number(last!.totalAssets)).toBeLessThan(80_000);
    for (const s of demo.snapshots ?? []) {
      expect(Number(s.netWorth)).toBeCloseTo(Number(s.totalAssets) - Number(s.totalLiabilities), 1);
    }
  });

  it("only references existing accounts from goals and snapshot breakdowns", () => {
    const accountIds = new Set(demo.accounts.map((a) => a.id));
    for (const goal of demo.goals ?? []) {
      if (goal.scope === "ACCOUNT") expect(accountIds.has(goal.scopeRefId ?? "")).toBe(true);
    }
    for (const s of demo.snapshots ?? []) {
      for (const key of Object.keys(s.breakdown ?? {})) {
        expect(accountIds.has(key), `snapshot ${s.date} references ${key}`).toBe(true);
      }
    }
  });
});
