import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateTag } from "next/cache";
import { invalidateScopedTag } from "@/lib/demo/demo-cache";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

describe("Demo cache invalidation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates only the owned tag for Demo", () => {
    invalidateScopedTag({
      globalTag: "goals",
      userTag: "goals:demo-user",
      principal: {
        kind: "demo",
        userId: "demo-user",
        expiresAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("goals:demo-user", { expire: 0 });
  });

  it("preserves global and owned invalidation for formal users", () => {
    invalidateScopedTag({
      globalTag: "goals",
      userTag: "goals:formal-user",
      principal: { kind: "formal", userId: "formal-user" },
    });
    expect(revalidateTag).toHaveBeenNthCalledWith(1, "goals", { expire: 0 });
    expect(revalidateTag).toHaveBeenNthCalledWith(2, "goals:formal-user", { expire: 0 });
  });
});
