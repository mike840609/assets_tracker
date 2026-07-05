import { describe, it, expect } from "vitest";
import {
  createHoldingSchema,
  updateAccountSchema,
  updateHoldingSchema,
  updateTransactionSchema,
  createCashTransactionSchema,
  updateCashTransactionSchema,
  createGoalSchema,
  createStockWatchItemSchema,
  updateSnapshotAnnotationSchema,
  dataImportSchema,
} from "@/lib/validators";

// Locks in the E6 validator hardening (positive quantities, immutable
// assetType, per-type transaction unions, OCC option shape, ISO datetimes).

describe("updateAccountSchema", () => {
  it("accepts a bounded manual balance edit note", () => {
    const result = updateAccountSchema.safeParse({ cashBalance: 125, note: "opening correction" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("opening correction");
    }
  });

  it("rejects an oversized manual balance edit note", () => {
    expect(updateAccountSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
  });

  it("accepts a YYYY-MM-DD occurrenceDate for backdated balance edits", () => {
    expect(
      updateAccountSchema.safeParse({ cashBalance: 125, occurrenceDate: "2026-06-01" }).success,
    ).toBe(true);
    expect(
      updateAccountSchema.safeParse({ cashBalance: 125, occurrenceDate: "June 1st" }).success,
    ).toBe(false);
  });
});

describe("createHoldingSchema", () => {
  const base = { symbol: "aapl", name: "Apple", quantity: 10, assetType: "STOCK" as const };

  it("uppercases the symbol and defaults currency to USD", () => {
    const result = createHoldingSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.symbol).toBe("AAPL");
      expect(result.data.currency).toBe("USD");
    }
  });

  it("rejects a zero quantity", () => {
    expect(createHoldingSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });

  it("rejects a negative quantity", () => {
    expect(createHoldingSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it("accepts an optional positive buy unit price", () => {
    expect(createHoldingSchema.safeParse(base).success).toBe(true);

    const result = createHoldingSchema.safeParse({ ...base, unitPrice: 180.25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitPrice).toBe(180.25);
    }
  });

  it("rejects a non-positive buy unit price", () => {
    expect(createHoldingSchema.safeParse({ ...base, unitPrice: 0 }).success).toBe(false);
    expect(createHoldingSchema.safeParse({ ...base, unitPrice: -1 }).success).toBe(false);
  });

  it("accepts an OPTION holding with a valid OCC symbol", () => {
    const result = createHoldingSchema.safeParse({
      symbol: "AAPL240119C00150000",
      name: "AAPL Call",
      quantity: 1,
      assetType: "OPTION",
    });
    expect(result.success).toBe(true);
    // contractMultiplier defaults to the OCC-standard 100.
    if (result.success && result.data.assetType === "OPTION") {
      expect(result.data.contractMultiplier).toBe(100);
    }
  });

  it("rejects an OPTION holding whose symbol is not a valid OCC contract", () => {
    const result = createHoldingSchema.safeParse({
      symbol: "AAPL",
      name: "AAPL Call",
      quantity: 1,
      assetType: "OPTION",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateHoldingSchema", () => {
  it("allows a zero quantity (closing an option position)", () => {
    expect(updateHoldingSchema.safeParse({ id: "h1", quantity: 0 }).success).toBe(true);
  });

  it("rejects a negative quantity", () => {
    expect(updateHoldingSchema.safeParse({ id: "h1", quantity: -5 }).success).toBe(false);
  });

  it("refuses to convert a holding to OPTION via PATCH", () => {
    expect(updateHoldingSchema.safeParse({ id: "h1", assetType: "OPTION" }).success).toBe(false);
  });

  it("permits switching between non-option asset types", () => {
    expect(updateHoldingSchema.safeParse({ id: "h1", assetType: "ETF" }).success).toBe(true);
  });
});

describe("updateTransactionSchema", () => {
  it("rejects a non-positive quantity for BUY/SELL", () => {
    expect(updateTransactionSchema.safeParse({ id: "t1", type: "BUY", quantity: 0 }).success).toBe(
      false,
    );
    expect(
      updateTransactionSchema.safeParse({ id: "t1", type: "SELL", quantity: -2 }).success,
    ).toBe(false);
  });

  it("rejects a zero adjustment for EDIT but allows non-zero", () => {
    expect(updateTransactionSchema.safeParse({ id: "t1", type: "EDIT", quantity: 0 }).success).toBe(
      false,
    );
    expect(
      updateTransactionSchema.safeParse({ id: "t1", type: "EDIT", quantity: -3 }).success,
    ).toBe(true);
  });

  it("rejects a non-ISO createdAt", () => {
    expect(updateTransactionSchema.safeParse({ id: "t1", createdAt: "2026-06-14" }).success).toBe(
      false,
    );
    expect(
      updateTransactionSchema.safeParse({ id: "t1", createdAt: "2026-06-14T00:00:00.000Z" })
        .success,
    ).toBe(true);
  });
});

describe("cash transaction schemas", () => {
  it("requires a positive amount for DEPOSIT/WITHDRAWAL", () => {
    expect(createCashTransactionSchema.safeParse({ type: "DEPOSIT", amount: 0 }).success).toBe(
      false,
    );
    expect(createCashTransactionSchema.safeParse({ type: "WITHDRAWAL", amount: 100 }).success).toBe(
      true,
    );
  });

  it("rejects a zero EDIT adjustment but allows a negative one", () => {
    expect(createCashTransactionSchema.safeParse({ type: "EDIT", amount: 0 }).success).toBe(false);
    expect(createCashTransactionSchema.safeParse({ type: "EDIT", amount: -50 }).success).toBe(true);
  });

  it("enforces per-type amount rules on update", () => {
    expect(
      updateCashTransactionSchema.safeParse({ id: "c1", type: "DEPOSIT", amount: -1 }).success,
    ).toBe(false);
    expect(
      updateCashTransactionSchema.safeParse({ id: "c1", type: "EDIT", amount: 0 }).success,
    ).toBe(false);
  });

  it("accepts an optional YYYY-MM-DD occurrenceDate on create", () => {
    expect(
      createCashTransactionSchema.safeParse({
        type: "DEPOSIT",
        amount: 100,
        occurrenceDate: "2026-01-15",
      }).success,
    ).toBe(true);
    // Omitted is fine — analysis/display fall back to createdAt.
    expect(createCashTransactionSchema.safeParse({ type: "DEPOSIT", amount: 100 }).success).toBe(
      true,
    );
  });

  it("rejects a malformed occurrenceDate on create", () => {
    expect(
      createCashTransactionSchema.safeParse({
        type: "WITHDRAWAL",
        amount: 50,
        occurrenceDate: "not-a-date",
      }).success,
    ).toBe(false);
    // Datetime strings are not calendar days.
    expect(
      createCashTransactionSchema.safeParse({
        type: "WITHDRAWAL",
        amount: 50,
        occurrenceDate: "2026-01-15T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      createCashTransactionSchema.safeParse({
        type: "EDIT",
        amount: -5,
        occurrenceDate: "2026-13-40",
      }).success,
    ).toBe(false);
  });

  it("accepts occurrenceDate (or null to clear it) on update", () => {
    expect(
      updateCashTransactionSchema.safeParse({ id: "c1", occurrenceDate: "2025-12-31" }).success,
    ).toBe(true);
    expect(updateCashTransactionSchema.safeParse({ id: "c1", occurrenceDate: null }).success).toBe(
      true,
    );
    expect(
      updateCashTransactionSchema.safeParse({ id: "c1", occurrenceDate: "31/12/2025" }).success,
    ).toBe(false);
  });
});

describe("createGoalSchema", () => {
  it("requires a positive target amount", () => {
    expect(
      createGoalSchema.safeParse({ name: "House", targetAmount: 0, scope: "NET_WORTH" }).success,
    ).toBe(false);
  });

  it("rejects a malformed target date", () => {
    expect(
      createGoalSchema.safeParse({
        name: "House",
        targetAmount: 100,
        scope: "NET_WORTH",
        targetDate: "06/14/2026",
      }).success,
    ).toBe(false);
  });
});

describe("createStockWatchItemSchema", () => {
  const base = {
    symbol: "tsla",
    name: "Tesla",
    recordPrice: 250,
    recordDate: "2026-06-14",
  };

  it("uppercases the symbol and accepts a valid record date", () => {
    const result = createStockWatchItemSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.symbol).toBe("TSLA");
  });

  it("rejects a non-positive record price", () => {
    expect(createStockWatchItemSchema.safeParse({ ...base, recordPrice: 0 }).success).toBe(false);
  });

  it("rejects a malformed record date", () => {
    expect(
      createStockWatchItemSchema.safeParse({ ...base, recordDate: "2026/06/14" }).success,
    ).toBe(false);
  });
});

describe("updateSnapshotAnnotationSchema", () => {
  it("accepts nullable label and note fields", () => {
    expect(updateSnapshotAnnotationSchema.safeParse({ label: null, note: null }).success).toBe(
      true,
    );
    expect(
      updateSnapshotAnnotationSchema.safeParse({ label: "Bonus paid", note: "Annual event" })
        .success,
    ).toBe(true);
  });

  it("enforces label and note length limits", () => {
    expect(updateSnapshotAnnotationSchema.safeParse({ label: "x".repeat(81) }).success).toBe(false);
    expect(updateSnapshotAnnotationSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
  });
});

describe("dataImportSchema", () => {
  it("rejects an imported settings locale outside supported locales", () => {
    const result = dataImportSchema.safeParse({
      version: "1.2",
      settings: { baseCurrency: "USD", locale: "fr-FR" },
      accounts: [],
    });

    expect(result.success).toBe(false);
  });

  it("preserves transaction occurrenceDate through parsing, keeping null as null", () => {
    const result = dataImportSchema.safeParse({
      version: "1.2",
      accounts: [
        {
          name: "Checking",
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: "100",
          holdings: [
            {
              symbol: "VT",
              name: "Vanguard Total World",
              quantity: "1",
              currency: "USD",
              assetType: "ETF",
              transactions: [
                { type: "BUY", quantity: "1", occurrenceDate: "2026-06-01T00:00:00.000Z" },
                { type: "SELL", quantity: "1", occurrenceDate: null },
              ],
            },
          ],
          cashTransactions: [
            { type: "DEPOSIT", amount: "50", occurrenceDate: "2026-06-15T00:00:00.000Z" },
            { type: "WITHDRAWAL", amount: "10", occurrenceDate: null },
            { type: "DEPOSIT", amount: "5" },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const account = result.data.accounts[0];
    expect(account.holdings?.[0].transactions?.map((t) => t.occurrenceDate)).toEqual([
      "2026-06-01T00:00:00.000Z",
      null,
    ]);
    expect(account.cashTransactions?.map((t) => t.occurrenceDate)).toEqual([
      "2026-06-15T00:00:00.000Z",
      null,
      undefined,
    ]);
  });

  it("preserves imported holding transaction unitPrice through parsing", () => {
    const result = dataImportSchema.safeParse({
      version: "1.2",
      accounts: [
        {
          name: "Checking",
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: "100",
          holdings: [
            {
              symbol: "VT",
              name: "Vanguard Total World",
              quantity: "1",
              currency: "USD",
              assetType: "ETF",
              transactions: [
                { type: "BUY", quantity: "1", unitPrice: "180.25" },
                { type: "SELL", quantity: "1", unitPrice: null },
                { type: "EDIT", quantity: "-0.5" },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.accounts[0].holdings?.[0].transactions?.map((t) => t.unitPrice)).toEqual([
      "180.25",
      null,
      undefined,
    ]);
  });

  it("rejects a non-datetime occurrenceDate", () => {
    const result = dataImportSchema.safeParse({
      version: "1.2",
      accounts: [
        {
          name: "Checking",
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: "0",
          cashTransactions: [{ type: "DEPOSIT", amount: "1", occurrenceDate: "not-a-date" }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("round-trips an account's recurring cash transaction and recurring investment", () => {
    const result = dataImportSchema.safeParse({
      version: "1.3",
      accounts: [
        {
          name: "Checking",
          type: "ASSET",
          category: "BANK",
          currency: "USD",
          cashBalance: "100",
          recurringCashTransactions: [
            {
              id: "rct_1",
              type: "DEPOSIT",
              amount: "500",
              frequency: "MONTHLY",
              startDate: "2026-01-01T00:00:00.000Z",
              nextRunDate: "2026-08-01T00:00:00.000Z",
              isActive: true,
            },
          ],
          recurringInvestments: [
            {
              id: "ri_1",
              symbol: "VT",
              name: "Vanguard Total World",
              assetType: "ETF",
              holdingCurrency: "USD",
              amount: "200",
              frequency: "MONTHLY",
              startDate: "2026-01-01T00:00:00.000Z",
              nextRunDate: "2026-08-01T00:00:00.000Z",
              isActive: true,
            },
          ],
          cashTransactions: [{ type: "DEPOSIT", amount: "500", recurringId: "rct_1" }],
          holdings: [
            {
              symbol: "VT",
              name: "Vanguard Total World",
              quantity: "1",
              currency: "USD",
              assetType: "ETF",
              transactions: [{ type: "BUY", quantity: "1", recurringId: "ri_1" }],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const account = result.data.accounts[0];
    expect(account.recurringCashTransactions?.[0].id).toBe("rct_1");
    expect(account.recurringInvestments?.[0].id).toBe("ri_1");
    expect(account.cashTransactions?.[0].recurringId).toBe("rct_1");
    expect(account.holdings?.[0].transactions?.[0].recurringId).toBe("ri_1");
  });

  it("rejects an over-limit stockWatchItems array", () => {
    const result = dataImportSchema.safeParse({
      version: "1.3",
      accounts: [],
      stockWatchItems: Array.from({ length: 501 }, (_, i) => ({
        symbol: `SYM${i}`,
        name: "Example Corp",
        currency: "USD",
        recordPrice: "100",
        recordDate: "2026-06-01T00:00:00.000Z",
      })),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a stockWatchItems array within the limit", () => {
    const result = dataImportSchema.safeParse({
      version: "1.3",
      accounts: [],
      stockWatchItems: [
        {
          symbol: "AAPL",
          name: "Apple Inc",
          currency: "USD",
          recordPrice: "195.5",
          recordDate: "2026-06-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
