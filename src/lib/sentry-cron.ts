import "server-only";
import * as Sentry from "@sentry/nextjs";

type CronCheckIn = {
  id: string;
  startedAt: number;
};

const SNAPSHOT_MONITOR_SLUG = "snapshot";

const snapshotMonitorConfig = {
  schedule: { type: "interval" as const, value: 1, unit: "day" as const },
  // The app health endpoint treats snapshots as stale after 36 h. With a daily
  // schedule, a 12 h check-in margin produces the same effective window.
  checkinMargin: 12 * 60,
  maxRuntime: 5,
  timezone: "UTC",
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
};

export function startSnapshotCronCheckIn(): CronCheckIn | null {
  if (!process.env.SENTRY_DSN) return null;
  try {
    const id = Sentry.captureCheckIn(
      { monitorSlug: SNAPSHOT_MONITOR_SLUG, status: "in_progress" },
      snapshotMonitorConfig,
    );
    return { id, startedAt: Date.now() };
  } catch {
    return null;
  }
}

export function finishSnapshotCronCheckIn(
  checkIn: CronCheckIn | null,
  status: "ok" | "error",
): void {
  if (!checkIn || !process.env.SENTRY_DSN) return;
  try {
    Sentry.captureCheckIn({
      monitorSlug: SNAPSHOT_MONITOR_SLUG,
      checkInId: checkIn.id,
      status,
      duration: (Date.now() - checkIn.startedAt) / 1000,
    });
  } catch {
    // Best-effort telemetry only.
  }
}
