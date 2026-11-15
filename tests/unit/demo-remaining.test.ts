import { describe, expect, it } from "vitest";
import { formatRemaining } from "@/lib/demo/format-remaining";

describe("formatRemaining", () => {
  it("formats a plain duration, not a relative time", () => {
    expect(formatRemaining("en-US", 24 * 3_600_000)).toBe("24 hours");
    expect(formatRemaining("en-US", 5 * 60_000)).toBe("5 minutes");
    expect(formatRemaining("zh-TW", 24 * 3_600_000)).toBe("24 小時");
    expect(formatRemaining("zh-TW", 24 * 3_600_000)).not.toContain("後");
  });
});
