import "server-only";

import { log } from "@/lib/logger";

type DemoMetric =
  | "created"
  | "resumed"
  | "reset"
  | "expired"
  | "deleted"
  | "source_limited"
  | "capacity_limited"
  | "rate_limited"
  | "quota_limited"
  | "initialization_failed"
  | "reset_failed"
  | "cleanup_failed";

export function recordDemoMetric(
  event: DemoMetric,
  values: {
    durationMs?: number;
    fixtureDurationMs?: number;
    persistenceDurationMs?: number;
    rows?: number;
    count?: number;
  } = {},
) {
  log.info("public_demo.lifecycle", { event, ...values });
}
