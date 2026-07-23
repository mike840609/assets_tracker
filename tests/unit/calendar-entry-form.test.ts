import { describe, expect, it } from "vitest";

import {
  minutesToTimeInput,
  resolveEntryTimeZone,
  timeInputToMinutes,
} from "@/components/calendar/calendar-entry-form-utils";

describe("calendar entry form helpers", () => {
  it("converts between input time and minutes", () => {
    expect(timeInputToMinutes("08:30")).toBe(510);
    expect(timeInputToMinutes("")).toBeNull();
    expect(minutesToTimeInput(510)).toBe("08:30");
    expect(minutesToTimeInput(null)).toBe("");
  });

  it("preserves an existing timed entry timezone", () => {
    expect(resolveEntryTimeZone("America/New_York", "Asia/Taipei")).toBe("America/New_York");
  });

  it("uses the valid browser timezone or UTC fallback for a new timed entry", () => {
    expect(resolveEntryTimeZone(null, "Asia/Taipei")).toBe("Asia/Taipei");
    expect(resolveEntryTimeZone(null, "Mars/Olympus")).toBe("UTC");
    expect(resolveEntryTimeZone(null, "")).toBe("UTC");
  });
});
