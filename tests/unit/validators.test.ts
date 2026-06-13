import { describe, it, expect } from "vitest";
import {
  createHoldingSchema,
  updateHoldingSchema,
  updateTransactionSchema,
  createCashTransactionSchema,
  updateCashTransactionSchema,
  createGoalSchema,
  createStockWatchItemSchema,
} from "@/lib/validators";

// Locks in the E6 validator hardening (positive quantities, immutable
// assetType, per-type transaction unions, OCC option shape, ISO datetimes).

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
