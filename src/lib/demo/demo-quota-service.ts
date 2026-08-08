import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  DEMO_MUTATION_LIFETIME_LIMIT,
  DEMO_MUTATION_WINDOW_LIMIT,
  DEMO_MUTATION_WINDOW_MS,
  DEMO_REFRESH_LIMIT,
  DEMO_REFRESH_WINDOW_MS,
  DEMO_RESET_LIMIT,
} from "@/lib/demo/demo-policy";

type DemoQuotaDb = Pick<Prisma.TransactionClient, "$queryRaw">;
type QuotaReason = "missing" | "expired" | "lifetime" | "reset" | "rate" | "conflict";
export type DemoQuotaResult =
  | { ok: true }
  | { ok: false; reason: QuotaReason; retryAfterSeconds?: number };

type QuotaRow = { reason: QuotaReason | "ok"; retryAt: Date | null };

function resultFromRow(row: QuotaRow | undefined, now: Date): DemoQuotaResult {
  if (!row || row.reason === "conflict") return { ok: false, reason: "conflict" };
  if (row.reason === "ok") return { ok: true };
  return {
    ok: false,
    reason: row.reason,
    ...(row.reason === "rate" && row.retryAt
      ? {
          retryAfterSeconds: Math.max(1, Math.ceil((row.retryAt.getTime() - now.getTime()) / 1000)),
        }
      : {}),
  };
}

export async function consumeDemoMutationQuota(
  db: DemoQuotaDb,
  userId: string,
  now: Date,
  options: { reset: boolean },
): Promise<DemoQuotaResult> {
  const resetIncrement = options.reset ? 1 : 0;
  const rows = await db.$queryRaw<QuotaRow[]>`
    WITH current AS (
      SELECT * FROM "DemoWorkspace" WHERE "userId" = ${userId} FOR UPDATE
    ), updated AS (
      UPDATE "DemoWorkspace" AS workspace
      SET
        "mutationCount" = current."mutationCount" + 1,
        "mutationWindowStartedAt" = CASE
          WHEN current."mutationWindowStartedAt" IS NULL
            OR ${now} >= current."mutationWindowStartedAt" + (${DEMO_MUTATION_WINDOW_MS} * INTERVAL '1 millisecond')
          THEN ${now}
          ELSE current."mutationWindowStartedAt"
        END,
        "mutationWindowCount" = CASE
          WHEN current."mutationWindowStartedAt" IS NULL
            OR ${now} >= current."mutationWindowStartedAt" + (${DEMO_MUTATION_WINDOW_MS} * INTERVAL '1 millisecond')
          THEN 1
          ELSE current."mutationWindowCount" + 1
        END,
        "resetCount" = current."resetCount" + ${resetIncrement}
      FROM current
      WHERE workspace."userId" = current."userId"
        AND current."expiresAt" > ${now}
        AND current."mutationCount" < ${DEMO_MUTATION_LIFETIME_LIMIT}
        AND (${resetIncrement} = 0 OR current."resetCount" < ${DEMO_RESET_LIMIT})
        AND (
          current."mutationWindowStartedAt" IS NULL
          OR ${now} >= current."mutationWindowStartedAt" + (${DEMO_MUTATION_WINDOW_MS} * INTERVAL '1 millisecond')
          OR current."mutationWindowCount" < ${DEMO_MUTATION_WINDOW_LIMIT}
        )
      RETURNING workspace."userId"
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM current) THEN 'missing'
        WHEN (SELECT "expiresAt" FROM current) <= ${now} THEN 'expired'
        WHEN (SELECT "mutationCount" FROM current) >= ${DEMO_MUTATION_LIFETIME_LIMIT} THEN 'lifetime'
        WHEN ${resetIncrement} = 1 AND (SELECT "resetCount" FROM current) >= ${DEMO_RESET_LIMIT} THEN 'reset'
        WHEN (SELECT "mutationWindowStartedAt" FROM current) IS NOT NULL
          AND ${now} < (SELECT "mutationWindowStartedAt" FROM current) + (${DEMO_MUTATION_WINDOW_MS} * INTERVAL '1 millisecond')
          AND (SELECT "mutationWindowCount" FROM current) >= ${DEMO_MUTATION_WINDOW_LIMIT}
        THEN 'rate'
        WHEN EXISTS (SELECT 1 FROM updated) THEN 'ok'
        ELSE 'conflict'
      END AS reason,
      CASE
        WHEN (SELECT "mutationWindowStartedAt" FROM current) IS NOT NULL
        THEN (SELECT "mutationWindowStartedAt" FROM current) + (${DEMO_MUTATION_WINDOW_MS} * INTERVAL '1 millisecond')
        ELSE NULL
      END AS "retryAt"
  `;
  return resultFromRow(rows[0], now);
}

export async function consumeDemoRefreshQuota(
  db: DemoQuotaDb,
  userId: string,
  now: Date,
): Promise<DemoQuotaResult> {
  const rows = await db.$queryRaw<QuotaRow[]>`
    WITH current AS (
      SELECT * FROM "DemoWorkspace" WHERE "userId" = ${userId} FOR UPDATE
    ), updated AS (
      UPDATE "DemoWorkspace" AS workspace
      SET
        "refreshWindowStartedAt" = CASE
          WHEN current."refreshWindowStartedAt" IS NULL
            OR ${now} >= current."refreshWindowStartedAt" + (${DEMO_REFRESH_WINDOW_MS} * INTERVAL '1 millisecond')
          THEN ${now}
          ELSE current."refreshWindowStartedAt"
        END,
        "refreshCount" = CASE
          WHEN current."refreshWindowStartedAt" IS NULL
            OR ${now} >= current."refreshWindowStartedAt" + (${DEMO_REFRESH_WINDOW_MS} * INTERVAL '1 millisecond')
          THEN 1
          ELSE current."refreshCount" + 1
        END
      FROM current
      WHERE workspace."userId" = current."userId"
        AND current."expiresAt" > ${now}
        AND (
          current."refreshWindowStartedAt" IS NULL
          OR ${now} >= current."refreshWindowStartedAt" + (${DEMO_REFRESH_WINDOW_MS} * INTERVAL '1 millisecond')
          OR current."refreshCount" < ${DEMO_REFRESH_LIMIT}
        )
      RETURNING workspace."userId"
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM current) THEN 'missing'
        WHEN (SELECT "expiresAt" FROM current) <= ${now} THEN 'expired'
        WHEN (SELECT "refreshWindowStartedAt" FROM current) IS NOT NULL
          AND ${now} < (SELECT "refreshWindowStartedAt" FROM current) + (${DEMO_REFRESH_WINDOW_MS} * INTERVAL '1 millisecond')
          AND (SELECT "refreshCount" FROM current) >= ${DEMO_REFRESH_LIMIT}
        THEN 'rate'
        WHEN EXISTS (SELECT 1 FROM updated) THEN 'ok'
        ELSE 'conflict'
      END AS reason,
      CASE
        WHEN (SELECT "refreshWindowStartedAt" FROM current) IS NOT NULL
        THEN (SELECT "refreshWindowStartedAt" FROM current) + (${DEMO_REFRESH_WINDOW_MS} * INTERVAL '1 millisecond')
        ELSE NULL
      END AS "retryAt"
  `;
  return resultFromRow(rows[0], now);
}
