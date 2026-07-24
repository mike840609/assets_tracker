import { describe, expect, it } from "vitest";
import {
  formatCalendarWallClock,
  groupCalendarEntriesByDate,
  isCalendarFocusDestinationReady,
  sortCalendarDayEntries,
  summarizeCalendarEntryCategories,
} from "@/components/calendar/calendar-view-model";

const base = {
  userId: "user_1",
  eventDate: "2026-08-12",
  timeZone: null,
  category: "OTHER" as const,
  description: null,
  sourceUrl: null,
  updatedAt: "2026-07-24T00:00:00.000Z",
};

describe("calendar view model", () => {
  it("sorts all-day entries before timed entries with stable created/id ties", () => {
    const entries = [
      {
        ...base,
        id: "late",
        title: "Late",
        startTimeMinutes: 900,
        createdAt: "2026-07-02T00:00:00.000Z",
      },
      {
        ...base,
        id: "all",
        title: "All",
        startTimeMinutes: null,
        createdAt: "2026-07-03T00:00:00.000Z",
      },
      {
        ...base,
        id: "early-b",
        title: "Early B",
        startTimeMinutes: 510,
        createdAt: "2026-07-02T00:00:00.000Z",
      },
      {
        ...base,
        id: "early-a",
        title: "Early A",
        startTimeMinutes: 510,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    expect(sortCalendarDayEntries(entries).map((entry) => entry.id)).toEqual([
      "all",
      "early-a",
      "early-b",
      "late",
    ]);
  });

  it("groups entries without mutating the input", () => {
    const entries = [
      {
        ...base,
        id: "a",
        title: "A",
        startTimeMinutes: null,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        ...base,
        id: "b",
        title: "B",
        eventDate: "2026-08-13",
        startTimeMinutes: null,
        createdAt: "2026-07-02T00:00:00.000Z",
      },
    ];
    expect([...groupCalendarEntriesByDate(entries).keys()]).toEqual(["2026-08-12", "2026-08-13"]);
    expect(entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("localizes wall-clock display without shifting the stored time", () => {
    expect(formatCalendarWallClock(510, "en-US")).toBe("8:30 AM");
    expect(formatCalendarWallClock(510, "en-GB")).toBe("08:30");
  });

  it("summarizes categories in the stable product order", () => {
    const entries = [
      {
        ...base,
        id: "other",
        title: "Other",
        startTimeMinutes: null,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        ...base,
        id: "indicator-a",
        title: "Indicator A",
        category: "ECONOMIC_INDICATOR" as const,
        startTimeMinutes: null,
        createdAt: "2026-07-02T00:00:00.000Z",
      },
      {
        ...base,
        id: "earnings",
        title: "Earnings",
        category: "EARNINGS" as const,
        startTimeMinutes: null,
        createdAt: "2026-07-03T00:00:00.000Z",
      },
      {
        ...base,
        id: "indicator-b",
        title: "Indicator B",
        category: "ECONOMIC_INDICATOR" as const,
        startTimeMinutes: null,
        createdAt: "2026-07-04T00:00:00.000Z",
      },
    ];

    expect(summarizeCalendarEntryCategories(entries)).toEqual([
      { category: "EARNINGS", count: 1 },
      { category: "ECONOMIC_INDICATOR", count: 2 },
      { category: "OTHER", count: 1 },
    ]);
  });
});

describe("calendar focus readiness", () => {
  it("waits for both the selected date and active month to reach the destination", () => {
    const pendingDate = "2026-09-01";
    expect(
      isCalendarFocusDestinationReady({
        pendingDate,
        selectedDate: "2026-08-31",
        month: "2026-08",
      }),
    ).toBe(false);
    expect(
      isCalendarFocusDestinationReady({
        pendingDate,
        selectedDate: pendingDate,
        month: "2026-08",
      }),
    ).toBe(false);
    expect(
      isCalendarFocusDestinationReady({
        pendingDate,
        selectedDate: pendingDate,
        month: "2026-09",
      }),
    ).toBe(true);
  });
});
