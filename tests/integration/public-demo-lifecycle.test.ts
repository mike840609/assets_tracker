import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createDemoLoginTicket, hashDemoVisitor } from "@/lib/demo/demo-crypto";
import {
  DEMO_CAPACITY_LOCK_KEY,
  DEMO_LIFETIME_MS,
  DEMO_REFRESH_WINDOW_MS,
} from "@/lib/demo/demo-policy";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required for public Demo integration tests");

const parsedDatabaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname) ||
  !parsedDatabaseUrl.pathname.endsWith("_asset_tracker_test")
) {
  throw new Error("Integration tests require a local *_asset_tracker_test database");
}

process.env.AUTH_SECRET ??= "public-demo-integration-secret-0000000000";
process.env.CRON_SECRET ??= "public-demo-integration-cron-secret";
process.env.PUBLIC_DEMO_ENABLED = "true";

const servicePool = new pg.Pool({ connectionString: DATABASE_URL, max: 12 });
const setupPool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
const servicePrisma = new PrismaClient({
  adapter: new PrismaPg(servicePool),
  log: [{ emit: "event", level: "query" }],
});
const statements: string[] = [];
servicePrisma.$on("query", (event) => statements.push(event.query));
const prisma = new PrismaClient({ adapter: new PrismaPg(setupPool) });

const fixtureTables = new Set([
  "Setting",
  "Account",
  "Holding",
  "HoldingTransaction",
  "CashTransaction",
  "RecurringCashTransaction",
  "RecurringInvestment",
  "NetWorthSnapshot",
  "Goal",
  "StockWatchItem",
  "CalendarEntry",
  "PriceCache",
  "ExchangeRate",
]);

const fixtureStatementGroups = () =>
  statements.filter((query) =>
    fixtureTables.has(/^\s*INSERT INTO\s+(?:"public"\.)?"([^"]+)"/i.exec(query)?.[1] ?? ""),
  ).length;

let ensureDemoWorkspace: typeof import("@/lib/demo/demo-service").ensureDemoWorkspace;
let authenticateDemoTicket: typeof import("@/lib/demo/demo-service").authenticateDemoTicket;
let cleanupExpiredDemoUsers: typeof import("@/lib/demo/demo-service").cleanupExpiredDemoUsers;
let deleteExpiredDemoUser: typeof import("@/lib/demo/demo-service").deleteExpiredDemoUser;
let resetDemoWorkspace: typeof import("@/lib/demo/demo-service").resetDemoWorkspace;
let consumeDemoMutationQuota: typeof import("@/lib/demo/demo-quota-service").consumeDemoMutationQuota;
let consumeDemoRefreshQuota: typeof import("@/lib/demo/demo-quota-service").consumeDemoRefreshQuota;

const now = new Date("2026-08-01T04:00:00.000Z");

async function installRejectAccountTrigger() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public_demo_reject_account_insert()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'public demo forced rollback';
    END;
    $$ LANGUAGE plpgsql
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER public_demo_reject_account
    BEFORE INSERT ON "Account"
    FOR EACH ROW EXECUTE FUNCTION public_demo_reject_account_insert()
  `);
}

async function dropRejectAccountTrigger() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS public_demo_reject_account ON "Account"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public_demo_reject_account_insert()`);
}

async function createCompactWorkspaces(options: {
  count: number;
  expiresAt: Date;
  creatorPrefix: string;
  visitorPrefix: string;
}) {
  const rows = Array.from({ length: options.count }, (_, index) => ({
    userId: randomUUID(),
    creatorHash: `${options.creatorPrefix}-${index}`,
    visitorHash: `${options.visitorPrefix}-${index}`,
    expiresAt: options.expiresAt,
  }));
  await prisma.user.createMany({
    data: rows.map(({ userId }) => ({ id: userId, name: "Demo visitor" })),
  });
  await prisma.demoWorkspace.createMany({ data: rows });
  return rows;
}

async function deleteTaskUsers() {
  await prisma.user.deleteMany({
    where: {
      OR: [{ demoWorkspace: { isNot: null } }, { name: { startsWith: "Task 4" } }],
    },
  });
}

