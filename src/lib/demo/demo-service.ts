import "server-only";

import {
  demoHashesMatch,
  hashDemoCreator,
  hashDemoVisitor,
  verifyDemoLoginTicket,
} from "@/lib/demo/demo-crypto";
import { PublicDemoError } from "@/lib/demo/demo-errors";
import { getPreparedDemoFixture } from "@/lib/demo/demo-fixture-source";
import { deleteDemoDomainRows, persistDemoFixture } from "@/lib/demo/demo-fixture-service";
import { recordDemoMetric } from "@/lib/demo/demo-metrics";
import { consumeDemoMutationQuota, type DemoQuotaResult } from "@/lib/demo/demo-quota-service";
import {
  DEMO_CAPACITY_LOCK_KEY,
  DEMO_CLEANUP_BATCH_SIZE,
  DEMO_CLEANUP_BUDGET_MS,
  DEMO_CLEANUP_MAX_USERS,
  DEMO_GLOBAL_LIMIT,
  DEMO_LIFETIME_MS,
  DEMO_SOURCE_LIMIT,
} from "@/lib/demo/demo-policy";
import { AUTH_SECRET, isPublicDemoEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type EnsureDemoWorkspaceInput = {
  visitorToken: string;
  clientIp: string;
  locale: "en-US" | "zh-TW";
  now: Date;
};

export type DemoWorkspaceIdentity = {
  userId: string;
  visitorHash: string;
  expiresAt: Date;
  resumed: boolean;
};

async function createDemoWorkspaceUnderLock(
  input: EnsureDemoWorkspaceInput & { visitorHash: string; creatorHash: string },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT true AS "locked"
      FROM (SELECT pg_advisory_xact_lock(${DEMO_CAPACITY_LOCK_KEY})) AS capacity_lock
    `;
    const existing = await tx.demoWorkspace.findUnique({
      where: { visitorHash: input.visitorHash },
    });
    if (existing && input.now < existing.expiresAt) {
      return {
        identity: {
          userId: existing.userId,
          visitorHash: existing.visitorHash,
          expiresAt: existing.expiresAt,
          resumed: true,
        },
        rowCount: 0,
        activeCount: undefined,
        fixtureDurationMs: 0,
        persistenceDurationMs: 0,
      };
    }
    if (existing) {
      await tx.user.deleteMany({ where: { id: existing.userId } });
    }

    const source = await tx.demoWorkspace.findMany({
      where: { creatorHash: input.creatorHash, expiresAt: { gt: input.now } },
      orderBy: { expiresAt: "asc" },
      take: DEMO_SOURCE_LIMIT,
      select: { expiresAt: true },
    });
    if (source.length >= DEMO_SOURCE_LIMIT) {
      throw new PublicDemoError(
        "DEMO_SOURCE_LIMIT",
        429,
        "Public Demo source limit reached",
        Math.max(1, Math.ceil((source[0].expiresAt.getTime() - input.now.getTime()) / 1000)),
      );
    }

    const activeCount = await tx.demoWorkspace.count({
      where: { expiresAt: { gt: input.now } },
    });
    if (activeCount >= DEMO_GLOBAL_LIMIT) {
      throw new PublicDemoError("DEMO_AT_CAPACITY", 503, "Public Demo is currently at capacity");
    }

    const user = await tx.user.create({ data: { name: "Demo visitor" } });
    const createdAt = input.now;
    const expiresAt = new Date(createdAt.getTime() + DEMO_LIFETIME_MS);
    await tx.demoWorkspace.create({
      data: {
        userId: user.id,
        visitorHash: input.visitorHash,
        creatorHash: input.creatorHash,
        createdAt,
        expiresAt,
      },
    });
    const fixtureStartedAt = Date.now();
    const fixture = getPreparedDemoFixture({
      userId: user.id,
      locale: input.locale,
      now: input.now,
    });
    const fixtureDurationMs = Date.now() - fixtureStartedAt;
    const persistenceStartedAt = Date.now();
    await persistDemoFixture(tx, fixture);
    return {
      identity: {
        userId: user.id,
        visitorHash: input.visitorHash,
        expiresAt,
        resumed: false,
      },
      rowCount: fixture.rowCount,
      activeCount: activeCount + 1,
      fixtureDurationMs,
      persistenceDurationMs: Date.now() - persistenceStartedAt,
    };
  });
}

export async function ensureDemoWorkspace(
  input: EnsureDemoWorkspaceInput,
): Promise<DemoWorkspaceIdentity> {
  if (!isPublicDemoEnabled) {
    throw new PublicDemoError("DEMO_DISABLED", 503, "Public Demo is disabled");
  }
  const visitorHash = hashDemoVisitor(input.visitorToken, AUTH_SECRET);
  const creatorHash = hashDemoCreator(input.clientIp, AUTH_SECRET);

  const startedAt = Date.now();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const committed = await createDemoWorkspaceUnderLock({
        ...input,
        visitorHash,
        creatorHash,
      });
      recordDemoMetric(committed.identity.resumed ? "resumed" : "created", {
        durationMs: Date.now() - startedAt,
        rows: committed.rowCount,
        count: committed.activeCount,
        fixtureDurationMs: committed.fixtureDurationMs,
        persistenceDurationMs: committed.persistenceDurationMs,
      });
      return committed.identity;
    } catch (error) {
      if (error instanceof PublicDemoError && error.code === "DEMO_AT_CAPACITY" && attempt === 0) {
        await cleanupExpiredDemoUsers({ now: input.now }).catch(() => {
          recordDemoMetric("cleanup_failed");
          return { deleted: 0, budgetExhausted: false };
        });
        continue;
      }
      if (error instanceof PublicDemoError) {
        if (error.code === "DEMO_SOURCE_LIMIT") recordDemoMetric("source_limited");
        if (error.code === "DEMO_AT_CAPACITY") recordDemoMetric("capacity_limited");
        throw error;
      }
      recordDemoMetric("initialization_failed", {
        durationMs: Date.now() - startedAt,
      });
      throw new PublicDemoError(
        "DEMO_INITIALIZATION_FAILED",
        500,
        "Failed to initialize public Demo",
      );
    }
  }
  throw new PublicDemoError("DEMO_AT_CAPACITY", 503, "Public Demo is currently at capacity");
}

export async function authenticateDemoTicket(input: {
  ticket: string;
  visitorToken: string;
  now: Date;
}) {
  if (!isPublicDemoEnabled) return null;
  const payload = verifyDemoLoginTicket(input.ticket, AUTH_SECRET, input.now);
  if (!payload) return null;
  const visitorHash = hashDemoVisitor(input.visitorToken, AUTH_SECRET);
  if (!demoHashesMatch(payload.visitorHash, visitorHash)) return null;
  const workspace = await prisma.demoWorkspace.findUnique({
    where: { userId: payload.userId },
    select: { userId: true, visitorHash: true, expiresAt: true },
  });
  if (!workspace || !demoHashesMatch(workspace.visitorHash, visitorHash)) return null;
  if (input.now >= workspace.expiresAt) return null;
  return {
    id: workspace.userId,
    name: "Demo visitor",
    email: null,
    image: null,
    isDemo: true as const,
    demoExpiresAt: workspace.expiresAt.toISOString(),
  };
}

export async function cleanupExpiredDemoUsers(options: {
  now: Date;
  batchSize?: number;
  maxUsers?: number;
  budgetMs?: number;
}) {
  const batchSize = options.batchSize ?? DEMO_CLEANUP_BATCH_SIZE;
  const maxUsers = options.maxUsers ?? DEMO_CLEANUP_MAX_USERS;
  const budgetMs = options.budgetMs ?? DEMO_CLEANUP_BUDGET_MS;
  const startedAt = Date.now();
  let deleted = 0;
  while (deleted < maxUsers && Date.now() - startedAt < budgetMs) {
    const expired = await prisma.demoWorkspace.findMany({
      where: { expiresAt: { lte: options.now } },
      orderBy: { expiresAt: "asc" },
      take: Math.min(batchSize, maxUsers - deleted),
      select: { userId: true },
    });
    if (expired.length === 0) break;
    const result = await prisma.user.deleteMany({
      where: { id: { in: expired.map((workspace) => workspace.userId) } },
    });
    deleted += result.count;
    if (result.count === 0) break;
    if (expired.length < batchSize) break;
  }
  if (deleted > 0) recordDemoMetric("deleted", { count: deleted });
  return { deleted, budgetExhausted: Date.now() - startedAt >= budgetMs };
}

export async function deleteExpiredDemoUser(userId: string, now: Date) {
  try {
    const result = await prisma.user.deleteMany({
      where: {
        id: userId,
        demoWorkspace: { expiresAt: { lte: now } },
      },
    });
    return { deleted: result.count, failed: false };
  } catch {
    recordDemoMetric("cleanup_failed");
    return { deleted: 0, failed: true };
  }
}

export function demoQuotaError(result: Exclude<DemoQuotaResult, { ok: true }>) {
  if (result.reason === "expired" || result.reason === "missing") {
    return new PublicDemoError("DEMO_EXPIRED", 410, "Public Demo expired");
  }
  if (result.reason === "rate" || result.reason === "conflict") {
    return new PublicDemoError(
      "DEMO_RATE_LIMITED",
      429,
      "Public Demo rate limit reached",
      result.retryAfterSeconds ?? 1,
    );
  }
  return new PublicDemoError("DEMO_QUOTA_EXHAUSTED", 403, "Public Demo quota exhausted");
}

export async function resetDemoWorkspace(input: {
  userId: string;
  locale: "en-US" | "zh-TW";
  now: Date;
}) {
  const startedAt = Date.now();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const quota = await consumeDemoMutationQuota(tx, input.userId, input.now, { reset: true });
      if (!quota.ok) throw demoQuotaError(quota);
      await deleteDemoDomainRows(tx, input.userId);
      const fixture = getPreparedDemoFixture({
        userId: input.userId,
        locale: input.locale,
        now: input.now,
      });
      await persistDemoFixture(tx, fixture);
      return { rowCount: fixture.rowCount };
    });
    recordDemoMetric("reset", {
      durationMs: Date.now() - startedAt,
      rows: result.rowCount,
    });
    return result;
  } catch (error) {
    if (error instanceof PublicDemoError) throw error;
    recordDemoMetric("reset_failed", { durationMs: Date.now() - startedAt });
    throw new PublicDemoError("DEMO_RESET_FAILED", 500, "Failed to reset public Demo");
  }
}
