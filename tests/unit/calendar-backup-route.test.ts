import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync, gunzipSync } from "node:zlib";

const h = vi.hoisted(() => {
  const makeTx = () => ({
    account: { deleteMany: vi.fn(), create: vi.fn(async () => ({ id: "new_account_1" })) },
    cashTransaction: { createMany: vi.fn() },
    holding: { create: vi.fn() },
    holdingTransaction: { createMany: vi.fn() },
    netWorthSnapshot: { deleteMany: vi.fn(), createMany: vi.fn() },
    goal: { deleteMany: vi.fn(), createMany: vi.fn() },
    recurringCashTransaction: { create: vi.fn(async () => ({ id: "new_cash_rule_1" })) },
    recurringInvestment: { create: vi.fn() },
    stockWatchItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    calendarEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
    setting: { upsert: vi.fn() },
  });

  return {
    makeTx,
    tx: makeTx(),
    priceRefreshResult: undefined as unknown,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((callback: () => unknown) => callback()),
  };
});

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (request: Request, context: unknown, userId: string) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler(request, context, "user_1"),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitCheckWithPrune: vi.fn(() => null),
  rateLimitKeyForSubject: vi.fn(() => "hmac:settings-data"),
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(async () => undefined),
  resolveRate: vi.fn((_rateMap: Map<string, number>, fromCurrency: string, toCurrency: string) =>
    fromCurrency === toCurrency ? 1 : 30,
  ),
}));

vi.mock("@/lib/services/price-service", () => ({
  refreshPricesForUser: vi.fn(async () => h.priceRefreshResult),
}));

const calendarFixture = {
  id: "calendar_1",
  userId: "user_1",
  title: "US CPI",
  eventDate: new Date("2026-08-12T00:00:00.000Z"),
  startTimeMinutes: 510,
  timeZone: "Asia/Taipei",
  category: "ECONOMIC_INDICATOR" as const,
  description: "Consensus 2.8%",
  sourceUrl: "https://example.gov/cpi",
  createdAt: new Date("2026-07-24T01:00:00.000Z"),
  updatedAt: new Date("2026-07-24T02:00:00.000Z"),
};

const exportedCalendarFixture = {
  ...calendarFixture,
  eventDate: "2026-08-12",
  createdAt: "2026-07-24T01:00:00.000Z",
  updatedAt: "2026-07-24T02:00:00.000Z",
};

let exportedUserFixture = {
  id: "user_1",
  name: "Unit Test User",
  email: "unit@example.com",
  emailVerified: null,
  image: null,
  appSettings: null,
  appAccounts: [] as unknown[],
  snapshots: [],
  goals: [],
  stockWatchItems: [],
  calendarEntries: [calendarFixture],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => exportedUserFixture),
    },
    exchangeRate: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (callback: (tx: typeof h.tx) => unknown) => callback(h.tx)),
  },
}));

import { revalidateTag } from "next/cache";
import { GET, POST } from "@/app/api/settings/data/route";