async function waitForResumeDecisionOrAdvisoryWait(isSettled: () => boolean) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (isSettled()) return;
    const [row] = await prisma.$queryRaw<[{ waiting: boolean }]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_locks
        WHERE locktype = 'advisory'
          AND objid = ${DEMO_CAPACITY_LOCK_KEY}
          AND NOT granted
      ) AS "waiting"
    `;
    if (row.waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Resume neither resolved nor waited for the advisory lock");
}

beforeAll(async () => {
  (globalThis as { prisma?: unknown }).prisma = servicePrisma;
  ({
    ensureDemoWorkspace,
    authenticateDemoTicket,
    cleanupExpiredDemoUsers,
    deleteExpiredDemoUser,
    resetDemoWorkspace,
  } = await import("@/lib/demo/demo-service"));
  ({ consumeDemoMutationQuota, consumeDemoRefreshQuota } =
    await import("@/lib/demo/demo-quota-service"));
});

beforeEach(async () => {
  await dropRejectAccountTrigger();
  await deleteTaskUsers();
});

afterEach(async () => {
  await dropRejectAccountTrigger();
  await deleteTaskUsers();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await dropRejectAccountTrigger();
  await deleteTaskUsers();
  await servicePrisma.$disconnect();
  await prisma.$disconnect();
  await servicePool.end();
  await setupPool.end();
  delete (globalThis as { prisma?: unknown }).prisma;
});

describe("public Demo lifecycle", () => {
  it("creates and resets the fixture within statement and network budgets", async () => {
    statements.length = 0;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Public Demo fixture attempted a network request"));

    const workspace = await ensureDemoWorkspace({
      visitorToken: "statement-budget-visitor",
      clientIp: "198.51.100.1",
      locale: "en-US",
      now,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    const createGroups = fixtureStatementGroups();
    expect(createGroups).toBeLessThanOrEqual(15);

    statements.length = 0;
    await resetDemoWorkspace({
      userId: workspace.userId,
      locale: "zh-TW",
      now: new Date(now.getTime() + 1_000),
    });
    const resetGroups = fixtureStatementGroups();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resetGroups).toBeLessThanOrEqual(15);
    process.stdout.write(
      `[public-demo-budget] create-statement-groups=${createGroups} reset-statement-groups=${resetGroups} external-fetches=0\n`,
    );
  });

  it("creates ten distinct visitor workspaces concurrently and reports p95", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Public Demo fixture attempted a network request"));
    await ensureDemoWorkspace({
      visitorToken: "performance-warmup-visitor",
      clientIp: "198.51.100.10",
      locale: "en-US",
      now,
    });

    const samples = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const startedAt = performance.now();
        const workspace = await ensureDemoWorkspace({
          visitorToken: `performance-visitor-${index}`,
          clientIp: `198.51.100.${100 + index}`,
          locale: index % 2 === 0 ? "en-US" : "zh-TW",
          now,
        });
        return { durationMs: performance.now() - startedAt, resumed: workspace.resumed };
      }),
    );
    const durations = samples.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    process.stdout.write(
      `[public-demo-performance] concurrent-create p95=${p95.toFixed(0)}ms samples=${durations.length}\n`,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(samples.every(({ resumed }) => !resumed)).toBe(true);
    expect(await prisma.demoWorkspace.count()).toBe(11);
  });

  it("gives two visitors different users and data ownership", async () => {
    const first = await ensureDemoWorkspace({
      visitorToken: "visitor-a",
      clientIp: "198.51.100.10",
      locale: "en-US",
      now,
    });
    const second = await ensureDemoWorkspace({
      visitorToken: "visitor-b",
      clientIp: "198.51.100.10",
      locale: "en-US",
      now,
    });

    expect(first.userId).not.toBe(second.userId);
    expect(await prisma.account.count({ where: { userId: first.userId } })).toBeGreaterThan(0);
    const secondAccountIds = (
      await prisma.account.findMany({
        where: { userId: second.userId },
        select: { id: true },
      })
    ).map((account) => account.id);
    expect(
      await prisma.account.count({
        where: { userId: first.userId, id: { in: secondAccountIds } },
      }),
    ).toBe(0);
  });

  it("deduplicates concurrent starts for one visitor", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        ensureDemoWorkspace({
          visitorToken: "one-token",
          clientIp: "198.51.100.20",
          locale: "zh-TW",
          now,
        }),
      ),
    );

    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(await prisma.demoWorkspace.count()).toBe(1);
  });

  it("rolls back the user and every child row when fixture persistence fails", async () => {
    await installRejectAccountTrigger();
    await expect(
      ensureDemoWorkspace({
        visitorToken: "rollback-token",
        clientIp: "198.51.100.30",
        locale: "en-US",
        now,
      }),
    ).rejects.toMatchObject({ code: "DEMO_INITIALIZATION_FAILED" });

    expect(await prisma.demoWorkspace.count()).toBe(0);
    expect(await prisma.user.count({ where: { name: "Demo visitor" } })).toBe(0);
  });

  it("allows exactly five active workspaces per creator", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        ensureDemoWorkspace({
          visitorToken: `source-visitor-${index}`,
          clientIp: "198.51.100.40",
          locale: "en-US",
          now,
        }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { code: "DEMO_SOURCE_LIMIT", status: 429 },
    });
    expect(await prisma.demoWorkspace.count()).toBe(5);
  });

  it("enforces the global capacity of 250 workspaces", async () => {
    await createCompactWorkspaces({
      count: 249,
      expiresAt: new Date(now.getTime() + 60_000),
      creatorPrefix: "capacity-creator",
      visitorPrefix: "capacity-visitor",
    });

    const results = await Promise.allSettled([
      ensureDemoWorkspace({
        visitorToken: "capacity-racer-a",
        clientIp: "198.51.100.50",
        locale: "en-US",
        now,
      }),
      ensureDemoWorkspace({
        visitorToken: "capacity-racer-b",
        clientIp: "198.51.100.51",
        locale: "en-US",
        now,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { code: "DEMO_AT_CAPACITY", status: 503 },
    });
    expect(await prisma.demoWorkspace.count()).toBe(250);
  });

  it("resumes a visitor without changing expiry while at capacity", async () => {
    const first = await ensureDemoWorkspace({
      visitorToken: "capacity-resume",
      clientIp: "198.51.100.60",
      locale: "en-US",
      now,
    });
    await createCompactWorkspaces({
      count: 249,
      expiresAt: new Date(now.getTime() + 60_000),
      creatorPrefix: "resume-creator",
      visitorPrefix: "resume-visitor",
    });

    const resumed = await ensureDemoWorkspace({
      visitorToken: "capacity-resume",
      clientIp: "198.51.100.60",
      locale: "zh-TW",
      now: new Date(now.getTime() + 30_000),
    });

    expect(resumed).toMatchObject({ userId: first.userId, resumed: true });
    expect(resumed.expiresAt).toEqual(first.expiresAt);
    expect(await prisma.demoWorkspace.count()).toBe(250);
  });

  it("rechecks resume under the advisory lock before returning an identity", async () => {
    const visitorToken = "locked-resume-visitor";
    const visitorHash = hashDemoVisitor(visitorToken, process.env.AUTH_SECRET!);
    const oldUserId = randomUUID();
    const oldExpiresAt = new Date(now.getTime() + 60_000);
    await prisma.user.create({ data: { id: oldUserId, name: "Demo visitor" } });
    await prisma.demoWorkspace.create({
      data: {
        userId: oldUserId,
        visitorHash,
        creatorHash: "locked-resume-creator",
        expiresAt: oldExpiresAt,
      },
    });

    let releaseReplacement!: () => void;
    const replacementRelease = new Promise<void>((resolve) => {
      releaseReplacement = resolve;
    });
    let signalReplacementReady!: (userId: string) => void;
    const replacementReady = new Promise<string>((resolve) => {
      signalReplacementReady = resolve;
    });
    const replacement = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT true AS "locked"
        FROM (SELECT pg_advisory_xact_lock(${DEMO_CAPACITY_LOCK_KEY})) AS capacity_lock
      `;
      await tx.user.delete({ where: { id: oldUserId } });
      const replacementUser = await tx.user.create({ data: { name: "Demo visitor" } });
      await tx.demoWorkspace.create({
        data: {
          userId: replacementUser.id,
          visitorHash,
          creatorHash: "locked-resume-creator",
          expiresAt: oldExpiresAt,
        },
      });
      signalReplacementReady(replacementUser.id);
      await replacementRelease;
    });
    const replacementUserId = await replacementReady;

    const resume = ensureDemoWorkspace({
      visitorToken,
      clientIp: "198.51.100.61",
      locale: "en-US",
      now,
    });
    let resumeSettled = false;
    void resume.then(
      () => {
        resumeSettled = true;
      },
      () => {
        resumeSettled = true;
      },
    );
    try {
      await waitForResumeDecisionOrAdvisoryWait(() => resumeSettled);
    } finally {
      releaseReplacement();
    }
    await replacement;

    expect(await resume).toMatchObject({ userId: replacementUserId, resumed: true });
  });

  it("persists expiry exactly one Demo lifetime after workspace creation", async () => {
    const identity = await ensureDemoWorkspace({
      visitorToken: "exact-lifetime-visitor",
      clientIp: "198.51.100.62",
      locale: "en-US",
      now,
    });
    const workspace = await prisma.demoWorkspace.findUniqueOrThrow({
      where: { userId: identity.userId },
      select: { createdAt: true, expiresAt: true },
    });

    expect(workspace.expiresAt.getTime() - workspace.createdAt.getTime()).toBe(DEMO_LIFETIME_MS);
  });

  it("allows exactly 30 of 31 concurrent mutations in one minute", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "mutation-window-visitor",
      clientIp: "198.51.100.63",
      locale: "en-US",
      now,
    });

    const results = await Promise.all(
      Array.from({ length: 31 }, () =>
        consumeDemoMutationQuota(servicePrisma, workspace.userId, now, { reset: false }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(30);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "rate", retryAfterSeconds: 60 },
    ]);
    await expect(
      prisma.demoWorkspace.findUniqueOrThrow({
        where: { userId: workspace.userId },
        select: { mutationCount: true, mutationWindowCount: true },
      }),
    ).resolves.toEqual({ mutationCount: 30, mutationWindowCount: 30 });
  });

  it("allows exactly one of two concurrent mutations at lifetime count 249", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "mutation-lifetime-visitor",
      clientIp: "198.51.100.64",
      locale: "en-US",
      now,
    });
    await prisma.demoWorkspace.update({
      where: { userId: workspace.userId },
      data: { mutationCount: 249 },
    });

    const results = await Promise.all([
      consumeDemoMutationQuota(servicePrisma, workspace.userId, now, { reset: false }),
      consumeDemoMutationQuota(servicePrisma, workspace.userId, now, { reset: false }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "lifetime" }]);
    await expect(
      prisma.demoWorkspace.findUniqueOrThrow({
        where: { userId: workspace.userId },
        select: { mutationCount: true },
      }),
    ).resolves.toEqual({ mutationCount: 250 });
  });

  it("anchors three refreshes to the first request and renews exactly at ten minutes", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "refresh-window-visitor",
      clientIp: "198.51.100.65",
      locale: "en-US",
      now,
    });

    const successful = [
      await consumeDemoRefreshQuota(servicePrisma, workspace.userId, now),
      await consumeDemoRefreshQuota(
        servicePrisma,
        workspace.userId,
        new Date(now.getTime() + 60_000),
      ),
      await consumeDemoRefreshQuota(
        servicePrisma,
        workspace.userId,
        new Date(now.getTime() + 120_000),
      ),
    ];
    const limitedAt = new Date(now.getTime() + 5 * 60_000);
    const limited = await consumeDemoRefreshQuota(servicePrisma, workspace.userId, limitedAt);
    const boundary = new Date(now.getTime() + DEMO_REFRESH_WINDOW_MS);
    const renewed = await consumeDemoRefreshQuota(servicePrisma, workspace.userId, boundary);

    expect(successful).toEqual(Array.from({ length: 3 }, () => ({ ok: true })));
    expect(limited).toEqual({ ok: false, reason: "rate", retryAfterSeconds: 300 });
    expect(renewed).toEqual({ ok: true });
    await expect(
      prisma.demoWorkspace.findUniqueOrThrow({
        where: { userId: workspace.userId },
        select: { refreshWindowStartedAt: true, refreshCount: true },
      }),
    ).resolves.toEqual({ refreshWindowStartedAt: boundary, refreshCount: 1 });
  });

  it("allows three atomic resets, preserves expiry and mutation usage, then exhausts resets", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "reset-limit-visitor",
      clientIp: "198.51.100.66",
      locale: "en-US",
      now,
    });

    await expect(
      Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          resetDemoWorkspace({
            userId: workspace.userId,
            locale: index % 2 === 0 ? "zh-TW" : "en-US",
            now: new Date(now.getTime() + index),
          }),
        ),
      ),
    ).resolves.toEqual(
      expect.arrayContaining(Array.from({ length: 3 }, () => ({ rowCount: expect.any(Number) }))),
    );
    await expect(
      resetDemoWorkspace({
        userId: workspace.userId,
        locale: "en-US",
        now: new Date(now.getTime() + 3),
      }),
    ).rejects.toMatchObject({ code: "DEMO_QUOTA_EXHAUSTED", status: 403 });

    await expect(
      prisma.demoWorkspace.findUniqueOrThrow({
        where: { userId: workspace.userId },
        select: { expiresAt: true, mutationCount: true, resetCount: true },
      }),
    ).resolves.toEqual({ expiresAt: workspace.expiresAt, mutationCount: 3, resetCount: 3 });
  });

  it("rolls back reset deletion and every counter when fixture insertion fails", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "reset-rollback-visitor",
      clientIp: "198.51.100.67",
      locale: "en-US",
      now,
    });
    const accountIds = (
      await prisma.account.findMany({
        where: { userId: workspace.userId },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const countersBefore = await prisma.demoWorkspace.findUniqueOrThrow({
      where: { userId: workspace.userId },
      select: {
        expiresAt: true,
        mutationCount: true,
        mutationWindowStartedAt: true,
        mutationWindowCount: true,
        resetCount: true,
        refreshWindowStartedAt: true,
        refreshCount: true,
      },
    });
    await installRejectAccountTrigger();

    await expect(
      resetDemoWorkspace({ userId: workspace.userId, locale: "zh-TW", now }),
    ).rejects.toMatchObject({ code: "DEMO_RESET_FAILED", status: 500 });

    expect(
      (
        await prisma.account.findMany({
          where: { userId: workspace.userId },
          orderBy: { id: "asc" },
          select: { id: true },
        })
      ).map(({ id }) => id),
    ).toEqual(accountIds);
    await expect(
      prisma.demoWorkspace.findUniqueOrThrow({
        where: { userId: workspace.userId },
        select: {
          expiresAt: true,
          mutationCount: true,
          mutationWindowStartedAt: true,
          mutationWindowCount: true,
          resetCount: true,
          refreshWindowStartedAt: true,
          refreshCount: true,
        },
      }),
    ).resolves.toEqual(countersBefore);
  });

  it("deletes expired workspaces in bounded batches of 25", async () => {
    await createCompactWorkspaces({
      count: 60,
      expiresAt: now,
      creatorPrefix: "expired-creator",
      visitorPrefix: "expired-visitor",
    });
    const [active] = await createCompactWorkspaces({
      count: 1,
      expiresAt: new Date(now.getTime() + 1),
      creatorPrefix: "active-creator",
      visitorPrefix: "active-visitor",
    });

    expect(
      await cleanupExpiredDemoUsers({ now, batchSize: 25, maxUsers: 50, budgetMs: 0 }),
    ).toEqual({ deleted: 0, budgetExhausted: true });
    expect(await prisma.demoWorkspace.count({ where: { expiresAt: { lte: now } } })).toBe(60);

    const first = await cleanupExpiredDemoUsers({
      now,
      batchSize: 25,
      maxUsers: 50,
      budgetMs: 30_000,
    });

    expect(first).toEqual({ deleted: 50, budgetExhausted: false });
    expect(await prisma.demoWorkspace.count({ where: { expiresAt: { lte: now } } })).toBe(10);
    expect(await prisma.user.findUnique({ where: { id: active.userId } })).not.toBeNull();

    expect(
      await cleanupExpiredDemoUsers({ now, batchSize: 25, maxUsers: 50, budgetMs: 30_000 }),
    ).toEqual({ deleted: 10, budgetExhausted: false });
  });

  it("cascade deletes every user-owned model for an expired Demo user", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "cascade-visitor",
      clientIp: "198.51.100.70",
      locale: "en-US",
      now,
    });
    await prisma.authAccount.create({
      data: {
        userId: workspace.userId,
        type: "oauth",
        provider: "task4",
        providerAccountId: randomUUID(),
      },
    });
    await prisma.session.create({
      data: {
        userId: workspace.userId,
        sessionToken: randomUUID(),
        expires: new Date(now.getTime() + 60_000),
      },
    });
    await prisma.calendarEntry.create({
      data: {
        userId: workspace.userId,
        title: "Task 4 cascade relation",
        eventDate: now,
        category: "REMINDER",
      },
    });
    const accounts = await prisma.account.findMany({
      where: { userId: workspace.userId },
      select: { id: true },
    });
    const accountIds = accounts.map(({ id }) => id);
    const holdings = await prisma.holding.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true },
    });
    const holdingIds = holdings.map(({ id }) => id);

    const ownedCountsBefore = await Promise.all([
      prisma.setting.count({ where: { userId: workspace.userId } }),
      prisma.account.count({ where: { userId: workspace.userId } }),
      prisma.holding.count({ where: { accountId: { in: accountIds } } }),
      prisma.holdingTransaction.count({ where: { holdingId: { in: holdingIds } } }),
      prisma.cashTransaction.count({ where: { accountId: { in: accountIds } } }),
      prisma.recurringCashTransaction.count({ where: { accountId: { in: accountIds } } }),
      prisma.recurringInvestment.count({ where: { accountId: { in: accountIds } } }),
      prisma.netWorthSnapshot.count({ where: { userId: workspace.userId } }),
      prisma.goal.count({ where: { userId: workspace.userId } }),
      prisma.stockWatchItem.count({ where: { userId: workspace.userId } }),
      prisma.calendarEntry.count({ where: { userId: workspace.userId } }),
      prisma.authAccount.count({ where: { userId: workspace.userId } }),
      prisma.session.count({ where: { userId: workspace.userId } }),
      prisma.demoWorkspace.count({ where: { userId: workspace.userId } }),
    ]);
    expect(ownedCountsBefore.every((count) => count > 0)).toBe(true);

    await prisma.demoWorkspace.update({
      where: { userId: workspace.userId },
      data: { expiresAt: now },
    });
    expect(await deleteExpiredDemoUser(workspace.userId, now)).toMatchObject({ deleted: 1 });

    const ownedCountsAfter = await Promise.all([
      prisma.setting.count({ where: { userId: workspace.userId } }),
      prisma.account.count({ where: { userId: workspace.userId } }),
      prisma.holding.count({ where: { accountId: { in: accountIds } } }),
      prisma.holdingTransaction.count({ where: { holdingId: { in: holdingIds } } }),
      prisma.cashTransaction.count({ where: { accountId: { in: accountIds } } }),
      prisma.recurringCashTransaction.count({ where: { accountId: { in: accountIds } } }),
      prisma.recurringInvestment.count({ where: { accountId: { in: accountIds } } }),
      prisma.netWorthSnapshot.count({ where: { userId: workspace.userId } }),
      prisma.goal.count({ where: { userId: workspace.userId } }),
      prisma.stockWatchItem.count({ where: { userId: workspace.userId } }),
      prisma.calendarEntry.count({ where: { userId: workspace.userId } }),
      prisma.authAccount.count({ where: { userId: workspace.userId } }),
      prisma.session.count({ where: { userId: workspace.userId } }),
      prisma.demoWorkspace.count({ where: { userId: workspace.userId } }),
      prisma.user.count({ where: { id: workspace.userId } }),
    ]);
    expect(ownedCountsAfter).toEqual(Array.from({ length: 15 }, () => 0));
  });

  it("authenticates only a current ticket bound to the authoritative workspace", async () => {
    const workspace = await ensureDemoWorkspace({
      visitorToken: "ticket-visitor",
      clientIp: "198.51.100.80",
      locale: "en-US",
      now,
    });
    const ticket = createDemoLoginTicket(
      {
        version: 1,
        userId: workspace.userId,
        visitorHash: workspace.visitorHash,
        expiresAt: now.getTime(),
      },
      process.env.AUTH_SECRET!,
      now,
    );

    expect(await authenticateDemoTicket({ ticket, visitorToken: "wrong", now })).toBeNull();
    expect(
      await authenticateDemoTicket({ ticket, visitorToken: "ticket-visitor", now }),
    ).toMatchObject({
      id: workspace.userId,
      name: "Demo visitor",
      isDemo: true,
      demoExpiresAt: workspace.expiresAt.toISOString(),
    });

    await prisma.demoWorkspace.update({
      where: { userId: workspace.userId },
      data: { expiresAt: now },
    });
    expect(
      await authenticateDemoTicket({ ticket, visitorToken: "ticket-visitor", now }),
    ).toBeNull();
  });

  it("never deletes an active Demo user or a formal user", async () => {
    const active = await ensureDemoWorkspace({
      visitorToken: "active-delete-visitor",
      clientIp: "198.51.100.90",
      locale: "en-US",
      now,
    });
    const formal = await prisma.user.create({ data: { name: "Task 4 formal user" } });

    expect(await deleteExpiredDemoUser(active.userId, now)).toMatchObject({ deleted: 0 });
    expect(await deleteExpiredDemoUser(formal.id, now)).toMatchObject({ deleted: 0 });
    expect(await prisma.user.count({ where: { id: { in: [active.userId, formal.id] } } })).toBe(2);
  });
});
