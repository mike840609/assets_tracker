import { describe, it, expect } from "vitest";
import { taiwanCalendarDay } from "@/lib/app-day";

describe("taiwanCalendarDay", () => {
  it.each([
    ["2026-03-08T15:59:59Z", "2026-03-08"],
    ["2026-03-08T16:00:00Z", "2026-03-09"],
    ["2026-11-01T15:59:59Z", "2026-11-01"],
    ["2026-11-01T16:00:00Z", "2026-11-02"],
    ["2025-12-31T16:00:00Z", "2026-01-01"],
  ])("keeps the Taiwan midnight boundary at %s regardless of viewer DST", (instant, day) => {
    expect(taiwanCalendarDay(new Date(instant)).toISOString()).toBe(`${day}T00:00:00.000Z`);
  });

  it("rolls 21:30 UTC into the next Taiwan calendar day", () => {
    // 2026-07-05T21:30Z = 2026-07-06 05:30 Taipei
    const result = taiwanCalendarDay(new Date("2026-07-05T21:30:00.000Z"));
    expect(result.toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("keeps a midday UTC instant on the same day", () => {
    // 2026-07-05T04:00Z = 2026-07-05 12:00 Taipei
    const result = taiwanCalendarDay(new Date("2026-07-05T04:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-07-05T00:00:00.000Z");
  });
});
