import { describe, expect, it } from "vitest";

import {
  HISTORY_DAYS,
  PRICES,
  accountValue,
  buildSnapshotHistory,
  createDemoAccounts,
  portfolioTotals,
} from "../../scripts/demo-data.mjs";

let nextId = 0;
const accounts = createDemoAccounts(() => `account-${nextId++}`);
const account = (name: string) => accounts.find((item) => item.name === name)!;

describe("demo portfolio", () => {
  it("contains the requested diversified accounts and holdings", () => {
    expect(accounts.map(({ name }) => name)).toEqual([
      "Cathay Bank",
      "Fidelity Brokerage",
      "Cold Wallet",
      "Visa Credit Card",
    ]);
    expect(
      account("Fidelity Brokerage")
        .holdings.map(({ symbol }) => symbol)
        .sort(),
    ).toEqual(["AAPL", "NVDA", "TSLA"]);
    expect(account("Cold Wallet").holdings.map(({ symbol }) => symbol)).toEqual(["BTC-USD"]);
  });

  it("gives every holding multiple purchases that total its current quantity", () => {
    for (const holding of accounts.flatMap(({ holdings }) => holdings)) {
      expect(holding.transactions.length).toBeGreaterThan(1);
      expect(
        holding.transactions.reduce((sum, transaction) => sum + transaction.quantity, 0),
      ).toBeCloseTo(holding.quantity);
      expect(Object.hasOwn(PRICES, holding.symbol)).toBe(true);
    }
    expect(Object.values(PRICES).every((price) => price > 0)).toBe(true);
  });

  it("keeps bank ledger activity consistent with the current cash balance", () => {
    const bank = account("Cathay Bank");
    const ledgerBalance = bank.cashTransactions.reduce(
      (sum, transaction) =>
        sum + (transaction.type === "DEPOSIT" ? transaction.amount : -transaction.amount),
      0,
    );
    expect(ledgerBalance).toBe(bank.cash);
  });

  it("computes fixed account and portfolio values", () => {
    expect(accountValue(account("Fidelity Brokerage"))).toBeCloseTo(23_193.5);
    expect(accountValue(account("Cold Wallet"))).toBeCloseTo(12_540);
    expect(portfolioTotals(accounts)).toEqual({
      totalAssets: 48_053.5,
      totalLiabilities: 1_860,
      netWorth: 46_193.5,
    });
  });

  it("generates deterministic history whose final snapshot is exact", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const first = buildSnapshotHistory(accounts, now);
    const second = buildSnapshotHistory(accounts, now);
    expect(first).toEqual(second);
    expect(first).toHaveLength(HISTORY_DAYS);
    expect(first.at(-1)).toMatchObject(portfolioTotals(accounts));
    expect(first.at(-1)?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(first[0].breakdown).not.toEqual(first.at(-1)?.breakdown);
  });
});
