import { describe, it, expect } from "vitest";
import type { CalendarEntry } from "@/generated/prisma/client";
import {
  serializeAccount,
  serializeHolding,
  serializeAccountWithHoldings,
  serializeGoal,
  serializeCalendarEntry,
} from "@/lib/types";

// Minimal Decimal stand-in: Prisma's Decimal coerces via Number(), so any
// object with a matching valueOf() exercises the same code path the
// serializers rely on (Decimal → number).
function decimal(value: number) {
  return { valueOf: () => value, toString: () => String(value) };
}

type AccountInput = Parameters<typeof serializeAccount>[0];
type HoldingInput = Parameters<typeof serializeHolding>[0];
type GoalInput = Parameters<typeof serializeGoal>[0];

const created = new Date("2026-01-02T03:04:05.000Z");
const updated = new Date("2026-02-03T04:05:06.000Z");

function accountFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc1",
    userId: "user1",
    name: "Brokerage",
    type: "ASSET",
    category: "INVESTMENT",
    currency: "USD",
    cashBalance: decimal(1234.56),
    isActive: true,
    isPinned: false,
    sortOrder: 0,
    createdAt: created,
    updatedAt: updated,
    ...overrides,
  } as unknown as AccountInput;
}

function holdingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "h1",
    accountId: "acc1",
    symbol: "AAPL",
    name: "Apple",
    quantity: decimal(10.5),
    currency: "USD",
    assetType: "STOCK",
    underlyingSymbol: null,
    optionType: null,
    strike: null,
    expiration: null,
    contractMultiplier: null,
    createdAt: created,
    updatedAt: updated,
    ...overrides,
  } as unknown as HoldingInput;
}

describe("serializeAccount", () => {
  it("coerces Decimal → number and Date → ISO string", () => {
    const result = serializeAccount(accountFixture());
    expect(result.cashBalance).toBe(1234.56);
    expect(typeof result.cashBalance).toBe("number");
    expect(result.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.updatedAt).toBe("2026-02-03T04:05:06.000Z");
    // Passthrough fields are untouched.
    expect(result.name).toBe("Brokerage");
    expect(result.isActive).toBe(true);
  });
});

describe("serializeHolding", () => {
  it("coerces quantity/strike Decimals and date fields", () => {
    const result = serializeHolding(
      holdingFixture({ strike: decimal(150), expiration: new Date("2026-12-31T00:00:00.000Z") }),
    );
    expect(result.quantity).toBe(10.5);
    expect(result.strike).toBe(150);
    expect(result.expiration).toBe("2026-12-31T00:00:00.000Z");
    expect(result.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("passes through null/undefined option fields without coercion", () => {
    const result = serializeHolding(holdingFixture());
    expect(result.strike).toBeNull();
    expect(result.expiration).toBeNull();
    expect(result.underlyingSymbol).toBeNull();
  });
});

describe("serializeAccountWithHoldings", () => {
  it("serializes the account and each nested holding", () => {
    const result = serializeAccountWithHoldings(
      accountFixture({
        holdings: [holdingFixture(), holdingFixture({ id: "h2", symbol: "MSFT" })],
      }) as unknown as Parameters<typeof serializeAccountWithHoldings>[0],
    );
    expect(result.cashBalance).toBe(1234.56);
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings[0].quantity).toBe(10.5);
    expect(result.holdings[1].symbol).toBe("MSFT");
    // Every holding date is a string, safe for the RSC → client boundary.
    expect(typeof result.holdings[0].createdAt).toBe("string");
  });
});

describe("serializeGoal", () => {
  it("coerces targetAmount and dates, preserving null targetDate", () => {
    const goal = {
      id: "g1",
      userId: "user1",
      name: "House",
      targetAmount: decimal(500000),
      targetCurrency: "USD",
      targetDate: null,
      scope: "NET_WORTH",
      scopeRefId: null,
      sortOrder: 0,
      createdAt: created,
      updatedAt: updated,
    } as unknown as GoalInput;
    const result = serializeGoal(goal);
    expect(result.targetAmount).toBe(500000);
    expect(result.targetDate).toBeNull();
    expect(result.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("serializes a present targetDate to ISO", () => {
    const result = serializeGoal({
      id: "g2",
      userId: "user1",
      name: "Car",
      targetAmount: decimal(40000),
      targetCurrency: "USD",
      targetDate: new Date("2027-01-01T00:00:00.000Z"),
      scope: "NET_WORTH",
      scopeRefId: null,
      sortOrder: 1,
      createdAt: created,
      updatedAt: updated,
    } as unknown as GoalInput);
    expect(result.targetDate).toBe("2027-01-01T00:00:00.000Z");
  });
});

it("serializes a CalendarEntry date without timezone drift and normalizes nullable fields", () => {
  const entry = {
    id: "cal_1",
    userId: "user_1",
    title: "US CPI",
    eventDate: new Date("2026-08-12T00:00:00.000Z"),
    startTimeMinutes: 510,
    timeZone: "Asia/Taipei",
    category: "ECONOMIC_INDICATOR",
    description: null,
    sourceUrl: null,
    createdAt: new Date("2026-07-24T01:02:03.000Z"),
    updatedAt: new Date("2026-07-24T04:05:06.000Z"),
  } satisfies CalendarEntry;

  expect(serializeCalendarEntry(entry)).toEqual({
    id: "cal_1",
    userId: "user_1",
    title: "US CPI",
    eventDate: "2026-08-12",
    startTimeMinutes: 510,
    timeZone: "Asia/Taipei",
    category: "ECONOMIC_INDICATOR",
    description: null,
    sourceUrl: null,
    createdAt: "2026-07-24T01:02:03.000Z",
    updatedAt: "2026-07-24T04:05:06.000Z",
  });
});
