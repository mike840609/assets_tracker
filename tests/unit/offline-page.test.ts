import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("offline page", () => {
  it("is a server component that search engines must not index", async () => {
    const mod = await import("@/app/offline/page");
    expect(typeof mod.default).toBe("function");
    expect(mod.metadata.robots).toEqual({ index: false });
  });

  it("has no client island alongside it", async () => {
    // The page is served from the navigation cache with no guarantee that its JS
    // chunks are cached too, so anything needing hydration is dead exactly when
    // this page is shown. Every control on it must work without JavaScript.
    const files = await readdir(new URL("../../src/app/offline/", import.meta.url));
    expect(files).toEqual(["page.tsx"]);
  });
});
