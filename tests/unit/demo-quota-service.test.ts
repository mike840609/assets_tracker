import { describe, expect, it, vi } from "vitest";
import { consumeDemoMutationQuota, consumeDemoRefreshQuota } from "@/lib/demo/demo-quota-service";

describe("public Demo quota service", () => {
  it.each([
    ["expired", "expired"],
    ["lifetime", "lifetime"],
    ["reset", "reset"],
    ["rate", "rate"],
  ] as const)("maps the %s database result", async (databaseReason, expected) => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ reason: databaseReason, retryAt: null }]),
    };

    await expect(
      consumeDemoMutationQuota(db, "demo-user", new Date(), { reset: true }),
    ).resolves.toMatchObject({ ok: false, reason: expected });
  });

  it("returns a retry delay for an anchored refresh window", async () => {
    const now = new Date("2026-08-01T00:05:00.000Z");
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ reason: "rate", retryAt: new Date("2026-08-01T00:10:00.000Z") }]),
    };

    await expect(consumeDemoRefreshQuota(db, "demo-user", now)).resolves.toEqual({
      ok: false,
      reason: "rate",
      retryAfterSeconds: 300,
    });
  });
});
