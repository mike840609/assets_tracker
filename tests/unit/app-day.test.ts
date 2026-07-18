import { describe, it, expect } from "vitest";
import { taiwanCalendarDay } from "@/lib/app-day";

describe("taiwanCalendarDay", () => {
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
