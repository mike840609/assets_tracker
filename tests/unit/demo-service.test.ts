import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  recordDemoMetric: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { deleteMany: mocks.deleteMany },
  },
}));

vi.mock("@/lib/env", () => ({
  AUTH_SECRET: "unit-test-secret",
  isPublicDemoEnabled: true,
}));

vi.mock("@/lib/demo/demo-metrics", () => ({
  recordDemoMetric: mocks.recordDemoMetric,
}));

import { deleteExpiredDemoUser } from "@/lib/demo/demo-service";

describe("public Demo service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contains request-triggered cleanup failures without exposing the database error", async () => {
    mocks.deleteMany.mockRejectedValueOnce(new Error("query contained a sensitive identifier"));

    await expect(
      deleteExpiredDemoUser("private-user-id", new Date("2026-08-01T00:00:00.000Z")),
    ).resolves.toEqual({ deleted: 0, failed: true });
    expect(mocks.recordDemoMetric).toHaveBeenCalledWith("cleanup_failed");
    expect(mocks.recordDemoMetric).toHaveBeenCalledTimes(1);
  });
});
