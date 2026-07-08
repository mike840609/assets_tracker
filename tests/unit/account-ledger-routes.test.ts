import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  account: null as Record<string, unknown> | null,
  cashTx: null as Record<string, unknown> | null,
  holdingTx: null as Record<string, unknown> | null,
  accountUpdateManyCount: 1,
  cashTransactionUpdateManyCount: 1,
  holdingTransactionUpdateManyCount: 1,
  holdingTransactionDeleteManyCount: 1,
  holdingUpdateManyCount: 1,
  calls: [] as Array<{ op: string; args?: Record<string, unknown> }>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

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

describe("account ledger routes", () => {
  beforeEach(() => {
    h.account = { id: "acc1", userId: "user1", cashBalance: 10 };
    h.cashTx = null;
    h.holdingTx = null;
    h.accountUpdateManyCount = 1;
    h.cashTransactionUpdateManyCount = 1;
    h.holdingTransactionUpdateManyCount = 1;
    h.holdingTransactionDeleteManyCount = 1;
    h.holdingUpdateManyCount = 1;
    h.calls = [];
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
      cashBalance: { increment: 100 },
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

  it("rejects account currency changes without writing", async () => {
    const { PATCH } = await import("@/app/api/accounts/[id]/route");

    const response = await PATCH(jsonRequest("PATCH", { currency: "USD" }), {
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
      cashBalance: { increment: 50 },
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
});