async function importBackup(body: unknown) {
  return POST(
    new Request("http://unit.test/api/settings/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined,
  );
}

async function exportedJson(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text =
    response.headers.get("content-encoding") === "gzip"
      ? gunzipSync(bytes).toString("utf8")
      : new TextDecoder().decode(bytes);
  return { text, json: JSON.parse(text) };
}

function makeExportCompatibleAccount(accountNumber: number) {
  return {
    id: `account_${accountNumber}`,
    userId: "user_1",
    name: `Cash account ${accountNumber}`,
    type: "ASSET" as const,
    category: "BANK" as const,
    currency: "USD",
    cashBalance: "10000",
    isActive: true,
    isPinned: false,
    sortOrder: accountNumber,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    holdings: [],
    recurringCashTransactions: [],
    recurringInvestments: [],
    cashTransactions: Array.from({ length: 10_000 }, (_, transactionNumber) => ({
      id: `cash_${accountNumber}_${transactionNumber}`,
      accountId: `account_${accountNumber}`,
      type: "DEPOSIT" as const,
      amount: "1.00",
      note: `Cash transaction ${transactionNumber}: ${"backup fixture ".repeat(8)}`,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      occurrenceDate: null,
      recurringId: null,
    })),
  };
}

describe("Calendar whole-app backup", () => {
  beforeEach(() => {
    h.tx = h.makeTx();
    h.priceRefreshResult = undefined;
    exportedUserFixture = {
      id: "user_1",
      name: "Unit Test User",
      email: "unit@example.com",
      emailVerified: null,
      image: null,
      appSettings: null,
      appAccounts: [] as unknown[],
      snapshots: [],
      goals: [],
      stockWatchItems: [],
      calendarEntries: [calendarFixture],
    };
    vi.clearAllMocks();
  });

  it("exports calendar entries in backup v1.4", async () => {
    const response = await GET(new Request("http://unit.test/api/settings/data"), undefined);
    const { json } = await exportedJson(response);

    expect(json.version).toBe("1.4");
    expect(json.calendarEntries).toEqual([exportedCalendarFixture]);
  });

  it("round-trips an export-compatible backup larger than 4 MiB through the compressed import workflow", async () => {
    exportedUserFixture.appAccounts = [
      makeExportCompatibleAccount(1),
      makeExportCompatibleAccount(2),
      makeExportCompatibleAccount(3),
    ];

    const exported = await GET(new Request("http://unit.test/api/settings/data"), undefined);
    expect(exported.headers.get("content-encoding")).toBe("gzip");
    const { text } = await exportedJson(exported);
    expect(Buffer.byteLength(text)).toBeGreaterThan(4 * 1024 * 1024);
    const compressed = gzipSync(text);
    expect(compressed.byteLength).toBeLessThanOrEqual(4 * 1024 * 1024);

    const response = await POST(
      new Request("http://unit.test/api/settings/data", {
        method: "POST",
        headers: { "content-type": "application/gzip" },
        body: compressed,
      }),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(h.tx.cashTransaction.createMany).toHaveBeenCalledTimes(3);
    expect(h.tx.cashTransaction.createMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ amount: "1.00" })]),
      }),
    );
  });

  it("replaces calendar entries inside the import transaction", async () => {
    const response = await importBackup({
      version: "1.4",
      accounts: [],
      calendarEntries: [
        {
          title: "US CPI",
          eventDate: "2026-08-12",
          startTimeMinutes: null,
          timeZone: null,
          category: "ECONOMIC_INDICATOR",
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.calendarEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(h.tx.calendarEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user_1",
          title: "US CPI",
          eventDate: new Date("2026-08-12T00:00:00.000Z"),
        }),
      ],
    });
    expect(revalidateTag).toHaveBeenCalledWith("calendar-entries:user_1", { expire: 0 });
  });

  it("imports an older backup as an empty calendar replacement", async () => {
    const response = await importBackup({ version: "1.3", accounts: [] });

    expect(response.status).toBe(200);
    expect(h.tx.calendarEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(h.tx.calendarEntry.createMany).not.toHaveBeenCalled();
  });

  it("preserves durable recurring cash provenance during backup import", async () => {
    const response = await importBackup({
      version: "1.4",
      accounts: [
        {
          name: "Brokerage",
          type: "ASSET",
          category: "BROKERAGE",
          currency: "USD",
          cashBalance: 100,
          recurringCashTransactions: [
            {
              id: "old_cash_rule_1",
              type: "DEPOSIT",
              amount: 100,
              frequency: "MONTHLY",
              startDate: "2026-01-01T00:00:00.000Z",
              nextRunDate: "2026-02-01T00:00:00.000Z",
              isActive: true,
              createdAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          cashTransactions: [
            {
              type: "DEPOSIT",
              amount: 100,
              createdAt: "2026-01-01T00:00:00.000Z",
              occurrenceDate: "2026-01-01T00:00:00.000Z",
              materializedAt: "2025-12-31T21:30:00.000Z",
              materializedAtEstimated: false,
              recurringId: "old_cash_rule_1",
            },
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.cashTransaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: "new_account_1",
          materializedAt: "2025-12-31T21:30:00.000Z",
          materializedAtEstimated: false,
          recurringId: "new_cash_rule_1",
        }),
      ],
    });
  });

  it("uses the linked rule creation bound for an older backfill imported after a snapshot", async () => {
    const response = await importBackup({
      version: "1.4",
      accounts: [
        {
          name: "Brokerage",
          type: "ASSET",
          category: "BROKERAGE",
          currency: "USD",
          cashBalance: 100,
          recurringCashTransactions: [
            {
              id: "old_cash_rule_1",
              type: "DEPOSIT",
              amount: 100,
              frequency: "MONTHLY",
              startDate: "2026-01-01T00:00:00.000Z",
              nextRunDate: "2026-02-01T00:00:00.000Z",
              isActive: true,
              createdAt: "2026-03-06T12:00:00.000Z",
            },
          ],
          cashTransactions: [
            {
              type: "DEPOSIT",
              amount: 100,
              createdAt: "2026-03-01T00:00:00.000Z",
              occurrenceDate: "2026-03-01T00:00:00.000Z",
              recurringId: "old_cash_rule_1",
            },
          ],
        },
      ],
      snapshots: [
        {
          date: "2026-03-05T00:00:00.000Z",
          totalAssets: 100,
          totalLiabilities: 0,
          netWorth: 100,
          baseCurrency: "USD",
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.cashTransaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          materializedAt: "2026-03-06T12:00:00.000Z",
          materializedAtEstimated: true,
          recurringId: "new_cash_rule_1",
        }),
      ],
    });
  });

  it("keeps the transaction creation bound when it is later than the linked rule", async () => {
    const response = await importBackup({
      version: "1.4",
      accounts: [
        {
          name: "Brokerage",
          type: "ASSET",
          category: "BROKERAGE",
          currency: "USD",
          cashBalance: 100,
          recurringCashTransactions: [
            {
              id: "old_cash_rule_1",
              type: "DEPOSIT",
              amount: 100,
              frequency: "MONTHLY",
              startDate: "2026-01-01T00:00:00.000Z",
              nextRunDate: "2026-02-01T00:00:00.000Z",
              isActive: true,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
          ],
          cashTransactions: [
            {
              type: "DEPOSIT",
              amount: 100,
              createdAt: "2026-03-07T00:00:00.000Z",
              occurrenceDate: "2026-03-01T00:00:00.000Z",
              recurringId: "old_cash_rule_1",
            },
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.cashTransaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          materializedAt: "2026-03-07T00:00:00.000Z",
          materializedAtEstimated: true,
          recurringId: "new_cash_rule_1",
        }),
      ],
    });
  });

  it("keeps the transaction creation bound when the linked rule is missing", async () => {
    const response = await importBackup({
      version: "1.4",
      accounts: [
        {
          name: "Brokerage",
          type: "ASSET",
          category: "BROKERAGE",
          currency: "USD",
          cashBalance: 100,
          cashTransactions: [
            {
              type: "DEPOSIT",
              amount: 100,
              createdAt: "2026-03-07T00:00:00.000Z",
              occurrenceDate: "2026-03-01T00:00:00.000Z",
              recurringId: "missing_cash_rule",
            },
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.cashTransaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          materializedAt: "2026-03-07T00:00:00.000Z",
          materializedAtEstimated: true,
          recurringId: null,
        }),
      ],
    });
  });

  it("preserves remapped mixed-currency snapshot breakdown entries for later FX revaluation", async () => {
    const response = await importBackup({
      version: "1.4",
      settings: { baseCurrency: "TWD", locale: "en-US" },
      accounts: [
        {
          id: "exported_usd_account",
          name: "US savings",
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: 100,
          isActive: true,
          isPinned: false,
          sortOrder: 0,
        },
      ],
      snapshots: [
        {
          date: "2026-07-01T00:00:00.000Z",
          totalAssets: 100,
          totalLiabilities: 0,
          netWorth: 100,
          baseCurrency: "USD",
          breakdown: {
            exported_usd_account: { value: 100, currency: "USD", type: "CASH" },
          },
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(h.tx.netWorthSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          totalAssets: 3000,
          totalLiabilities: 0,
          netWorth: 3000,
          baseCurrency: "TWD",
          breakdown: {
            new_account_1: { value: 100, currency: "USD", type: "CASH" },
          },
        }),
      ],
    });
  });

  it("logs a resolved total price-refresh failure after import warm-up", async () => {
    h.priceRefreshResult = { outcome: "total_failure", errors: ["Yahoo Finance unavailable"] };
    const { log } = await import("@/lib/logger");

    const response = await importBackup({ version: "1.4", accounts: [] });
    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(
      "import.price_warm_failed",
      expect.objectContaining({ outcome: "total_failure" }),
    );
  });
});
