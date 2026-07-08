/**
 * Pure classification helper for per-user cron work (currently: snapshot
 * creation in `/api/cron/snapshot`). Kept separate from the route so it's
 * unit-testable without mocking Prisma/Next.js — see issue #558: one user's
 * snapshot failure used to reject the whole `Promise.all` batch, which
 * skipped cache revalidation for every user (including ones whose snapshot
 * had already committed) and reported total failure even when most users
 * succeeded.
 */

export type CronUserOutcome = {
  userId: string;
  status: "fulfilled" | "rejected";
  reason?: unknown;
};

export type CronRunStatus = "ok" | "degraded" | "failed";

export type CronRunClassification = {
  /** Whether the `CronRun.ok` audit column should be set to true. */
  ok: boolean;
  /** "ok" = everyone succeeded, "degraded" = a subset failed, "failed" = everyone failed. */
  status: CronRunStatus;
  succeededUserIds: string[];
  failedUserIds: string[];
  /** Human-readable summary for the `CronRun.error` column, or null if nothing failed. */
  errorSummary: string | null;
};

/**
 * Classifies the outcome of a per-user batch (e.g. `Promise.allSettled` over
 * per-user snapshot creation) into an overall run status.
 *
 * - No failures → "ok"
 * - Some, but not all, failed → "degraded" (still `ok: true` — the run made
 *   progress and revalidation should proceed for the users who succeeded)
 * - Everyone failed (or the batch was empty) → "failed"
 */
export function classifyCronRunStatus(outcomes: CronUserOutcome[]): CronRunClassification {
  const succeededUserIds = outcomes.filter((o) => o.status === "fulfilled").map((o) => o.userId);
  const failed = outcomes.filter((o) => o.status === "rejected");
  const failedUserIds = failed.map((o) => o.userId);

  if (outcomes.length === 0 || failed.length === 0) {
    return { ok: true, status: "ok", succeededUserIds, failedUserIds, errorSummary: null };
  }

  const errorSummary = failed
    .map((o) => `${o.userId}: ${o.reason instanceof Error ? o.reason.message : String(o.reason)}`)
    .join("; ");

  if (failed.length === outcomes.length) {
    return { ok: false, status: "failed", succeededUserIds, failedUserIds, errorSummary };
  }

  return { ok: true, status: "degraded", succeededUserIds, failedUserIds, errorSummary };
}
