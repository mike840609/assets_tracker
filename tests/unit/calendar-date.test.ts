import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildMonthGrid,
  getCalendarRangeLength,
  getVisibleCalendarRange,
  moveCalendarMonth,
  normalizeCalendarUrlState,
  parseDateOnly,
} from "@/lib/calendar-date";

describe("calendar date-only utilities", () => {
  it("accepts only real canonical dates", () => {
    expect(parseDateOnly("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(parseDateOnly("2024-02-29")).not.toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2026-2-03")).toBeNull();
    expect(parseDateOnly("03/02/2026")).toBeNull();
  });

  it("builds a six-week Monday-first grid across year boundaries", () => {
    const days = buildMonthGrid("2026-01");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2025-12-29");
    expect(days.at(-1)).toBe("2026-02-08");
    expect(getVisibleCalendarRange("2026-01")).toEqual({
      from: "2025-12-29",
      to: "2026-02-08",
    });
  });

  it("uses date-only UTC arithmetic across leap days", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("preserves the day of month and clamps month navigation", () => {
    expect(moveCalendarMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(moveCalendarMonth("2024-01-31", 1)).toBe("2024-02-29");
    expect(moveCalendarMonth("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("normalizes invalid URL state to the Taiwan business day", () => {
    const now = new Date("2026-07-24T20:30:00.000Z");
    expect(normalizeCalendarUrlState({}, now)).toEqual({
      month: "2026-07",
      date: "2026-07-25",
    });
    expect(normalizeCalendarUrlState({ month: "bad", date: "2026-02-31" }, now)).toEqual({
      month: "2026-07",
      date: "2026-07-25",
    });
  });

  it("keeps a valid selected date visible by making its month authoritative", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    expect(normalizeCalendarUrlState({ month: "2026-07", date: "2026-08-02" }, now)).toEqual({
      month: "2026-08",
      date: "2026-08-02",
    });
  });

  it("counts ranges inclusively", () => {
    expect(getCalendarRangeLength("2026-07-01", "2026-07-01")).toBe(1);
    expect(getCalendarRangeLength("2026-07-01", "2026-08-11")).toBe(42);
  });
});
