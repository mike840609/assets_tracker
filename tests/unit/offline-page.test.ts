import { describe, expect, it } from "vitest";

describe("offline page", () => {
  it("exports a default component and is force-static", async () => {
    const mod = await import("@/app/offline/page");
    expect(typeof mod.default).toBe("function");
    expect(mod.dynamic).toBe("force-static");
  });
});
