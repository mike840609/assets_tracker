import { describe, expect, it } from "vitest";
import { demoAnnouncementThreshold } from "@/lib/demo/demo-time";

describe("demoAnnouncementThreshold", () => {
  it.each([
    [3_600_001, null],
    [3_600_000, "oneHour"],
    [600_000, "tenMinutes"],
    [0, "expired"],
  ] as const)("maps %i milliseconds to %s", (remainingMs, threshold) => {
    expect(demoAnnouncementThreshold(remainingMs)).toBe(threshold);
  });
});
