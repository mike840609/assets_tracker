import { describe, it, expect, beforeEach, vi } from "vitest";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import { toDbMoneyDelta } from "@/lib/services/balance";
import { getFreshExchangeRates } from "@/lib/services/exchange-rate-service";

const h = vi.hoisted(() => ({
  account: null as Record<string, unknown> | null,
  cashTx: null as Record<string, unknown> | null,
  holdingTx: null as Record<string, unknown> | null,
  accountUpdateManyCount: 1,
  cashTransactionUpdateManyCount: 1,
  holdingTransactionUpdateManyCount: 1,
  holdingTransactionDeleteManyCount: 1,
  holdingUpdateManyCount: 1,
  transactionRows: [] as Record<string, unknown>[],
  exchangeRates: new Map<string, number>(),
  calls: [] as Array<{ op: string; args?: Record<string, unknown> }>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// Keep `resolveRate` real (it is pure); only the DB read is stubbed so the
// cross-currency reversal is exercised through the production resolver.
vi.mock("@/lib/services/exchange-rate-service", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/services/exchange-rate-service")>();
  return { ...actual, getFreshExchangeRates: vi.fn(async () => h.exchangeRates) };
});

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, userId: string) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1"),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    account: {
      findUnique: vi.fn(async () => h.account),
      findUniqueOrThrow: vi.fn(async () => h.account),
      update: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "account.update", args });
        return { id: "acc1", ...(args.data as Record<string, unknown>) };
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "account.updateMany", args });
        return { count: h.accountUpdateManyCount };
      }),
    },
    cashTransaction: {
      findUnique: vi.fn(async () => h.cashTx),
      findUniqueOrThrow: vi.fn(async () => ({ id: "cash1", ...(h.cashTx ?? {}) })),
      create: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "cashTransaction.create", args });
        return { id: "cash-new", ...(args.data as Record<string, unknown>) };
      }),
      update: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "cashTransaction.update", args });
        return { id: "cash1", ...(args.data as Record<string, unknown>) };
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "cashTransaction.updateMany", args });
        return { count: h.cashTransactionUpdateManyCount };
      }),
      delete: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "cashTransaction.delete", args });
        return { id: "cash1" };
      }),
    },
    holding: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holding.update", args });
        return { id: "holding1" };
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holding.updateMany", args });
        return { count: h.holdingUpdateManyCount };
      }),
    },
    holdingTransaction: {
      findUnique: vi.fn(async () => h.holdingTx),
      findUniqueOrThrow: vi.fn(async () => ({ id: "holdtx1", quantity: 15, type: "BUY" })),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holdingTransaction.updateMany", args });
        return { count: h.holdingTransactionUpdateManyCount };
      }),
      deleteMany: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holdingTransaction.deleteMany", args });
        return { count: h.holdingTransactionDeleteManyCount };
      }),
    },
    $transaction: vi.fn(async (work: unknown) => {
      h.calls.push({ op: "$transaction" });
      if (Array.isArray(work)) return Promise.all(work);
      return (work as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }),
    $queryRaw: vi.fn(async () => h.transactionRows),
  };
  return { prisma };
});

const params = (id = "acc1", transactionId = "tx1") => ({
  params: Promise.resolve({ id, transactionId }),
});

