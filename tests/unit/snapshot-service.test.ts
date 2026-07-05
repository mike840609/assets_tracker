import { describe, it, expect, vi, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  upsertArgs: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    netWorthSnapshot: {
      upsert: vi.fn(async (args: unknown) => {
        h.upsertArgs.push(args);
        return { id: "snap1" };
      }),
    },
  },
}));

vi.mock("@/lib/services/net-worth-service", () => ({
  getCachedNetWorthSummary: vi.fn(async () => ({
    totalAssets: 100,
    totalLiabilities: 0,
    netWorth: 100,
    accounts: [],
  })),
}));

import { createSnapshot } from "@/lib/services/snapshot-service";

describe("createSnapshot date bucketing", () => {
  afterEach(() => {
    vi.useRealTimers();
    h.upsertArgs.length = 0;
  });

  // Regression: the cron fires at 21:30 UTC — deliberately 05:30 Taiwan time
  // (#49) — so a run just after Taiwan midnight must be bucketed under the
  // Taiwan calendar day it actually occurred on, not the UTC day (which is
  // still "yesterday"). Otherwise every calendar-day view a Taipei user sees
  // (history table, heatmap) shows that day's snapshot dated one day early.
  it("buckets a 21:30 UTC run under the Taiwan calendar day, not the UTC day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T21:30:00.000Z")); // Jul 6 05:30 Taipei

    await createSnapshot("u1", "USD");

    const args = h.upsertArgs[0] as { create: { date: Date } };
    expect(args.create.date.toISOString().split("T")[0]).toBe("2026-07-06");
  });
});
