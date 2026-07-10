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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: vi.fn(async () => h.account),
    },
    goal: {
      aggregate: vi.fn(async () => ({ _max: { sortOrder: null } })),
      create: vi.fn(async () => h.goal),
      findUnique: vi.fn(async () => h.goal),
      update: vi.fn(async () => h.goal),
    },
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
});