const jsonRequest = (method: string, body: Record<string, unknown>) =>
  new Request("http://unit.test", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("toDbMoneyDelta", () => {
  it("snaps float-arithmetic noise to the DB's 8-dp scale", () => {
    // 0.1 + 0.2 style error: (0.3 - 0.2) - 0.1 leaves ~2.8e-17 noise
    const noisy = 0.3 - 0.2 - 0.1 + 0.25;
    expect(toDbMoneyDelta(noisy).toString()).toBe("0.25");
  });

  it("preserves sign and legitimate 8-dp precision", () => {
    expect(toDbMoneyDelta(-123.45678901).toString()).toBe("-123.45678901");
  });
});

describe("account ledger routes", () => {
  beforeEach(() => {
    h.account = { id: "acc1", userId: "user1", cashBalance: 10, currency: "USD" };
    h.cashTx = null;
    h.holdingTx = null;
    h.accountUpdateManyCount = 1;
    h.cashTransactionUpdateManyCount = 1;
    h.holdingTransactionUpdateManyCount = 1;
    h.holdingTransactionDeleteManyCount = 1;
    h.holdingUpdateManyCount = 1;
    h.transactionRows = [];
    h.exchangeRates = new Map();
    h.calls = [];
    vi.mocked(getFreshExchangeRates).mockClear();
  });

  it("serializes holding transaction unitPrice as number or null", async () => {
    const { GET } = await import("@/app/api/accounts/[id]/transactions/route");
    h.transactionRows = [
      {
        id: "tx1",
        isCash: false,
        type: "BUY",
        quantity: 2,
        unitPrice: { valueOf: () => 123.45 },
        note: null,
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
        occurrenceDate: null,
        holdingId: "holding1",
      },
      {
        id: "tx2",
        isCash: false,
        type: "SELL",
        quantity: 1,
        unitPrice: null,
        note: null,
        createdAt: new Date("2026-01-01T03:04:05.000Z"),
        occurrenceDate: null,
        holdingId: "holding1",
      },
    ];

    const response = await GET(new Request("http://unit.test?limit=20"), {
      params: Promise.resolve({ id: "acc1" }),
    });
    const body = (await response.json()) as {
      data: { transactions: Array<{ unitPrice?: number | null }> };
    };

    expect(body.data.transactions.map((tx) => tx.unitPrice)).toEqual([123.45, null]);
  });

  it("creates a manual cash transaction and balance increment in one transaction", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/cash-transactions/route");

    const response = await POST(jsonRequest("POST", { type: "DEPOSIT", amount: 100 }), {
      params: Promise.resolve({ id: "acc1" }),
    });

    expect(response.status).toBe(201);
    expect(h.calls[0].op).toBe("$transaction");
    expect(h.calls.find((call) => call.op === "cashTransaction.create")?.args?.data).toMatchObject({
      accountId: "acc1",
      type: "DEPOSIT",
      amount: 100,
    });
    expect(h.calls.find((call) => call.op === "account.update")?.args?.data).toEqual({
      cashBalance: { increment: toDbMoneyDelta(100) },
    });
  });

  it("persists a manual occurrenceDate as UTC midnight on create", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/cash-transactions/route");

    const response = await POST(
      jsonRequest("POST", { type: "DEPOSIT", amount: 100, occurrenceDate: "2026-06-01" }),
      { params: Promise.resolve({ id: "acc1" }) },
    );

    expect(response.status).toBe(201);
    const created = h.calls.find((call) => call.op === "cashTransaction.create")?.args?.data as {
      occurrenceDate?: Date;
    };
    expect(created.occurrenceDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));
  });

  it("updates and clears occurrenceDate on a cash transaction edit", async () => {
    h.cashTx = { id: "tx1", accountId: "acc1", type: "DEPOSIT", amount: 100 };
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    let response = await PATCH(
      jsonRequest("PATCH", { id: "tx1", occurrenceDate: "2026-06-01" }),
      params(),
    );
    expect(response.status).toBe(200);
    let write = h.calls.find((call) => call.op === "cashTransaction.updateMany")?.args?.data as {
      occurrenceDate?: Date | null;
    };
    expect(write.occurrenceDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));

    h.calls = [];
    response = await PATCH(jsonRequest("PATCH", { id: "tx1", occurrenceDate: null }), params());
    expect(response.status).toBe(200);
    write = h.calls.find((call) => call.op === "cashTransaction.updateMany")?.args?.data as {
      occurrenceDate?: Date | null;
    };
    expect(write.occurrenceDate).toBeNull();
  });

  it("stamps occurrenceDate onto the EDIT row from a backdated balance edit", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(
      jsonRequest("PATCH", { cashBalance: 25, occurrenceDate: "2026-06-01" }),
      { params: Promise.resolve({ id: "acc1" }) },
    );

    expect(response.status).toBe(200);
    const edit = h.calls.find((call) => call.op === "cashTransaction.create")?.args?.data as {
      occurrenceDate?: Date;
    };
    expect(edit.occurrenceDate).toEqual(new Date("2026-06-01T00:00:00.000Z"));
    // occurrenceDate must not leak into the account row write.
    const accountWrite = h.calls.find((call) => call.op === "account.updateMany")?.args as {
      data?: Record<string, unknown>;
    };
    expect(accountWrite.data).toEqual({ cashBalance: 25 });
  });

  it("rejects invalid account currency without writing", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(jsonRequest("PATCH", { currency: "US" }), {
      params: Promise.resolve({ id: "acc1" }),
    });

    expect(response.status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it("rejects account type changes without writing", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(jsonRequest("PATCH", { type: "LIABILITY" }), {
      params: Promise.resolve({ id: "acc1" }),
    });

    expect(response.status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it("records manual account balance edits atomically and strips note from account data", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(
      jsonRequest("PATCH", { cashBalance: 25, note: "opening correction" }),
      { params: Promise.resolve({ id: "acc1" }) },
    );

    expect(response.status).toBe(200);
    expect(h.calls[0].op).toBe("$transaction");
    const edit = h.calls.find((call) => call.op === "cashTransaction.create")?.args?.data as
      | Record<string, unknown>
      | undefined;
    expect(edit).toMatchObject({
      accountId: "acc1",
      type: "EDIT",
      note: "opening correction",
    });
    expect(Number(edit?.amount)).toBe(15);
    const accountWrite = h.calls.find((call) => call.op === "account.updateMany")?.args as
      | { where?: Record<string, unknown>; data?: Record<string, unknown> }
      | undefined;
    expect(accountWrite?.where).toMatchObject({ id: "acc1", userId: "user1", cashBalance: 10 });
    expect(accountWrite?.data).toEqual({ cashBalance: 25 });
  });

  it("rejects a manual balance edit when the balance changed concurrently (409)", async () => {
    h.accountUpdateManyCount = 0;
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(jsonRequest("PATCH", { cashBalance: 25 }), {
      params: Promise.resolve({ id: "acc1" }),
    });

    expect(response.status).toBe(409);
  });

  it("applies holding edit quantity changes with atomic deltas", async () => {
    h.holdingTx = {
      id: "tx1",
      type: "BUY",
      quantity: 10,
      recurringId: null,
      materializedAt: null,
      cashDebit: null,
      holding: { id: "holding1", accountId: "acc1", quantity: 10 },
    };
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 15 }), params());

    expect(response.status).toBe(200);
    expect(
      h.calls.find((call) => call.op === "holdingTransaction.updateMany")?.args?.where,
    ).toMatchObject({
      id: "tx1",
      type: "BUY",
      quantity: 10,
    });
    const holdingWrite = h.calls.find((call) => call.op === "holding.update")?.args?.data as {
      quantity: { increment: unknown };
    };
    expect(Number(holdingWrite.quantity.increment)).toBe(5);
  });

  it("rolls back stale holding edits before applying the holding delta", async () => {
    h.holdingTransactionUpdateManyCount = 0;
    h.holdingTx = {
      id: "tx1",
      type: "BUY",
      quantity: 10,
      recurringId: null,
      materializedAt: null,
      cashDebit: null,
      holding: { id: "holding1", accountId: "acc1", quantity: 10 },
    };
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 15 }), params());

    expect(response.status).toBe(409);
    expect(h.calls.some((call) => call.op === "holding.update")).toBe(false);
    expect(h.calls.some((call) => call.op === "holding.updateMany")).toBe(false);
  });

  it("deletes holding transactions with a guarded decrement", async () => {
    h.holdingTx = {
      id: "tx1",
      type: "BUY",
      quantity: 7,
      recurringId: null,
      materializedAt: null,
      cashDebit: null,
      holding: { id: "holding1", accountId: "acc1", quantity: 7 },
    };
    const { DELETE } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await DELETE(new Request("http://unit.test", { method: "DELETE" }), params());

    expect(response.status).toBe(200);
    expect(
      h.calls.find((call) => call.op === "holdingTransaction.deleteMany")?.args?.where,
    ).toMatchObject({
      id: "tx1",
      type: "BUY",
      quantity: 7,
    });
    const deleteWrite = h.calls.find((call) => call.op === "holding.updateMany")?.args as {
      where: { id: string; quantity: { gte: unknown } };
      data: { quantity: { decrement: unknown } };
    };
    expect(deleteWrite.where.id).toBe("holding1");
    expect(Number(deleteWrite.where.quantity.gte)).toBe(7);
    expect(Number(deleteWrite.data.quantity.decrement)).toBe(7);
  });

  // --- DCA (generated) buys: creation debited cash, so mutations must undo it ---

  /**
   * A buy as the materializer writes it today: durable provenance
   * (`materializedAt`) plus `cashDebit`, the exact account-currency cash the
   * row removed.
   */
  const generatedBuy = (overrides: Record<string, unknown> = {}) => ({
    id: "tx1",
    type: "BUY",
    quantity: new Decimal(2),
    unitPrice: new Decimal("101.25"),
    recurringId: "rule1",
    materializedAt: new Date("2026-06-14T21:30:00.000Z"),
    cashDebit: new Decimal("202.50"),
    holding: { id: "holding1", accountId: "acc1", currency: "USD", quantity: new Decimal(2) },
    ...overrides,
  });

  /** A buy generated before the provenance columns existed: recurringId only. */
  const legacyGeneratedBuy = (overrides: Record<string, unknown> = {}) =>
    generatedBuy({ materializedAt: null, cashDebit: null, ...overrides });

  /** A hand-entered buy: no provenance at all, and it never moved cash. */
  const manualBuy = (overrides: Record<string, unknown> = {}) =>
    generatedBuy({ recurringId: null, materializedAt: null, cashDebit: null, ...overrides });

  const deleteTx = async () => {
    const { DELETE } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");
    return DELETE(new Request("http://unit.test", { method: "DELETE" }), params());
  };

  const cashIncrement = () =>
    Number(
      (
        h.calls.find((call) => call.op === "account.update")?.args?.data as {
          cashBalance: { increment: unknown };
        }
      ).cashBalance.increment,
    );

  it("reverses the exact stored cash debit, without any FX lookup, on delete", async () => {
    // Cross-currency on purpose: the holding is priced in TWD while the account
    // is USD, yet nothing is converted — cashDebit already is account currency.
    h.holdingTx = generatedBuy({
      holding: { id: "holding1", accountId: "acc1", currency: "TWD", quantity: new Decimal(2) },
    });

    const response = await deleteTx();

    expect(response.status).toBe(200);
    expect(cashIncrement()).toBe(202.5);
    // The rate loader must never be consulted: an exact reversal cannot depend
    // on today's FX rate, and the empty rate map would otherwise fail closed.
    expect(vi.mocked(getFreshExchangeRates)).not.toHaveBeenCalled();
  });

  it("reverses the stored debit after the recurring rule was deleted", async () => {
    // recurringId is onDelete: SetNull, so only materializedAt still says this
    // row was generated. Without it the debit would silently never come back.
    h.holdingTx = generatedBuy({ recurringId: null });

    const response = await deleteTx();

    expect(response.status).toBe(200);
    expect(cashIncrement()).toBe(202.5);
    expect(vi.mocked(getFreshExchangeRates)).not.toHaveBeenCalled();
  });

  it("scales the stored debit by the quantity ratio when a generated buy is resized", async () => {
    h.holdingTx = generatedBuy();
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    let response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());
    expect(response.status).toBe(200);
    // Growing 2 -> 3 shares spends another half of the original 202.50.
    expect(cashIncrement()).toBe(-101.25);

    h.calls = [];
    response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 1 }), params());
    expect(response.status).toBe(200);
    // Shrinking 2 -> 1 share gives that same half back.
    expect(cashIncrement()).toBe(101.25);
    expect(vi.mocked(getFreshExchangeRates)).not.toHaveBeenCalled();
  });

  it("writes the resized debit back so a later delete reverses the resized amount", async () => {
    h.holdingTx = generatedBuy();
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());
    expect(response.status).toBe(200);
    const write = h.calls.find((call) => call.op === "holdingTransaction.updateMany")?.args
      ?.data as { cashDebit?: unknown };
    // 202.50 for 2 shares becomes 303.75 for 3 — the 202.50 already out plus
    // the 101.25 this resize just spent.
    expect(Number(write.cashDebit)).toBe(303.75);

    // Deleting the resized row must now give all of it back.
    h.holdingTx = generatedBuy({ quantity: new Decimal(3), cashDebit: new Decimal("303.75") });
    h.calls = [];
    expect((await deleteTx()).status).toBe(200);
    expect(cashIncrement()).toBe(303.75);
  });

  it("leaves a legacy row's null debit alone when it is resized", async () => {
    h.holdingTx = legacyGeneratedBuy({ unitPrice: new Decimal(100) });
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());

    expect(response.status).toBe(200);
    const write = h.calls.find((call) => call.op === "holdingTransaction.updateMany")?.args
      ?.data as Record<string, unknown>;
    // Nothing stored to keep in step: that path re-derives from quantity.
    expect(write).not.toHaveProperty("cashDebit");
  });

  it("fails closed with 409 when a stored debit cannot be scaled by a zero quantity", async () => {
    h.holdingTx = generatedBuy({ quantity: new Decimal(0) });
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());

    expect(response.status).toBe(409);
    expect(h.calls).toEqual([]);
  });

  it("credits back a legacy generated buy's cash approximated from unitPrice", async () => {
    h.holdingTx = legacyGeneratedBuy();

    const response = await deleteTx();

    expect(response.status).toBe(200);
    // 2 shares x 101.25, holding currency == account currency so no conversion.
    expect(cashIncrement()).toBe(202.5);
  });

  it("converts a legacy cross-currency generated buy at today's rate", async () => {
    h.exchangeRates = new Map([["TWD_USD", 0.03125]]);
    h.holdingTx = legacyGeneratedBuy({
      unitPrice: new Decimal(100),
      holding: { id: "holding1", accountId: "acc1", currency: "TWD", quantity: new Decimal(2) },
    });

    const response = await deleteTx();

    expect(response.status).toBe(200);
    // 2 x 100 TWD = 200 TWD -> 6.25 USD at 0.03125. Approximate by
    // construction: the occurrence-day rate is gone for a pre-cashDebit row.
    expect(cashIncrement()).toBe(6.25);
    // Counterpart to the exact path's "never called": this legacy row is the
    // only kind of reversal that may read a rate at all.
    expect(vi.mocked(getFreshExchangeRates)).toHaveBeenCalled();
  });

  it("fails closed with 409 when a legacy generated buy's rate cannot be resolved", async () => {
    h.holdingTx = legacyGeneratedBuy({
      holding: { id: "holding1", accountId: "acc1", currency: "TWD", quantity: new Decimal(2) },
    });

    const response = await deleteTx();

    expect(response.status).toBe(409);
    expect(h.calls).toEqual([]);
  });

  it("fails closed with 409 when a legacy generated buy has no unitPrice", async () => {
    h.holdingTx = legacyGeneratedBuy({ unitPrice: null });

    const response = await deleteTx();

    expect(response.status).toBe(409);
    expect(h.calls).toEqual([]);
  });

  it("applies a proportional cash delta when a legacy generated buy is resized", async () => {
    h.holdingTx = legacyGeneratedBuy({ unitPrice: new Decimal(100) });
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    let response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());
    expect(response.status).toBe(200);
    // Growing 2 -> 3 shares spends another 100.
    expect(cashIncrement()).toBe(-100);

    h.calls = [];
    response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 1 }), params());
    expect(response.status).toBe(200);
    // Shrinking 2 -> 1 share gives 100 back.
    expect(cashIncrement()).toBe(100);
  });

  it("leaves cash untouched when deleting a manual buy", async () => {
    h.holdingTx = manualBuy();

    const response = await deleteTx();

    expect(response.status).toBe(200);
    expect(h.calls.some((call) => call.op === "account.update")).toBe(false);
  });

  it("leaves cash untouched when resizing a manual buy", async () => {
    h.holdingTx = manualBuy();
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", quantity: 3 }), params());

    expect(response.status).toBe(200);
    expect(h.calls.some((call) => call.op === "account.update")).toBe(false);
  });

  it("rejects changing the type of a generated buy without writing", async () => {
    h.holdingTx = generatedBuy();
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", type: "SELL" }), params());

    expect(response.status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it("edits a cash transaction with a guarded balance delta", async () => {
    h.cashTx = { id: "tx1", accountId: "acc1", type: "DEPOSIT", amount: 100 };
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", amount: 150 }), params());

    expect(response.status).toBe(200);
    expect(
      h.calls.find((call) => call.op === "cashTransaction.updateMany")?.args?.where,
    ).toMatchObject({
      id: "tx1",
      type: "DEPOSIT",
      amount: 100,
    });
    expect(h.calls.find((call) => call.op === "account.update")?.args?.data).toEqual({
      cashBalance: { increment: toDbMoneyDelta(50) },
    });
  });

  it("rejects a stale cash transaction edit with 409", async () => {
    h.cashTx = { id: "tx1", accountId: "acc1", type: "DEPOSIT", amount: 100 };
    h.cashTransactionUpdateManyCount = 0;
    const { PATCH } = await import("@/app/api/accounts/[id]/transactions/[transactionId]/route");

    const response = await PATCH(jsonRequest("PATCH", { id: "tx1", amount: 150 }), params());

    expect(response.status).toBe(409);
    expect(h.calls.some((call) => call.op === "account.update")).toBe(false);
  });

  it("allows a PATCH without a currency key to update other fields", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(jsonRequest("PATCH", { name: "Renamed" }), {
      params: Promise.resolve({ id: "acc1" }),
    });

    expect(response.status).toBe(200);
  });
});
