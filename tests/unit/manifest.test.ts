import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("declares standalone launch metadata", () => {
    const value = manifest();

    expect(value.display).toBe("standalone");
    expect(value.background_color).toBe("#0d1f1e");
    expect(value.theme_color).toBe("#0d1f1e");
  });

  // Identity is derived from start_url while id/scope are absent. Changing any
  // of the three orphans the icon already on a user's home screen, so a rename
  // must not drift into them.
  it("keeps installed-app identity stable", () => {
    const value = manifest();

    expect(value.start_url).toBe("/");
    expect(value.id).toBeUndefined();
    expect(value.scope).toBeUndefined();
  });

  it("declares any and maskable 192/512 launcher icons", () => {
    const icons = manifest().icons ?? [];

    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icons/icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        }),
        expect.objectContaining({
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
  });
});
