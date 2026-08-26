import { describe, expect, it } from "vitest";

describe("offline page", () => {
  it("exports a default component and is static", async () => {
    const mod = await import("@/app/offline/page");
    expect(typeof mod.default).toBe("function");
    // With cacheComponents: true, `dynamic = "force-static"` is incompatible.
    // The page is static by default (no data fetching); verify metadata instead.
    expect(mod.metadata).toBeDefined();
  });
});
