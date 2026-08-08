import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { instantiateDemoFixture, shiftDemoFixtureDates } from "@/lib/demo/demo-fixture";
import { getPreparedDemoFixture } from "@/lib/demo/demo-fixture-source";
import { dataImportSchema } from "@/lib/validators";

const source = dataImportSchema.parse(
  JSON.parse(readFileSync(new URL("../../demo-data.json", import.meta.url), "utf8")),
);
const today = new Date("2026-08-01T00:00:00.000Z");

function sequentialIds() {
  let value = 0;
  return () => `demo-id-${++value}`;
}

describe("public Demo fixture", () => {
  it("moves the newest snapshot to the requested Taiwan day", () => {
    const shifted = shiftDemoFixtureDates(source, today);
    expect(shifted.snapshots?.at(-1)?.date.slice(0, 10)).toBe("2026-08-01");
  });

  it("generates fresh IDs and remaps breakdown and account-goal references", () => {
    const accountScopedSource = structuredClone(source);
    accountScopedSource.goals = [
      {
        name: "Account goal",
        targetAmount: 1000,
        targetCurrency: "USD",
        targetDate: null,
        scope: "ACCOUNT",
        scopeRefId: accountScopedSource.accounts[0].id,
        sortOrder: 0,
      },
      {
        name: "Category goal",
        targetAmount: 2000,
        targetCurrency: "USD",
        targetDate: null,
        scope: "CATEGORY",
        scopeRefId: "BROKERAGE",
        sortOrder: 1,
      },
    ];
    const cashRule = accountScopedSource.accounts[0].recurringCashTransactions![0];
    cashRule.id = "source-cash-rule";
    accountScopedSource.accounts[0].cashTransactions![0].recurringId = cashRule.id;
    const investmentAccount = accountScopedSource.accounts.find(
      (account) => (account.recurringInvestments?.length ?? 0) > 0,
    )!;
    const investmentRule = investmentAccount.recurringInvestments![0];
    investmentRule.id = "source-investment-rule";
    investmentAccount.holdings![0].transactions![0].recurringId = investmentRule.id;
    const shifted = shiftDemoFixtureDates(accountScopedSource, today);
    const prepared = instantiateDemoFixture(shifted, {
      userId: "demo-user",
      locale: "zh-TW",
      now: today,
      makeId: sequentialIds(),
    });
    const originalAccountIds = new Set(source.accounts.map((account) => account.id));
    expect(prepared.accounts.every((account) => !originalAccountIds.has(account.id))).toBe(true);
    expect(prepared.settings).toMatchObject({
      userId: "demo-user",
      baseCurrency: "USD",
      locale: "zh-TW",
    });
    expect(prepared.goals[0].scopeRefId).toBe(prepared.accounts[0].id);
    expect(prepared.goals[1].scopeRefId).toBe("BROKERAGE");
    expect(Object.keys(prepared.snapshots[0].breakdown as object)).toEqual(
      expect.arrayContaining(prepared.accounts.map((account) => account.id)),
    );
    expect(prepared.cashTransactions[0].recurringId).toBe(prepared.recurringCashTransactions[0].id);
    expect(
      prepared.holdingTransactions.find((transaction) => transaction.recurringId)?.recurringId,
    ).toBe(prepared.recurringInvestments[0].id);
  });

  it("rejects a dangling recurring provenance reference", () => {
    const invalid = structuredClone(source);
    invalid.accounts[0].cashTransactions![0].recurringId = "missing-rule";
    expect(() =>
      instantiateDemoFixture(shiftDemoFixtureDates(invalid, today), {
        userId: "demo-user",
        locale: "en-US",
        now: today,
        makeId: sequentialIds(),
      }),
    ).toThrow(/invalid recurringId/);
  });

  it("isolates nested snapshot breakdown entries across cached workspaces", () => {
    const first = getPreparedDemoFixture({
      userId: "demo-user-one",
      locale: "en-US",
      now: today,
      makeId: sequentialIds(),
    });
    const firstBreakdown = first.snapshots[0].breakdown as Record<string, { value: number }>;
    const firstAccountId = first.accounts[0].id;
    if (!firstAccountId) throw new Error("Prepared fixture account requires an id");
    firstBreakdown[firstAccountId].value = -1;

    const second = getPreparedDemoFixture({
      userId: "demo-user-two",
      locale: "en-US",
      now: today,
      makeId: sequentialIds(),
    });
    const secondBreakdown = second.snapshots[0].breakdown as Record<string, { value: number }>;
    const secondAccountId = second.accounts[0].id;
    if (!secondAccountId) throw new Error("Prepared fixture account requires an id");

    expect(secondBreakdown[secondAccountId].value).toBe(350000);
  });

  it("prepares 100 independent copies with p95 below 100ms", () => {
    const shifted = shiftDemoFixtureDates(source, today);
    const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const startedAt = performance.now();
      instantiateDemoFixture(shifted, {
        userId: `demo-user-${index}`,
        locale: "en-US",
        now: today,
        makeId: sequentialIds(),
      });
      samples.push(performance.now() - startedAt);
    }
    samples.sort((a, b) => a - b);
    expect(samples[Math.floor(samples.length * 0.95)]).toBeLessThan(100);
  });
});
