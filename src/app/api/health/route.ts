import { prisma } from "@/lib/prisma";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/**
 * E17 — Liveness/readiness probe.
 *
 * Unauthenticated by design (health checks must work without a session) but
 * rate-limited per IP so it can't be abused as a free DB-ping endpoint. Returns
 * only non-sensitive status: DB connectivity, the latest snapshot timestamp +
 * age, and the response timestamp. No user data is exposed.
 *
 * Status semantics:
 *   - "ok"        → DB reachable AND a snapshot exists within the freshness window.
 *   - "degraded"  → DB reachable but the most recent snapshot is stale (> 36 h)
 *                   or no snapshot exists at all. Returns HTTP 503.
 *   - "unhealthy" → DB unreachable. Returns HTTP 503.
 *
 * The 36 h freshness window is the same threshold E18's CronRun alarm builds on.
 */
const SNAPSHOT_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const limited = rateLimitCheckWithPrune(request, { limit: 30, prefix: "health" });
  if (limited) return limited;

  const now = Date.now();

  let dbOk = false;
  let latestSnapshotAt: string | null = null;
  let snapshotAgeMs: number | null = null;

  try {
    // Lightweight liveness check + most-recent snapshot freshness in one round.
    const [, latest] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.netWorthSnapshot.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    dbOk = true;
    if (latest) {
      latestSnapshotAt = latest.createdAt.toISOString();
      snapshotAgeMs = now - latest.createdAt.getTime();
    }
  } catch (error) {
    log.error("health.db_unreachable", { error: String(error) });
  }

  const snapshotFresh = snapshotAgeMs !== null && snapshotAgeMs <= SNAPSHOT_MAX_AGE_MS;
  const status = !dbOk ? "unhealthy" : snapshotFresh ? "ok" : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;

  return Response.json(
    {
      status,
      db: dbOk ? "ok" : "error",
      latestSnapshotAt,
      snapshotAgeMs,
      timestamp: new Date(now).toISOString(),
    },
    { status: httpStatus },
  );
}
