import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  account: null as { id: string } | null,
  goal: {
    id: "goal1",
    userId: "user1",
    name: "Brokerage target",
    targetAmount: 1000,
    targetCurrency: "USD",
    targetDate: null,
    scope: "ACCOUNT",
    scopeRefId: "acc1",
    sortOrder: 0,
  },
  principal: { kind: "formal" as const, userId: "user1" } as
    | { kind: "formal"; userId: string }
    | { kind: "demo"; userId: string; expiresAt: Date },
  goalIds: ["goal1", "goal2"],
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: h.revalidateTag,
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (
      handler: (
        req: Request,
        ctx: unknown,
        userId: string,
        principal: typeof h.principal,
      ) => Promise<Response>,
    ) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1", h.principal),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: vi.fn(async () => h.account),
    },
    goal: {
      aggregate: vi.fn(async () => ({ _max: { sortOrder: null } })),
      create: vi.fn(async () => h.goal),
      findUnique: vi.fn(async () => h.goal),
      findMany: vi.fn(async () => h.goalIds.map((id) => ({ id }))),
      update: vi.fn(async () => h.goal),
    },
    netWorthSnapshot: {
      findUnique: vi.fn(async () => ({ userId: "user1" })),
      update: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  },
}));

const jsonRequest = (body: Record<string, unknown>, method = "POST") =>
  new Request("http://unit.test/api/goals", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("goals route account scope validation", () => {
  beforeEach(() => {
    h.account = null;
    h.principal = { kind: "formal", userId: "user1" };
    h.goalIds = ["goal1", "goal2"];
    vi.clearAllMocks();
  });

  it("rejects creating an account-scoped goal for an unowned account", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { POST } = await import("@/app/api/goals/route");

    const response = await POST(
      jsonRequest({
        name: "Brokerage target",
        targetAmount: 1000,
        targetCurrency: "USD",
        scope: "ACCOUNT",
        scopeRefId: "acc1",
      }),
      undefined,
    );

    expect(response.status).toBe(400);
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("rejects updating a goal to reference an unowned account", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { PATCH } = await import("@/app/api/goals/[id]/route");

    const response = await PATCH(jsonRequest({ scope: "ACCOUNT", scopeRefId: "acc1" }, "PATCH"), {
      params: Promise.resolve({ id: "goal1" }),
    });

    expect(response.status).toBe(400);
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Demo",
      { kind: "demo" as const, userId: "user1", expiresAt: new Date("2026-08-02T00:00:00.000Z") },
      ["goals:user1"],
    ],
    ["formal", { kind: "formal" as const, userId: "user1" }, ["goals", "goals:user1"]],
  ])("scopes goal reorder invalidation for %s", async (_label, principal, expectedTags) => {
    h.principal = principal;
    const { PATCH } = await import("@/app/api/goals/reorder/route");

    const response = await PATCH(
      jsonRequest({ orderedIds: ["goal2", "goal1"] }, "PATCH"),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(h.revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(expectedTags);
  });

  it.each([
    [
      "Demo",
      { kind: "demo" as const, userId: "user1", expiresAt: new Date("2026-08-02T00:00:00.000Z") },
      ["history:user1"],
    ],
    ["formal", { kind: "formal" as const, userId: "user1" }, ["snapshots", "history:user1"]],
  ])("scopes snapshot annotation invalidation for %s", async (_label, principal, expectedTags) => {
    h.principal = principal;
    const { PATCH } = await import("@/app/api/snapshots/[id]/route");

    const response = await PATCH(jsonRequest({ note: "updated" }, "PATCH"), {
      params: Promise.resolve({ id: "snapshot1" }),
    });

    expect(response.status).toBe(200);
    expect(h.revalidateTag.mock.calls.map(([tag]) => tag)).toEqual(expectedTags);
  });
});
