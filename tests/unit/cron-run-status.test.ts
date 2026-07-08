import { describe, it, expect } from "vitest";
import { classifyCronRunStatus, type CronUserOutcome } from "@/lib/cron-run-status";

describe("classifyCronRunStatus", () => {
  it("classifies an all-success batch as ok", () => {
    const outcomes: CronUserOutcome[] = [
      { userId: "u1", status: "fulfilled" },
      { userId: "u2", status: "fulfilled" },
    ];

    const result = classifyCronRunStatus(outcomes);

    expect(result).toEqual({
      ok: true,
      status: "ok",
      succeededUserIds: ["u1", "u2"],
      failedUserIds: [],
      errorSummary: null,
    });
  });

  it("classifies a partial failure as degraded but ok — the whole point of #558", () => {
    const outcomes: CronUserOutcome[] = [
      { userId: "u1", status: "fulfilled" },
      { userId: "u2", status: "rejected", reason: new Error("boom") },
      { userId: "u3", status: "fulfilled" },
    ];

    const result = classifyCronRunStatus(outcomes);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("degraded");
    expect(result.succeededUserIds).toEqual(["u1", "u3"]);
    expect(result.failedUserIds).toEqual(["u2"]);
    expect(result.errorSummary).toContain("u2");
    expect(result.errorSummary).toContain("boom");
  });

  it("classifies a total failure as failed and not ok", () => {
    const outcomes: CronUserOutcome[] = [
      { userId: "u1", status: "rejected", reason: new Error("db down") },
      { userId: "u2", status: "rejected", reason: "some string reason" },
    ];

    const result = classifyCronRunStatus(outcomes);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.succeededUserIds).toEqual([]);
    expect(result.failedUserIds).toEqual(["u1", "u2"]);
    expect(result.errorSummary).toContain("db down");
    expect(result.errorSummary).toContain("some string reason");
  });

  it("classifies an empty batch as ok", () => {
    const result = classifyCronRunStatus([]);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.errorSummary).toBeNull();
  });
});
