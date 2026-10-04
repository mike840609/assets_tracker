import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("_asset_tracker_test")
) {
  throw new Error("Ledger integration tests require a local *_asset_tracker_test database");
}
const pool = new pg.Pool({ connectionString: url.href });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let userId: string;
let accountId: string;
let GET: typeof import("@/app/api/accounts/[id]/transactions/route").GET;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `ledger-${crypto.randomUUID()}@unit.test` },
  });
  userId = user.id;
  const account = await prisma.account.create({
    data: { userId, name: "Ledger", type: "ASSET", category: "BROKERAGE", currency: "USD" },
  });
  accountId = account.id;
  const holding = await prisma.holding.create({
    data: {
      accountId,
      symbol: "AAPL",
      name: "Apple",
      assetType: "STOCK",
      currency: "USD",
      quantity: 2,
    },
  });
  await prisma.holdingTransaction.createMany({
    data: [1, 2].map((day) => ({
      holdingId: holding.id,
      type: "BUY",
      quantity: 1,
      createdAt: new Date(`2026-10-0${day}T12:00:00Z`),
      occurrenceDate: new Date(`2026-09-0${day}T00:00:00Z`),
    })),
  });
  vi.doMock("@/lib/prisma", () => ({ prisma }));
  vi.doMock("@/lib/api-handler", () => ({
    withAuth:
      (handler: (request: Request, ctx: unknown, userId: string) => Promise<Response>) =>
      (request: Request, ctx: unknown) =>
        handler(request, ctx, userId),
  }));
  ({ GET } = await import("@/app/api/accounts/[id]/transactions/route"));
});
afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
  await pool.end();
  vi.doUnmock("@/lib/prisma");
  vi.doUnmock("@/lib/api-handler");
});
describe("ledger occurrence dates", () => {
  it("returns stored holding occurrence dates on both initial and cursor pages", async () => {
    const ctx = { params: Promise.resolve({ id: accountId }) };
    const first = await GET(
      new Request(`http://test/api/accounts/${accountId}/transactions?limit=1`),
      ctx,
    );
    expect(first.status).toBe(200);
    const initial = (await first.json()).data;
    expect(initial.transactions[0].occurrenceDate).toBe("2026-09-02T00:00:00.000Z");
    expect(initial.hasMore).toBe(true);
    const next = await GET(
      new Request(
        `http://test/api/accounts/${accountId}/transactions?limit=1&cursor=${initial.nextCursor}`,
      ),
      ctx,
    );
    expect(next.status).toBe(200);
    const page = (await next.json()).data;
    expect(page.transactions[0].occurrenceDate).toBe("2026-09-01T00:00:00.000Z");
    expect(page.hasMore).toBe(false);
  });
});
