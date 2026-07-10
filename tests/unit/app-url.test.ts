import { describe, expect, it } from "vitest";
import { getAppUrl } from "@/lib/app-url";

describe("getAppUrl", () => {
  it("uses the production URL when no override is provided", () => {
    expect(getAppUrl("").toString()).toBe("https://assets-tracker-ct.vercel.app/");
  });

  it("uses a self-hoster's configured URL", () => {
    expect(getAppUrl("https://tracker.example.com").toString()).toBe(
      "https://tracker.example.com/",
    );
  });
});
