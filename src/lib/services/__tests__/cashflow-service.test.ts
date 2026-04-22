import test from "node:test";
import assert from "node:assert/strict";

import { buildCashFlowBuckets, type MonthlyBucket } from "../analysis-service.ts";
import { aggregateMonthlyCashFlow } from "../cashflow-service.ts";

test("aggregateMonthlyCashFlow converts each transaction using timestamp-aware FX resolver", () => {
  const fxCalls: string[] = [];

  const result = aggregateMonthlyCashFlow(
    [
      {
        createdAt: new Date("2026-01-03T08:00:00.000Z"),
        amount: 100,
        type: "DEPOSIT",
        accountCurrency: "EUR",
      },
      {
        createdAt: new Date("2026-01-20T09:30:00.000Z"),
        amount: 50,
        type: "WITHDRAWAL",
        accountCurrency: "EUR",
      },
      {
        createdAt: new Date("2026-02-02T12:00:00.000Z"),
        amount: 10_000,
        type: "DEPOSIT",
        accountCurrency: "JPY",
      },
    ],
    "USD",
    ({ fromCurrency, toCurrency, at }) => {
      fxCalls.push(`${fromCurrency}->${toCurrency}@${at.toISOString()}`);
      if (fromCurrency === "EUR") return 1.2;
      if (fromCurrency === "JPY") return 0.01;
      return 1;
    },
  );

  assert.deepEqual(fxCalls, [
    "EUR->USD@2026-01-03T08:00:00.000Z",
    "EUR->USD@2026-01-20T09:30:00.000Z",
    "JPY->USD@2026-02-02T12:00:00.000Z",
  ]);

  assert.deepEqual(result, [
    { monthKey: "2026-01", contributions: 60 },
    { monthKey: "2026-02", contributions: 100 },
  ]);
});

test("buildCashFlowBuckets decomposes monthly delta into contributions + marketPerformance", () => {
  const buckets: MonthlyBucket[] = [
    {
      monthKey: "2026-01",
      endDate: "2026-01-31",
      startNetWorth: 1000,
      endNetWorth: 1200,
      totalAssets: 1500,
      totalLiabilities: 300,
      deltaNetWorth: 200,
      deltaPct: 20,
      isEmpty: false,
    },
    {
      monthKey: "2026-02",
      endDate: "2026-02-28",
      startNetWorth: 1200,
      endNetWorth: 1000,
      totalAssets: 1400,
      totalLiabilities: 400,
      deltaNetWorth: -200,
      deltaPct: -16.7,
      isEmpty: false,
    },
  ];

  const result = buildCashFlowBuckets(
    buckets,
    [
      { monthKey: "2026-01", contributions: 80 },
      { monthKey: "2026-02", contributions: -40 },
    ],
    "en-US",
  );

  assert.equal(result[0].marketPerformance, 120);
  assert.equal(result[1].marketPerformance, -160);
  assert.equal(result[0].deltaNetWorth, result[0].contributions + result[0].marketPerformance);
  assert.equal(result[1].deltaNetWorth, result[1].contributions + result[1].marketPerformance);
});
